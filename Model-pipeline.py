# stt_cnn_attention_ctc_improved.py
# Cải thiện: Architecture, Data Augmentation, Training Strategy

import os
import math
import random
from typing import List, Tuple
import csv

import numpy as np
import librosa
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from tqdm import tqdm
from jiwer import wer

# Tương thích với các phiên bản PyTorch
try:
    from torch.amp import autocast, GradScaler
    USE_NEW_AMP = True
except ImportError:
    from torch.cuda.amp import autocast, GradScaler
    USE_NEW_AMP = False

# -------------------------
# Config - Improved
# -------------------------
SAMPLE_RATE = 16000
N_MELS = 80
FFT_SIZE = 512  # Giảm từ 1024 để tăng resolution thời gian
HOP_LENGTH = 160  # Giảm từ 256 cho dense features
WINDOW = 'hann'
BLANK_IDX = 0

# -------------------------
# Utils: text <-> int
# -------------------------
CHARS = " 'abcdefghijklmnopqrstuvwxyz"
char2idx = {c: i + 1 for i, c in enumerate(CHARS)}
idx2char = {i + 1: c for i, c in enumerate(CHARS)}
vocab_size = len(CHARS) + 1

def text_to_ints(text: str) -> List[int]:
    text = text.lower()
    return [char2idx[ch] for ch in text if ch in char2idx]

def ints_to_text(ints: List[int]) -> str:
    return ''.join(idx2char.get(i, '') for i in ints)

# -------------------------
# Feature extraction with Augmentation
# -------------------------
def load_audio(path: str, sr: int = SAMPLE_RATE) -> np.ndarray:
    audio, _ = librosa.load(path, sr=sr)
    return audio.astype(np.float32)

def compute_log_mel(audio: np.ndarray,
                    sr: int = SAMPLE_RATE,
                    n_fft: int = FFT_SIZE,
                    hop_length: int = HOP_LENGTH,
                    n_mels: int = N_MELS) -> np.ndarray:
    S = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_fft=n_fft, hop_length=hop_length, 
        n_mels=n_mels, window=WINDOW, power=2.0
    )
    log_S = librosa.power_to_db(S, ref=np.max)
    return log_S

# Data Augmentation
class SpecAugment:
    def __init__(self, freq_mask_param=15, time_mask_param=25, num_masks=2):
        self.freq_mask_param = freq_mask_param
        self.time_mask_param = time_mask_param
        self.num_masks = num_masks
    
    def __call__(self, spec):
        # spec: (n_mels, T)
        spec = spec.clone()
        n_mels, T = spec.shape
        
        # Frequency masking
        for _ in range(self.num_masks):
            f = random.randint(0, self.freq_mask_param)
            f0 = random.randint(0, max(0, n_mels - f))
            spec[f0:f0+f, :] = spec.mean()
        
        # Time masking
        for _ in range(self.num_masks):
            t = random.randint(0, min(self.time_mask_param, int(T * 0.1)))
            t0 = random.randint(0, max(0, T - t))
            spec[:, t0:t0+t] = spec.mean()
        
        return spec

# -------------------------
# Dataset with Augmentation
# -------------------------
class SpeechDataset(Dataset):
    def __init__(self, items: List[Tuple[str, str]], max_duration=None, augment=False):
        super().__init__()
        self.items = items
        self.max_duration = max_duration
        self.augment = augment
        self.spec_aug = SpecAugment() if augment else None

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        audio_path, transcript = self.items[idx]
        audio = load_audio(audio_path)
        
        # Audio augmentation
        if self.augment and random.random() < 0.5:
            # Speed perturbation
            speed_factor = random.uniform(0.9, 1.1)
            audio = librosa.effects.time_stretch(audio, rate=speed_factor)
            
        if self.max_duration is not None:
            max_len = int(self.max_duration * SAMPLE_RATE)
            if audio.shape[0] > max_len:
                start = random.randint(0, audio.shape[0] - max_len)
                audio = audio[start:start+max_len]
        
        feat = compute_log_mel(audio)
        
        # Normalization per utterance
        feat = (feat - feat.mean()) / (feat.std() + 1e-9)
        
        feat_tensor = torch.from_numpy(feat).float()
        
        # Spec augmentation
        if self.augment and self.spec_aug is not None:
            feat_tensor = self.spec_aug(feat_tensor)
        
        target = text_to_ints(transcript)
        
        return {
            'feat': feat_tensor,
            'feat_len': feat.shape[1],
            'target': torch.LongTensor(target),
            'target_len': len(target)
        }

