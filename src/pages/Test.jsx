import { useState, useEffect } from "react";

export default function Test() {
  const [response, setResponse] = useState("Đang tải Pyodide và thư viện...");
  const [pyodide, setPyodide] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Hàm Khởi tạo Pyodide
  async function initializePyodide() {
    console.log("Đang tải Pyodide và thư viện...");
    setResponse("Đang tải Pyodide và numpy...");

    try {
      // Tải Pyodide
      const pyodideInstance = await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
      });

      // Tải numpy và scipy (scipy có signal processing utilities)
      await pyodideInstance.loadPackage(["numpy", "scipy"]);

      console.log("Pyodide và numpy đã sẵn sàng.");

      // 2. Định nghĩa hàm Python Feature Engineering
      // Sử dụng numpy và scipy để tạo Mel Spectrogram thủ công
      await pyodideInstance.runPython(`
        import numpy as np
        from scipy import signal
        from scipy.fft import rfft

        # Tham số cho Feature Engineering
        SAMPLE_RATE = 16000     # Tần số lấy mẫu tiêu chuẩn cho STT
        N_MELS = 80             # Số lượng Mel band (tiêu chuẩn)
        N_FFT = 2048            # FFT window size
        HOP_LENGTH = 512        # Kích thước bước nhảy
        FMIN = 0                # Tần số min
        FMAX = 8000             # Tần số max (SAMPLE_RATE / 2)

        def hz_to_mel(hz):
            """Chuyển đổi Hz sang Mel scale"""
            return 2595 * np.log10(1 + hz / 700)

        def mel_to_hz(mel):
            """Chuyển đổi Mel scale sang Hz"""
            return 700 * (10**(mel / 2595) - 1)

        def create_mel_filterbank(n_mels, n_fft, sr, fmin, fmax):
            """Tạo Mel filterbank"""
            # Tính toán các điểm Mel
            mel_min = hz_to_mel(fmin)
            mel_max = hz_to_mel(fmax)
            mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
            hz_points = mel_to_hz(mel_points)
            
            # Chuyển Hz sang FFT bins
            bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)
            
            # Tạo filterbank
            fbank = np.zeros((n_mels, n_fft // 2 + 1))
            for m in range(1, n_mels + 1):
                f_left = bin_points[m - 1]
                f_center = bin_points[m]
                f_right = bin_points[m + 1]
                
                # Triangle filter
                for k in range(f_left, f_center):
                    fbank[m - 1, k] = (k - f_left) / (f_center - f_left)
                for k in range(f_center, f_right):
                    fbank[m - 1, k] = (f_right - k) / (f_right - f_center)
            
            return fbank

        def extract_log_mel(audio_data):
            """
            Input: Mảng numpy (dạng sóng thô)
            Output: Log Mel Spectrogram (mảng numpy)
            """
            # 1. STFT (Short-Time Fourier Transform)
            f, t, Zxx = signal.stft(audio_data, fs=SAMPLE_RATE, 
                                     nperseg=N_FFT, noverlap=N_FFT-HOP_LENGTH)
            
            # 2. Power spectrogram
            power_spec = np.abs(Zxx) ** 2
            
            # 3. Tạo Mel filterbank
            mel_basis = create_mel_filterbank(N_MELS, N_FFT, SAMPLE_RATE, FMIN, FMAX)
            
            # 4. Áp dụng Mel filterbank
            mel_spec = np.dot(mel_basis, power_spec)
            
            # 5. Chuyển sang log scale (dB)
            log_mel = 10 * np.log10(mel_spec + 1e-10)  # Tránh log(0)
            
            # 6. Transpose để có định dạng (time_steps, n_mels)
            log_mel = log_mel.T
            
            return log_mel
      `);

      setPyodide(pyodideInstance);
      setIsLoading(false);
      setResponse("Pyodide đã sẵn sàng! Nhấn nút để chạy Feature Engineering.");
    } catch (error) {
      console.error("Lỗi khi tải Pyodide:", error);
      setResponse(`Lỗi khi tải Pyodide: ${error.message}`);
      setIsLoading(false);
    }
  }

  // 3. Hàm được gọi khi nhấn nút
  async function runPythonFunction() {
    if (!pyodide) {
      setResponse("Pyodide chưa tải xong, vui lòng chờ.");
      return;
    }

    setResponse("Đang xử lý feature...");

    // --- 3a. Chuẩn bị Dữ liệu Âm thanh Giả lập (Waveform) ---
    const SAMPLE_RATE = 16000;
    const DURATION = 2; // 2 giây âm thanh
    const numSamples = SAMPLE_RATE * DURATION;

    // Tạo mảng Float32Array giả lập cho 2 giây âm thanh (ví dụ: một sóng sin đơn giản)
    const audioDataJS = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      // Tạo sóng sin đơn giản ở 440 Hz để có dữ liệu thử nghiệm
      audioDataJS[i] = Math.sin(2 * Math.PI * 440 * (i / SAMPLE_RATE));
    }

    let result = "Lỗi";
    let logMelOutput = null;

    try {
      // --- 3b. Truyền Dữ liệu từ JS sang Python (numpy array) ---
      // Biến đổi Float32Array (JS) thành mảng Numpy (Python)
      pyodide.globals.set("audio_data_js", audioDataJS);
      await pyodide.runPython(`
        # Đảm bảo dữ liệu là mảng numpy Float32
        audio_data_np = np.asarray(audio_data_js, dtype=np.float32)
      `);

      // --- 3c. Gọi Hàm Python Feature Engineering ---
      const pythonFunction = pyodide.globals.get("extract_log_mel");

      // Gọi hàm Python với dữ liệu numpy đã tạo
      // Kết quả trả về là một đối tượng PyProxy trỏ đến mảng numpy Log Mel
      const logMelPyProxy = pyodide.globals.get("extract_log_mel")(
        pyodide.globals.get("audio_data_np")
      );

      // --- 3d. Truyền Dữ liệu Feature từ Python sang JS (Nếu cần) ---
      // Lưu ý: Việc này có thể tốn thời gian.
      // Tốt nhất là đưa PyProxy này trực tiếp vào model TF.js nếu có thể.

      // Chuyển PyProxy thành mảng JS thông thường để kiểm tra
      logMelOutput = logMelPyProxy.toJs();

      // Hiển thị kích thước mảng (shape)
      const rows = logMelOutput.length;
      const cols = logMelOutput[0] ? logMelOutput[0].length : 0;

      result = `✅ Trích xuất feature thành công!
Kích thước Log Mel (Time Steps, N_Mels): (${rows}, ${cols})
Giá trị tối đa: ${Math.max(...logMelOutput.flat()).toFixed(3)}
Giá trị tối thiểu: ${Math.min(...logMelOutput.flat()).toFixed(3)}`;

      // Dọn dẹp các biến toàn cục trong Python
      pyodide.runPython(`
        del audio_data_js
        del audio_data_np
      `);
    } catch (error) {
      console.error("Lỗi khi chạy Python Feature Engineering:", error);
      result = `Đã xảy ra lỗi: ${error.message}`;
    }

    // 4. Hiển thị kết quả lên giao diện
    setResponse(result);
  }

  // 5. Thiết lập Event Listener (nghe sự kiện)
  useEffect(() => {
    initializePyodide();
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        🎵 Audio Feature Engineering Test
      </h1>

      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <button
          onClick={runPythonFunction}
          disabled={isLoading}
          className={`w-full px-6 py-3 text-white rounded-lg transition ${
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLoading ? "Đang tải thư viện..." : "Chạy Feature Engineering"}
        </button>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Kết quả:</h2>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {response}
          </pre>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            ℹ️ Thông tin:
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Tần số lấy mẫu: 16000 Hz</li>
            <li>• Số Mel bands: 80</li>
            <li>• Hop length: 512</li>
            <li>• Âm thanh test: 2 giây sóng sin 440 Hz</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
