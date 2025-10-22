import { useState, useEffect } from "react";
import { initMel, isMelInitialized } from "../lib/melWrapper";
import { initSTT, isSTTInitialized } from "../lib/sttEngine";
import Recorder from "../components/Recorder";

export default function Test() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [error, setError] = useState("");
  const [melLoaded, setMelLoaded] = useState(false);
  const [sttLoaded, setSTTLoaded] = useState(false);

  // Initialize WASM and ONNX models on mount
  useEffect(() => {
    async function initialize() {
      try {
        setLoadingStatus("Loading mel.wasm...");
        await initMel();
        setMelLoaded(true);
        console.log("✅ Mel extractor ready");

        setLoadingStatus("Loading STT ONNX model...");
        await initSTT();
        setSTTLoaded(true);
        console.log("✅ STT model ready");

        setLoadingStatus("Ready!");
        setIsLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        setError(`Failed to initialize: ${err.message}`);
        setLoadingStatus("Error");
        setIsLoading(false);
      }
    }

    initialize();
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        � Real-time Speech-to-Text
      </h1>
      <p className="text-sm text-gray-600 mb-8">
        WASM Feature Extraction + ONNX Runtime Inference
      </p>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">{loadingStatus}</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>mel.wasm</span>
              <span className={melLoaded ? "text-green-600" : "text-gray-400"}>
                {melLoaded ? "✓" : "○"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>STT ONNX model</span>
              <span className={sttLoaded ? "text-green-600" : "text-gray-400"}>
                {sttLoaded ? "✓" : "○"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center text-red-600 mb-4">
            <p className="text-xl font-bold">❌ Initialization Error</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Reload Page
          </button>
        </div>
      )}

      {/* Main Recorder Interface */}
      {!isLoading && !error && (
        <>
          <Recorder />

          <div className="mt-8 max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              ℹ️ System Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-gray-600">
                  <strong>Sample Rate:</strong> 16000 Hz
                </p>
                <p className="text-gray-600">
                  <strong>Mel Bands:</strong> 80
                </p>
                <p className="text-gray-600">
                  <strong>Chunk Duration:</strong> 500ms
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-600">
                  <strong>Feature Extractor:</strong> WASM
                </p>
                <p className="text-gray-600">
                  <strong>Inference:</strong> ONNX Runtime
                </p>
                <p className="text-gray-600">
                  <strong>Decoder:</strong> Greedy CTC
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-2xl w-full bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">
              📌 Tips for Best Results:
            </h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Speak clearly and at a normal pace</li>
              <li>• Keep background noise to a minimum</li>
              <li>• Allow microphone permissions when prompted</li>
              <li>• Processing happens in real-time every 500ms</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