def collate_fn(batch):
    batch_size = len(batch)
    max_T = max(item['feat_len'] for item in batch)
    n_mels = batch[0]['feat'].shape[0]
    
    feats = torch.zeros(batch_size, n_mels, max_T, dtype=torch.float32)
    feat_lens = torch.zeros(batch_size, dtype=torch.long)
    targets = []
    target_lens = torch.zeros(batch_size, dtype=torch.long)
    
    for i, item in enumerate(batch):
        T = item['feat_len']
        feats[i, :, :T] = item['feat']
        feat_lens[i] = T
        targets.append(item['target'])
        target_lens[i] = item['target_len']
    
    concat_targets = torch.cat(targets) if targets else torch.LongTensor([])
    
    return {
        'feats': feats,
        'feat_lens': feat_lens,
        'targets': concat_targets,
        'target_lens': target_lens
    }

# -------------------------
# Improved Model Architecture
# -------------------------
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, kernel=(3,3), stride=(1,1), padding=(1,1), dropout=0.1):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size=kernel, stride=stride, padding=padding)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.ReLU(inplace=True)
        self.dropout = nn.Dropout2d(dropout)

    def forward(self, x):
        return self.dropout(self.act(self.bn(self.conv(x))))

class BiLSTMBlock(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers=num_layers,
            batch_first=False, bidirectional=True, dropout=dropout if num_layers > 1 else 0
        )
        self.layer_norm = nn.LayerNorm(hidden_dim * 2)
        
    def forward(self, x):
        # x: (T, B, D)
        out, _ = self.lstm(x)
        out = self.layer_norm(out)
        return out

