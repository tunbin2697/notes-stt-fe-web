/**
 * STT Core Service - Consolidated Speech-to-Text Engine
 *
 * This module provides a complete STT implementation with:
 * - ONNX Runtime model inference
 * - Real-time voice activity detection (VAD)
 * - Audio file upload and transcription
 * - Mel-spectrogram feature extraction
 * - CTC greedy decoding
 *
 * Usage with React:
 * 1. Call initialize() once on component mount
 * 2. Use startRealTimeSTT() for live microphone transcription
 * 3. Use processAudioFile() for uploaded audio files
 * 4. Use callbacks for UI updates (onProgress, onTranscript, onVADStatus)
 */

import * as ort from "onnxruntime-web";

// ============================================
// CONFIGURATION AND STATE
// ============================================

const CONFIG = {
  MODEL_PATH: "/stt-model/stt_model.onnx",
  CONFIG_PATH: "/stt-model/stt_config.json",
};

const STATE = {
  sttSession: null,
  audioContext: null,
  config: {},
  isInitialized: false,
  streamingTail: null,
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the STT service by loading model and configuration
 * Call this once before using any STT features
 * @returns {Promise<void>}
 */
export async function initialize() {
  if (STATE.isInitialized) {
    // STT already initialized
    return;
  }

  // Initialization started (logs minimized for production)

  try {
    await loadConfiguration();
    await loadONNXModel();
    initializeAudioContext();
    STATE.isInitialized = true;
    console.log("✅ STT Core initialized successfully");
  } catch (error) {
    console.error("❌ STT initialization failed:", error);
    throw new Error(`Failed to initialize STT: ${error.message}`);
  }
}

/**
 * Load configuration from JSON file
 */
async function loadConfiguration() {
  const response = await fetch(CONFIG.CONFIG_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.statusText}`);
  }
  STATE.config = await response.json();
  console.info("✅ Config loaded");
}

/**
 * Load ONNX model with WebAssembly backend
 * Note: onnxruntime-web uses WebAssembly (.wasm files) internally to run your .onnx model
 */
async function loadONNXModel() {
  // Load your ONNX model file
  STATE.sttSession = await ort.InferenceSession.create(CONFIG.MODEL_PATH);
  console.info("✅ ONNX Model loaded");
}

/**
 * Initialize AudioContext for audio processing
 */
function initializeAudioContext() {
  STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  console.info("✅ AudioContext ready");
}

/**
 * Check if STT is initialized
 * @returns {boolean}
 */
export function isInitialized() {
  return STATE.isInitialized;
}

/**
 * Reset streaming-specific state such as overlap buffers
 */
export function resetStreamingState() {
  STATE.streamingTail = null;
}

// ============================================
// FFT IMPLEMENTATION
// ============================================

/**
 * Perform FFT on real-valued signal using Cooley-Tukey algorithm
 */
function realFFT(signal) {
  const n = signal.length;
  const output = new Float32Array(n * 2);

  // Initialize with signal (real parts only)
  for (let i = 0; i < n; i++) {
    output[i * 2] = signal[i];
    output[i * 2 + 1] = 0;
  }

  fftInPlace(output, n);
  return output;
}

/**
 * In-place FFT (Cooley-Tukey algorithm)
 */
function fftInPlace(data, n) {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (j > i) {
      [data[i * 2], data[j * 2]] = [data[j * 2], data[i * 2]];
      [data[i * 2 + 1], data[j * 2 + 1]] = [data[j * 2 + 1], data[i * 2 + 1]];
    }
    let k = n / 2;
    while (k <= j) {
      j -= k;
      k /= 2;
    }
    j += k;
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= n; len *= 2) {
    const angle = (-2 * Math.PI) / len;
    const wlen_real = Math.cos(angle);
    const wlen_imag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let w_real = 1;
      let w_imag = 0;

      for (let j = 0; j < len / 2; j++) {
        const idx1 = (i + j) * 2;
        const idx2 = (i + j + len / 2) * 2;

        const u_real = data[idx1];
        const u_imag = data[idx1 + 1];
        const t_real = w_real * data[idx2] - w_imag * data[idx2 + 1];
        const t_imag = w_real * data[idx2 + 1] + w_imag * data[idx2];

        data[idx1] = u_real + t_real;
        data[idx1 + 1] = u_imag + t_imag;
        data[idx2] = u_real - t_real;
        data[idx2 + 1] = u_imag - t_imag;

        const w_real_temp = w_real * wlen_real - w_imag * wlen_imag;
        w_imag = w_real * wlen_imag + w_imag * wlen_real;
        w_real = w_real_temp;
      }
    }
  }
}

// ============================================
// AUDIO FEATURE EXTRACTION
// ============================================

/**
 * Compute log-mel spectrogram features from raw audio
 * @param {Float32Array} audioData - Mono PCM audio at 16kHz
 * @returns {{features: Float32Array, nMels: number, numFrames: number} | null}
 */
function computeLogMelFeaturesJS(audioData) {
  const params = extractAudioParams();

  // Apply padding to match librosa's center=True behavior
  const padLength = Math.floor(params.FFT_SIZE / 2);
  const paddedAudio = new Float32Array(audioData.length + 2 * padLength);
  paddedAudio.set(audioData, padLength);

  const numFrames = calculateNumFrames(paddedAudio.length, params);

  if (numFrames <= 0) {
    console.warn("Audio too short for feature extraction");
    return null;
  }

  const window = createHannWindow(params.FFT_SIZE);
  const melFilters = createMelFilterbank(
    params.N_MELS,
    params.FFT_SIZE,
    params.SAMPLE_RATE
  );

  const melSpecPower = computeMelSpectrogram(
    paddedAudio,
    numFrames,
    params,
    window,
    melFilters
  );

  const melSpecDB = convertPowerToDb(melSpecPower);
  const normalized = normalizeFeatures(melSpecDB, params.N_MELS, numFrames);

  return {
    features: normalized,
    nMels: params.N_MELS,
    numFrames,
  };
}

/**
 * Extract audio processing parameters from config
 */
function extractAudioParams() {
  return {
    N_MELS: STATE.config.N_MELS || 80,
    FFT_SIZE: STATE.config.FFT_SIZE || 512,
    HOP_LENGTH: STATE.config.HOP_LENGTH || 160,
    SAMPLE_RATE: STATE.config.SAMPLE_RATE || 16000,
  };
}

/**
 * Calculate number of frames for STFT
 */
function calculateNumFrames(audioLength, params) {
  return Math.floor((audioLength - params.FFT_SIZE) / params.HOP_LENGTH) + 1;
}

/**
 * Compute mel spectrogram from audio data
 */
function computeMelSpectrogram(
  audioData,
  numFrames,
  params,
  window,
  melFilters
) {
  const melSpec = new Float32Array(params.N_MELS * numFrames);

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frame = extractFrame(audioData, frameIdx, params, window);
    const powerSpec = computePowerSpectrum(frame, params.FFT_SIZE);
    applyMelFilterbank(powerSpec, melFilters, melSpec, frameIdx, params.N_MELS);
  }

  return melSpec;
}

/**
 * Extract and window a single audio frame
 */
function extractFrame(audioData, frameIdx, params, window) {
  const start = frameIdx * params.HOP_LENGTH;
  const frame = new Float32Array(params.FFT_SIZE);

  for (let i = 0; i < params.FFT_SIZE; i++) {
    frame[i] =
      start + i < audioData.length ? audioData[start + i] * window[i] : 0;
  }

  return frame;
}

/**
 * Compute power spectrum from FFT result
 */
function computePowerSpectrum(frame, fftSize) {
  const fftResult = realFFT(frame);
  const powerSpec = new Float32Array(fftSize / 2 + 1);

  for (let i = 0; i < powerSpec.length; i++) {
    const real = fftResult[i * 2];
    const imag = fftResult[i * 2 + 1];
    powerSpec[i] = real * real + imag * imag;
  }

  return powerSpec;
}

/**
 * Apply mel filterbank
 */
function applyMelFilterbank(powerSpec, melFilters, melSpec, frameIdx, nMels) {
  for (let melIdx = 0; melIdx < nMels; melIdx++) {
    let melEnergy = 0;
    for (let freqIdx = 0; freqIdx < powerSpec.length; freqIdx++) {
      melEnergy += powerSpec[freqIdx] * melFilters[melIdx][freqIdx];
    }
    melSpec[frameIdx * nMels + melIdx] = melEnergy;
  }
}

/**
 * Convert power spectrogram to dB scale
 * Matches librosa.power_to_db(S, ref=np.max)
 */
function convertPowerToDb(powerSpec) {
  let maxPower = 0;
  for (let i = 0; i < powerSpec.length; i++) {
    if (powerSpec[i] > maxPower) {
      maxPower = powerSpec[i];
    }
  }

  const dbSpec = new Float32Array(powerSpec.length);
  const amin = 1e-10;
  const topDb = 80.0;

  for (let i = 0; i < powerSpec.length; i++) {
    const power = Math.max(powerSpec[i], amin);
    const ref = Math.max(maxPower, amin);
    let db = 10 * Math.log10(power / ref);
    db = Math.max(db, -topDb);
    dbSpec[i] = db;
  }

  return dbSpec;
}

/**
 * Normalize features using mean and standard deviation
 */
function normalizeFeatures(melSpec, nMels, numFrames) {
  const mean = melSpec.reduce((sum, val) => sum + val, 0) / melSpec.length;
  const variance =
    melSpec.reduce((sum, val) => sum + (val - mean) ** 2, 0) / melSpec.length;
  const std = Math.sqrt(variance);

  const features = new Float32Array(melSpec.length);
  for (let melIdx = 0; melIdx < nMels; melIdx++) {
    for (let t = 0; t < numFrames; t++) {
      const normalized = (melSpec[t * nMels + melIdx] - mean) / (std + 1e-9);
      features[melIdx * numFrames + t] = normalized;
    }
  }

  return features;
}

/**
 * Create Hann window function
 */
function createHannWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/**
 * Create mel-scale filterbank
 */
function createMelFilterbank(nMels, fftSize, sampleRate) {
  const nFreqs = Math.floor(fftSize / 2) + 1;
  const melFilters = Array.from(
    { length: nMels },
    () => new Float32Array(nFreqs)
  );

  const melPoints = calculateMelPoints(nMels, sampleRate);
  const binPoints = convertMelPointsToBins(melPoints, fftSize, sampleRate);

  buildTriangularFilters(melFilters, binPoints, nMels, nFreqs, sampleRate);

  return melFilters;
}

/**
 * Calculate mel-scale frequency points using Slaney formula
 */
function calculateMelPoints(nMels, sampleRate) {
  const fMin = 0.0;
  const fMax = sampleRate / 2;
  const minLogHz = 1000.0;
  const minLogMel = 15.0;
  const logStep = Math.log(6.4) / 27.0;

  const hzToMel = (hz) => {
    if (hz < minLogHz) {
      return ((hz - fMin) / (minLogHz - fMin)) * minLogMel;
    } else {
      return minLogMel + Math.log(hz / minLogHz) / logStep;
    }
  };

  const melToHz = (mel) => {
    if (mel < minLogMel) {
      return fMin + (mel / minLogMel) * (minLogHz - fMin);
    } else {
      return minLogHz * Math.exp(logStep * (mel - minLogMel));
    }
  };

  const minMel = hzToMel(fMin);
  const maxMel = hzToMel(fMax);

  return Array.from({ length: nMels + 2 }, (_, i) =>
    melToHz(minMel + (i * (maxMel - minMel)) / (nMels + 1))
  );
}

/**
 * Convert mel points to FFT bin indices
 */
function convertMelPointsToBins(melPoints, fftSize, sampleRate) {
  return melPoints.map((mel) => (mel * fftSize) / sampleRate);
}

/**
 * Build triangular filters for mel filterbank with Slaney normalization
 */
function buildTriangularFilters(
  melFilters,
  binPoints,
  nMels,
  nFreqs,
  sampleRate
) {
  // Build unnormalized triangular filters
  for (let i = 0; i < nMels; i++) {
    const leftBin = binPoints[i];
    const centerBin = binPoints[i + 1];
    const rightBin = binPoints[i + 2];

    const leftInt = Math.floor(leftBin);
    const rightInt = Math.ceil(rightBin);

    for (let j = leftInt; j <= rightInt && j < nFreqs; j++) {
      let weight = 0.0;

      if (j >= leftBin && j <= centerBin) {
        if (centerBin > leftBin) {
          weight = (j - leftBin) / (centerBin - leftBin);
        } else {
          weight = 1.0;
        }
      } else if (j > centerBin && j <= rightBin) {
        if (rightBin > centerBin) {
          weight = (rightBin - j) / (rightBin - centerBin);
        }
      }

      melFilters[i][j] = weight;
    }
  }

  // Apply Slaney normalization
  const melFreqs = calculateMelPoints(nMels, sampleRate);
  for (let i = 0; i < nMels; i++) {
    const enorm = 2.0 / (melFreqs[i + 2] - melFreqs[i]);
    for (let j = 0; j < nFreqs; j++) {
      melFilters[i][j] *= enorm;
    }
  }
}

// ============================================
// AUDIO PROCESSING UTILITIES
// ============================================

/**
 * Decode audio blob and resample to target sample rate
 */
function decodeAndResampleAudio(arrayBuffer) {
  return new Promise((resolve, reject) => {
    STATE.audioContext.decodeAudioData(
      arrayBuffer,
      (audioBuffer) => {
        const monoData = audioBuffer.getChannelData(0);
        const targetSampleRate = STATE.config.SAMPLE_RATE || 16000;
        const resampledData = shouldResample(
          audioBuffer.sampleRate,
          targetSampleRate
        )
          ? resampleAudio(monoData, audioBuffer.sampleRate, targetSampleRate)
          : monoData;

        resolve(resampledData);
      },
      (error) => {
        console.error("Audio decode error:", error);
        reject(error);
      }
    );
  });
}

/**
 * Check if resampling is needed
 */
function shouldResample(sourceSR, targetSR) {
  return sourceSR !== targetSR;
}

/**
 * Resample audio using linear interpolation
 */
function resampleAudio(audioData, sourceSR, targetSR) {
  if (sourceSR === targetSR) return audioData;

  const ratio = sourceSR / targetSR;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    result[i] =
      audioData[srcIndexFloor] * (1 - fraction) +
      audioData[srcIndexCeil] * fraction;
  }

  return result;
}

// ============================================
// MODEL INFERENCE AND DECODING
// ============================================

/**
 * Perform speech-to-text inference on audio blob
 * @param {Blob} audioBlob - Recorded audio chunk
 * @returns {Promise<string | null>} Transcribed text
 */
export async function inferSTT(audioBlob, options = {}) {
  try {
    const audioData = await prepareAudioData(audioBlob, options);
    if (!audioData) return null;

    const features = extractFeatures(audioData);
    if (!features) return null;

    const transcript = await runInferenceAndDecode(features);
    return transcript;
  } catch (error) {
    console.error("❌ Inference error:", error);
    return null;
  }
}

/**
 * Prepare audio data from blob
 */
async function prepareAudioData(audioBlob, options = {}) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioData = await decodeAndResampleAudio(arrayBuffer);

  if (!audioData || audioData.length === 0) {
    console.warn("Empty audio data");
    return null;
  }

  return applyStreamingOverlap(audioData, options.overlapMs);
}

/**
 * Extract features from audio data
 */
function extractFeatures(audioData) {
  return computeLogMelFeaturesJS(audioData);
}

function applyStreamingOverlap(audioData, overlapMs) {
  if (!overlapMs || overlapMs <= 0) {
    STATE.streamingTail = null;
    return audioData;
  }

  const sampleRate = STATE.config.SAMPLE_RATE || 16000;
  const desiredSamples = Math.max(
    1,
    Math.round((overlapMs / 1000) * sampleRate)
  );

  const previousTail = STATE.streamingTail;
  let combined = audioData;

  if (previousTail && previousTail.length) {
    combined = new Float32Array(previousTail.length + audioData.length);
    combined.set(previousTail, 0);
    combined.set(audioData, previousTail.length);
  }

  const tailLength = Math.min(desiredSamples, combined.length);
  STATE.streamingTail =
    tailLength > 0 ? combined.slice(combined.length - tailLength) : null;

  return combined;
}

/**
 * Run ONNX inference and decode results
 */
async function runInferenceAndDecode(featureResult) {
  const { features, nMels, numFrames } = featureResult;

  const inputTensors = createInputTensors(features, nMels, numFrames);
  const startTime = performance.now();
  const results = await STATE.sttSession.run(inputTensors);
  const inferenceTime = performance.now() - startTime;

  const transcript = decodeModelOutput(results);

  logInferenceStats(inferenceTime, numFrames, transcript);

  return transcript || null;
}

/**
 * Create input tensors for ONNX model
 */
function createInputTensors(features, nMels, numFrames) {
  const inputTensor = new ort.Tensor("float32", features, [
    1,
    nMels,
    numFrames,
  ]);
  const featLensTensor = new ort.Tensor("int64", [BigInt(numFrames)], [1]);

  return {
    [STATE.sttSession.inputNames[0]]: inputTensor,
    [STATE.sttSession.inputNames[1]]: featLensTensor,
  };
}

/**
 * Decode model output to text
 */
function decodeModelOutput(results) {
  const outputTensor = results[STATE.sttSession.outputNames[0]];
  const decodedInts = greedyDecodeJS(outputTensor);
  return intsToTextJS(decodedInts);
}

/**
 * Log inference statistics
 */
function logInferenceStats(inferenceTime, numFrames, transcript) {
  // Inference statistics are intentionally suppressed in browser logs.
}

/**
 * CTC greedy decoder
 * @param {ort.Tensor} outputTensor - Model output tensor [T, 1, vocab_size]
 * @returns {number[]} Decoded character indices
 */
function greedyDecodeJS(outputTensor) {
  const { T, vocabSize } = parseTensorDimensions(outputTensor.dims);
  if (T === 0 || vocabSize === 0) return [];

  const BLANK_IDX = STATE.config.BLANK_IDX || 0;
  const logits = outputTensor.data;
  const decoded = [];
  let lastIndex = -1;

  for (let t = 0; t < T; t++) {
    const maxIdx = findArgMax(logits, t, vocabSize);

    if (maxIdx !== BLANK_IDX && maxIdx !== lastIndex) {
      decoded.push(maxIdx);
    }
    lastIndex = maxIdx;
  }

  return decoded;
}

/**
 * Parse tensor dimensions
 */
function parseTensorDimensions(dims) {
  if (dims.length === 3) {
    return {
      T: dims[1] === 1 ? dims[0] : dims[1],
      vocabSize: dims[2],
    };
  } else if (dims.length === 2) {
    return {
      T: dims[0],
      vocabSize: dims[1],
    };
  } else {
    console.error("Unexpected output shape:", dims);
    return { T: 0, vocabSize: 0 };
  }
}

/**
 * Find argmax for a given timestep
 */
function findArgMax(logits, timestep, vocabSize) {
  const frameStart = timestep * vocabSize;
  let maxVal = -Infinity;
  let maxIdx = -1;

  for (let i = 0; i < vocabSize; i++) {
    const val = logits[frameStart + i];
    if (val > maxVal) {
      maxVal = val;
      maxIdx = i;
    }
  }

  return maxIdx;
}

/**
 * Convert character indices to text
 */
function intsToTextJS(indices) {
  return indices.map((idx) => STATE.config.VOCABULARY[idx] || "").join("");
}

// ============================================
// REAL-TIME VOICE ACTIVITY DETECTION
// ============================================

/**
 * Start real-time speech-to-text with voice activity detection
 *
 * @param {Function} onAudioChunkReady - Callback when audio chunk is ready: (audioBlob) => void
 * @param {Function} onVADStatusChange - Callback for VAD status updates: ({ isSpeaking, volumeDb, duration }) => void
 * @param {number} volumeThresholdDb - dB threshold for speech detection (default: -50)
 * @param {number} minChunkMs - Minimum chunk duration in ms (default: 1000)
 * @param {number} maxChunkMs - Maximum chunk duration in ms (default: 2000)
 * @param {number} silenceGapMs - Silence gap before stopping in ms (default: 300)
 * @returns {Function} Stop function to end recording
 *
 * @example
 * const stopFn = startRealTimeSTT(
 *   (audioBlob) => console.log('Audio chunk ready'),
 *   (status) => console.log('VAD:', status),
 *   -50, // volumeThresholdDb
 *   1000, // minChunkMs
 *   2000, // maxChunkMs
 *   300 // silenceGapMs
 * );
 * // Later: stopFn();
 */
export function startRealTimeSTT(
  onAudioChunkReady,
  onVADStatusChange = null,
  volumeThresholdDb = -50,
  minChunkMs = 1000,
  maxChunkMs = 2000,
  silenceGapMs = 300
) {
  const vadState = createVADState(silenceGapMs);

  navigator.mediaDevices
    .getUserMedia(getAudioConstraints())
    .then(async (stream) => {
      await setupAudioRecording(
        stream,
        vadState,
        onAudioChunkReady,
        onVADStatusChange,
        volumeThresholdDb,
        minChunkMs,
        maxChunkMs
      );
    })
    .catch((err) => {
      console.error("❌ Microphone access denied:", err);
      throw new Error("Could not access microphone. Check permissions.");
    });

  return () => stopListening(vadState);
}

/**
 * Create VAD state object
 */
function createVADState(silenceGapMs) {
  return {
    mediaRecorder: null,
    stream: null,
    analyser: null,
    audioChunks: [],
    isSpeaking: false,
    speechStartTime: 0,
    lastSpeechTime: 0,
    SILENCE_GAP_MS: silenceGapMs,
    isActive: true,
  };
}

/**
 * Get audio constraints for microphone
 */
function getAudioConstraints() {
  return {
    audio: {
      channelCount: 1,
      sampleRate: STATE.config.SAMPLE_RATE || 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
}

/**
 * Setup audio recording and VAD
 */
async function setupAudioRecording(
  stream,
  vadState,
  onAudioChunkReady,
  onVADStatusChange,
  volumeThresholdDb,
  minChunkMs,
  maxChunkMs
) {
  vadState.stream = stream;

  const audioTracks = stream.getAudioTracks();
  // Microphone connected (device details suppressed)

  vadState.mediaRecorder = createMediaRecorder(
    stream,
    vadState,
    onAudioChunkReady
  );
  vadState.analyser = await setupAudioAnalysis(stream);

  startVoiceActivityDetection(
    vadState,
    onVADStatusChange,
    volumeThresholdDb,
    minChunkMs,
    maxChunkMs
  );

  // Listening started (details suppressed)
}

/**
 * Create MediaRecorder
 */
function createMediaRecorder(stream, vadState, onAudioChunkReady) {
  const types = ["audio/webm", "audio/ogg", "audio/mp4", ""];
  const mimeType = types.find(
    (type) => !type || MediaRecorder.isTypeSupported(type)
  );
  const mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) vadState.audioChunks.push(event.data);
  };

  mediaRecorder.onstop = () => {
    if (vadState.audioChunks.length > 0) {
      const audioBlob = new Blob(vadState.audioChunks, {
        type: mediaRecorder.mimeType,
      });
      onAudioChunkReady(audioBlob);
      vadState.audioChunks = [];
    }

    if (vadState.isSpeaking && vadState.isActive) {
      vadState.speechStartTime = performance.now();
      vadState.mediaRecorder.start();
    }
  };

  return mediaRecorder;
}

/**
 * Setup audio analysis
 */
async function setupAudioAnalysis(stream) {
  if (STATE.audioContext.state === "suspended") {
    await STATE.audioContext.resume();
  }

  const source = STATE.audioContext.createMediaStreamSource(stream);
  const analyser = STATE.audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  return analyser;
}

/**
 * Start voice activity detection loop
 */
function startVoiceActivityDetection(
  vadState,
  onVADStatusChange,
  volumeThresholdDb,
  minChunkMs,
  maxChunkMs
) {
  const dataArray = new Uint8Array(vadState.analyser.frequencyBinCount);

  const processAudio = () => {
    if (!vadState.isActive) return;

    vadState.analyser.getByteTimeDomainData(dataArray);
    const volumeDb = calculateVolumeDb(dataArray);
    const now = performance.now();
    const speechDuration = vadState.isSpeaking
      ? now - vadState.speechStartTime
      : 0;

    // UI UPDATE PLACEHOLDER: Call React callback for VAD status
    if (onVADStatusChange) {
      onVADStatusChange({
        isSpeaking: vadState.isSpeaking,
        volumeDb: volumeDb,
        duration: speechDuration,
        threshold: volumeThresholdDb,
      });
    }

    handleVoiceActivity(
      vadState,
      volumeDb,
      volumeThresholdDb,
      now,
      speechDuration,
      minChunkMs,
      maxChunkMs
    );

    requestAnimationFrame(processAudio);
  };

  processAudio();
}

/**
 * Calculate volume in dB
 */
function calculateVolumeDb(dataArray) {
  const rms = Math.sqrt(
    dataArray.reduce((sum, val) => {
      const normalized = (val - 128) / 128;
      return sum + normalized * normalized;
    }, 0) / dataArray.length
  );
  return rms > 0.001 ? 20 * Math.log10(rms) : -100;
}

/**
 * Handle voice activity
 */
function handleVoiceActivity(
  vadState,
  volumeDb,
  threshold,
  now,
  speechDuration,
  minChunkMs,
  maxChunkMs
) {
  if (volumeDb > threshold) {
    handleSpeechDetected(vadState, now, speechDuration, maxChunkMs);
  } else if (vadState.isSpeaking) {
    handleSilenceDetected(
      vadState,
      now,
      speechDuration,
      minChunkMs,
      maxChunkMs
    );
  }
}

/**
 * Handle speech detected
 */
function handleSpeechDetected(vadState, now, speechDuration, maxChunkMs) {
  vadState.lastSpeechTime = now;

  if (!vadState.isSpeaking) {
    vadState.isSpeaking = true;
    vadState.speechStartTime = now;
    if (vadState.mediaRecorder.state === "inactive") {
      vadState.audioChunks = [];
      vadState.mediaRecorder.start();
    }
  } else if (speechDuration >= maxChunkMs) {
    stopSpeechRecording(vadState);
  }
}

/**
 * Handle silence detected
 */
function handleSilenceDetected(
  vadState,
  now,
  speechDuration,
  minChunkMs,
  maxChunkMs
) {
  const silenceDuration = now - vadState.lastSpeechTime;
  const shouldStop =
    (speechDuration >= minChunkMs &&
      silenceDuration >= vadState.SILENCE_GAP_MS) ||
    speechDuration >= maxChunkMs;

  if (shouldStop) {
    vadState.isSpeaking = false;
    stopSpeechRecording(vadState);
  }
}

/**
 * Stop speech recording
 */
function stopSpeechRecording(vadState) {
  if (vadState.mediaRecorder.state === "recording") {
    vadState.mediaRecorder.stop();
  }
}

/**
 * Stop listening and cleanup
 */
function stopListening(vadState) {
  vadState.isActive = false;

  if (vadState.mediaRecorder && vadState.mediaRecorder.state !== "inactive") {
    vadState.mediaRecorder.stop();
  }

  if (vadState.stream) {
    vadState.stream.getTracks().forEach((track) => track.stop());
  }
  // Listening stopped
}

// ============================================
// AUDIO FILE UPLOAD AND PROCESSING
// ============================================

/**
 * Process uploaded audio file and transcribe it
 *
 * @param {File} file - The uploaded audio file
 * @param {Function} onProgress - Progress callback: (percent) => void
 * @param {Function} onComplete - Completion callback: (transcript) => void
 * @param {Function} onError - Error callback: (error) => void
 * @returns {Promise<void>}
 *
 * @example
 * await processAudioFile(
 *   file,
 *   (percent) => console.log(`Progress: ${percent}%`),
 *   (transcript) => console.log('Done:', transcript),
 *   (error) => console.error('Error:', error)
 * );
 */
export async function processAudioFile(
  file,
  onProgress = null,
  onComplete = null,
  onError = null
) {
  if (!file) {
    const error = new Error("No file provided");
    if (onError) onError(error);
    return;
  }

  // Processing file (details suppressed)

  // UI UPDATE PLACEHOLDER
  if (onProgress) onProgress(0);

  try {
    // Read file
    const arrayBuffer = await readFileAsArrayBuffer(file);
    if (onProgress) onProgress(30);

    // Decode audio
    const audioData = await decodeAndResampleAudio(arrayBuffer);
    if (!audioData || audioData.length === 0) {
      throw new Error("Failed to decode audio file");
    }

    // Audio decoded (details suppressed)

    if (onProgress) onProgress(60);

    // Transcribe
    const transcript = await transcribeAudioFile(audioData);
    if (onProgress) onProgress(100);

    // UI UPDATE PLACEHOLDER
    if (transcript && transcript.trim()) {
      // File transcription complete (transcript not logged for privacy)
      if (onComplete) onComplete(transcript);
    } else {
      if (onComplete) onComplete("");
    }
  } catch (error) {
    console.error("❌ Error processing audio file:", error);
    if (onError) onError(error);
  }
}

/**
 * Read file as ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Transcribe entire audio file
 * @param {Float32Array} audioData - Complete audio data
 * @returns {Promise<string|null>}
 */
export async function transcribeAudioFile(audioData) {
  try {
    const featureResult = computeLogMelFeaturesJS(audioData);
    if (!featureResult) return null;

    const { features, nMels, numFrames } = featureResult;

    const inputTensor = new ort.Tensor("float32", features, [
      1,
      nMels,
      numFrames,
    ]);
    const featLensTensor = new ort.Tensor("int64", [BigInt(numFrames)], [1]);

    const feeds = {
      [STATE.sttSession.inputNames[0]]: inputTensor,
      [STATE.sttSession.inputNames[1]]: featLensTensor,
    };

    const results = await STATE.sttSession.run(feeds);
    const outputTensor = results[STATE.sttSession.outputNames[0]];
    const decodedInts = greedyDecodeJS(outputTensor);
    const transcript = intsToTextJS(decodedInts);

    return transcript || null;
  } catch (error) {
    console.error("❌ Error transcribing audio:", error);
    return null;
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  initialize,
  isInitialized,
  inferSTT,
  resetStreamingState,
  startRealTimeSTT,
  processAudioFile,
  transcribeAudioFile,
};
