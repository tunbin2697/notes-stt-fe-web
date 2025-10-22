/**
 * Real-time Speech-to-Text Recorder Component
 * Captures microphone input and performs streaming STT inference
 */

import { useEffect, useState, useRef } from "react";
import { computeLogMel } from "../lib/melWrapper";
import { runSTT, ctcGreedyDecode, postProcessText } from "../lib/sttEngine";

const SAMPLE_RATE = 16000;
const CHUNK_DURATION = 0.5; // Process every 500ms
const CHUNK_SIZE = SAMPLE_RATE * CHUNK_DURATION;
const N_MELS = 80;

export default function Recorder() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const bufferRef = useRef([]);

  // Start recording
  const startRecording = async () => {
    try {
      setError("");
      setStatus("Starting...");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create audio context
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });

      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create script processor (4096 buffer size)
      processorRef.current = audioContextRef.current.createScriptProcessor(
        4096,
        1,
        1
      );

      processorRef.current.onaudioprocess = async (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        bufferRef.current.push(...inputData);

        // Process when we have enough audio (~500ms)
        if (bufferRef.current.length >= CHUNK_SIZE) {
          const chunk = new Float32Array(
            bufferRef.current.splice(0, CHUNK_SIZE)
          );

          try {
            await processAudioChunk(chunk);
          } catch (err) {
            console.error("Processing error:", err);
            setError(`Processing error: ${err.message}`);
          }
        }
      };

      // Connect audio nodes
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setListening(true);
      setStatus("Listening...");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(`Failed to start: ${err.message}`);
      setStatus("Error");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    bufferRef.current = [];
    setListening(false);
    setStatus("Stopped");
  };

  // Process audio chunk through STT pipeline
  const processAudioChunk = async (audioChunk) => {
    setStatus("Processing...");

    try {
      // 1. Compute log-mel spectrogram using WASM
      const melResult = computeLogMel(audioChunk);

      // melResult should be shape [T, 80] - we need [1, 80, T]
      // Assuming melResult returns a flat array, we need to reshape it
      let melData, timeSteps;

      if (melResult.data && melResult.shape) {
        // Structured result
        melData = melResult.data;
        timeSteps = melResult.shape[0]; // [T, n_mels]
      } else if (Array.isArray(melResult)) {
        // Flat array result
        melData = new Float32Array(
          melResult.flat ? melResult.flat() : melResult
        );
        timeSteps = Math.floor(melData.length / N_MELS);
      } else {
        throw new Error("Unexpected mel result format");
      }

      // Transpose to [1, 80, T] if needed
      const melTransposed = new Float32Array(N_MELS * timeSteps);
      for (let t = 0; t < timeSteps; t++) {
        for (let m = 0; m < N_MELS; m++) {
          melTransposed[m * timeSteps + t] = melData[t * N_MELS + m];
        }
      }

      // 2. Run STT inference
      const logits = await runSTT(melTransposed, [1, N_MELS, timeSteps]);

      // 3. Decode CTC output
      const partialText = ctcGreedyDecode(logits);
      const cleanedText = postProcessText(partialText);

      // 4. Append to transcript
      if (cleanedText) {
        setText((prev) => prev + (prev ? " " : "") + cleanedText);
      }

      setStatus("Listening...");
    } catch (err) {
      console.error("Audio processing error:", err);
      throw err;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const toggleRecording = () => {
    if (listening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearText = () => {
    setText("");
    setError("");
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      {/* Status Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              listening ? "bg-red-500 animate-pulse" : "bg-gray-300"
            }`}
          />
          <span className="text-sm font-medium text-gray-700">{status}</span>
        </div>

        {listening && (
          <span className="text-xs text-gray-500">🎤 Recording...</span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={toggleRecording}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
            listening
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {listening ? "⏸ Stop Recording" : "🎤 Start Recording"}
        </button>

        <button
          onClick={clearText}
          disabled={!text && !error}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🗑 Clear
        </button>
      </div>

      {/* Transcript Display */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[200px]">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">
          📝 Transcript:
        </h3>
        <div className="text-gray-800 whitespace-pre-wrap break-words">
          {text || (
            <span className="text-gray-400 italic">
              Start recording to see transcription...
            </span>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-700">
          ℹ️ Using WASM feature extraction + ONNX Runtime for real-time STT
          inference
        </p>
      </div>
    </div>
  );
}