class STTModel(nn.Module):
    def __init__(self, n_mels=N_MELS, cnn_channels=[32, 64, 128], 
                 lstm_hidden=256, lstm_layers=3, num_classes=vocab_size, dropout=0.2):
        super().__init__()
        
        # CNN layers - deeper network
        layers = []
        in_ch = 1
        self.time_reduction = 1
        
        for i, out_ch in enumerate(cnn_channels):
            layers.append(ConvBlock(in_ch, out_ch, kernel=(3,3), padding=(1,1), dropout=dropout))
            # Giảm time dimension ở các layer sau
            if i < len(cnn_channels) - 1:
                layers.append(nn.MaxPool2d((1,2)))
                self.time_reduction *= 2
            in_ch = out_ch
        
        self.cnn = nn.Sequential(*layers)
        
        # Calculate CNN output dimension
        self.cnn_output_dim = cnn_channels[-1] * n_mels
        
        # Projection layer
        self.proj = nn.Linear(self.cnn_output_dim, lstm_hidden)
        self.proj_dropout = nn.Dropout(dropout)
        
        # BiLSTM layers - thay thế attention
        self.bilstm = BiLSTMBlock(lstm_hidden, lstm_hidden, num_layers=lstm_layers, dropout=dropout)
        
        # Output layer
        self.fc = nn.Sequential(
            nn.Linear(lstm_hidden * 2, lstm_hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(lstm_hidden, num_classes)
        )
        self.log_softmax = nn.LogSoftmax(dim=-1)

    def forward(self, feats, feat_lens):
        # feats: (B, n_mels, T)
        x = feats.unsqueeze(1)  # (B, 1, n_mels, T)
        x = self.cnn(x)  # (B, C, n_mels, T')
        B, C, M, Tprime = x.shape
        
        # Reshape: (T', B, C*M)
        x = x.permute(3, 0, 1, 2).contiguous()
        x = x.view(Tprime, B, C * M)
        
        # Project
        x = self.proj(x)  # (T', B, lstm_hidden)
        x = self.proj_dropout(x)
        
        # BiLSTM
        x = self.bilstm(x)  # (T', B, lstm_hidden*2)
        
        # Output
        logits = self.fc(x)  # (T', B, num_classes)
        log_probs = self.log_softmax(logits)
        
        # Calculate output lengths
        output_lens = feat_lens // self.time_reduction
        
        return log_probs, output_lens

# -------------------------
# Greedy decoder
# -------------------------
def greedy_decode(log_probs: torch.Tensor, output_lens: torch.Tensor) -> List[List[int]]:
    probs = log_probs.exp()
    T, B, C = probs.shape
    idxs = probs.argmax(dim=-1)
    results = []
    
    for b in range(B):
        valid_len = min(output_lens[b].item(), T)
        prev = None
        seq = []
        for t in range(valid_len):
            c = int(idxs[t, b].item())
            if c != BLANK_IDX and c != prev:
                seq.append(c)
            prev = c
        results.append(seq)
    
    return results

# -------------------------
# Training with AMP - Compatible version
# -------------------------
def train_epoch(model, device, dataloader, optimizer, ctc_loss, scaler, grad_clip=1.0):
    model.train()
    total_loss = 0.0
    pbar = tqdm(dataloader, desc="Training", leave=False)
    
    for batch in pbar:
        feats = batch['feats'].to(device, non_blocking=True)
        feat_lens = batch['feat_lens'].to(device, non_blocking=True)
        targets = batch['targets'].to(device, non_blocking=True)
        target_lens = batch['target_lens'].to(device, non_blocking=True)
        
        optimizer.zero_grad()
        
        # Mixed precision training - compatible with both old and new PyTorch
        if USE_NEW_AMP:
            with autocast(device_type='cuda', dtype=torch.float16):
                log_probs, output_lens = model(feats, feat_lens)
                loss = ctc_loss(log_probs, targets, output_lens, target_lens)
        else:
            with autocast():
                log_probs, output_lens = model(feats, feat_lens)
                loss = ctc_loss(log_probs, targets, output_lens, target_lens)
        
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        scaler.step(optimizer)
        scaler.update()
        
        total_loss += loss.item()
        pbar.set_postfix({'loss': f'{loss.item():.4f}'})
    
    return total_loss / max(1, len(dataloader))

def _split_concatenated_targets(concat_targets: torch.Tensor, target_lens: torch.Tensor) -> List[List[int]]:
    outs = []
    idx = 0
    for l in target_lens.tolist():
        if l > 0:
            slice_ = concat_targets[idx: idx + l].tolist()
        else:
            slice_ = []
        outs.append([int(x) for x in slice_])
        idx += l
    return outs

def validate(model, device, dataloader, ctc_loss):
    model.eval()
    total_loss = 0.0
    all_hyps = []
    all_refs = []
    pbar = tqdm(dataloader, desc="Validation", leave=False)
    
    with torch.no_grad():
        for batch in pbar:
            feats = batch['feats'].to(device, non_blocking=True)
            feat_lens = batch['feat_lens'].to(device, non_blocking=True)
            targets = batch['targets'].to(device, non_blocking=True)
            target_lens = batch['target_lens'].to(device, non_blocking=True)
            
            if USE_NEW_AMP:
                with autocast(device_type='cuda', dtype=torch.float16):
                    log_probs, output_lens = model(feats, feat_lens)
                    loss = ctc_loss(log_probs, targets, output_lens, target_lens)
            else:
                with autocast():
                    log_probs, output_lens = model(feats, feat_lens)
                    loss = ctc_loss(log_probs, targets, output_lens, target_lens)
            
            total_loss += loss.item()
            pbar.set_postfix({'loss': f'{loss.item():.4f}'})
            
            hyps_idx = greedy_decode(log_probs.cpu(), output_lens.cpu())
            refs_idx = _split_concatenated_targets(targets.cpu(), target_lens.cpu())
            
            for h, r in zip(hyps_idx, refs_idx):
                hyp_text = ints_to_text([x for x in h if x != BLANK_IDX])
                ref_text = ints_to_text([x for x in r if x != BLANK_IDX])
                all_hyps.append(hyp_text)
                all_refs.append(ref_text)
    
    avg_loss = total_loss / max(1, len(dataloader))
    
    if len(all_refs) > 0:
        total_wer = sum(wer(ref, hyp) if ref.strip() else 0.0 
                       for ref, hyp in zip(all_refs, all_hyps))
        avg_wer = total_wer / len(all_refs)
    else:
        avg_wer = float('nan')
    
    return avg_loss, avg_wer, all_refs, all_hyps

# -------------------------
# Main
# -------------------------
if __name__ == "__main__":
    train_audio_folder = "vivos/vivos/train"
    valid_audio_folder = "vivos/vivos/valid"
    train_csv_path = "vivos/vivos/train.csv"
    valid_csv_path = "vivos/vivos/valid.csv"

    for path in [train_audio_folder, valid_audio_folder, train_csv_path, valid_csv_path]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"❌ File or folder not found: {path}")

    def load_items(csv_path, audio_folder):
        items = []
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                file_name = row["file_name"].strip()
                if not file_name.endswith(".wav"):
                    file_name += ".wav"
                transcript = row["transcript"].strip()
                audio_path = os.path.join(audio_folder, file_name)
                if os.path.exists(audio_path):
                    items.append((audio_path, transcript))
                else:
                    print(f"⚠️ Warning: file không tồn tại {audio_path}")
        print(f"✅ Loaded {len(items)} samples from {csv_path}")
        return items

    train_items = load_items(train_csv_path, train_audio_folder)
    valid_items = load_items(valid_csv_path, valid_audio_folder)

    # Improved training settings
    batch_size = 8  # Giảm để tăng gradient updates
    num_workers = 4
    
    train_dataset = SpeechDataset(train_items, augment=True)  # Enable augmentation
    valid_dataset = SpeechDataset(valid_items, augment=False)

    train_loader = DataLoader(
        train_dataset, 
        batch_size=batch_size, 
        shuffle=True, 
        collate_fn=collate_fn,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=True
    )
    valid_loader = DataLoader(
        valid_dataset, 
        batch_size=batch_size, 
        shuffle=False, 
        collate_fn=collate_fn,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=True
    )

    # Setup
    if not torch.cuda.is_available():
        print("❌ CUDA not available!")
        import sys
        sys.exit(1)
    
    device = torch.device("cuda")
    print(f"🚀 Using device: {device}")
    print(f"📊 GPU: {torch.cuda.get_device_name(0)}")
    print(f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    print(f"🔧 AMP Mode: {'New (torch.amp)' if USE_NEW_AMP else 'Legacy (torch.cuda.amp)'}")
    
    model = STTModel().to(device)
    
    # Improved optimizer settings
    optimizer = torch.optim.AdamW(
        model.parameters(), 
        lr=3e-4,  # Lower initial learning rate
        weight_decay=1e-5,
        betas=(0.9, 0.98),
        eps=1e-9
    )
    
    ctc_loss = torch.nn.CTCLoss(blank=BLANK_IDX, zero_infinity=True)
    scaler = GradScaler()
    
    # Warmup + Cosine Annealing Scheduler
    num_epochs = 50
    warmup_epochs = 3
    
    def get_lr(epoch):
        if epoch < warmup_epochs:
            return (epoch + 1) / warmup_epochs
        else:
            progress = (epoch - warmup_epochs) / (num_epochs - warmup_epochs)
            return 0.5 * (1 + math.cos(math.pi * progress))
    
    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda=get_lr)

    # Training loop
    best_wer = float('inf')
    patience = 10
    patience_counter = 0
    
    for epoch in range(1, num_epochs + 1):
        print(f"\n{'='*50}")
        print(f"📅 Epoch {epoch}/{num_epochs}")
        print(f"{'='*50}")
        
        train_loss = train_epoch(model, device, train_loader, optimizer, ctc_loss, scaler)
        val_loss, val_wer, refs, hyps = validate(model, device, valid_loader, ctc_loss)
        
        scheduler.step()
        current_lr = optimizer.param_groups[0]['lr']
        
        print(f"📈 Results:")
        print(f"  Train Loss: {train_loss:.4f}")
        print(f"  Val Loss:   {val_loss:.4f}")
        print(f"  WER:        {val_wer:.4f}")
        print(f"  LR:         {current_lr:.6f}")
        
        # Save best model
        if val_wer < best_wer:
            best_wer = val_wer
            patience_counter = 0
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_wer': val_wer,
            }, 'best_model.pt')
            print(f"  ✅ Saved best model (WER: {val_wer:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"  ⚠️ Early stopping triggered after {patience} epochs without improvement")
                break
        
        # Sample predictions
        print(f"\n📝 Sample predictions:")
        for i in range(min(3, len(refs))):
            print(f"  Ref: {refs[i]}")
            print(f"  Hyp: {hyps[i]}")
            print("  ---")
        
        if torch.cuda.is_available():
            print(f"\n💾 GPU Memory: {torch.cuda.memory_allocated()/1e9:.2f} GB / {torch.cuda.max_memory_allocated()/1e9:.2f} GB")
            torch.cuda.reset_peak_memory_stats()
    
    print(f"\n🎉 Training completed! Best WER: {best_wer:.4f}")
    
    
    
    
    
    
import torch
from STT_MODEL_TEST import STTModel, N_MELS

# Khởi tạo model
model = STTModel()
checkpoint = torch.load(r"C:\Users\admin\Downloads\model\best_model.pt", map_location="cpu")

# Load trọng số
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

# Dummy input (giả lập 1 đoạn audio)
# Giả sử feature có N_MELS và độ dài T=200 (anh có thể tăng nếu model cần)
dummy_feats = torch.randn(1, N_MELS, 200)
dummy_feat_lens = torch.tensor([200])

# Xuất model sang ONNX
torch.onnx.export(
    model,                                   # model
    (dummy_feats, dummy_feat_lens),          # input mẫu
    "stt_model.onnx",                        # tên file output
    input_names=["feats", "feat_lens"],      # tên input
    output_names=["log_probs", "output_lens"], # tên output
    dynamic_axes={                           # Cho phép input/output có độ dài linh hoạt
        "feats": {2: "T"},                   # trục thời gian có thể thay đổi
        "log_probs": {0: "T_out"}            # đầu ra cũng thay đổi theo thời gian
    },
    opset_version=17,                        # opset mới nhất (PyTorch ≥ 2.0)
    do_constant_folding=True
)

print("✅ Model đã được xuất sang file stt_model.onnx thành công!")