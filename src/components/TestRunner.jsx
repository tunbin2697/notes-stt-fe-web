import { useState } from "react";
import { transcribeWavUrl } from "../services/STT_service";

const TEST_WAV_BASE =
  "/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/test_wavs/";
const WAV_FILES = ["0.wav", "1.wav", "8k.wav"];

export default function TestRunner() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const append = (text) => setLogs((s) => [...s, text]);

  const runFile = async (name) => {
    setLogs([]);
    setRunning(true);
    try {
      await transcribeWavUrl(TEST_WAV_BASE + name, {
        chunkSizeMs: 200,
        simulateRealTime: true,
        onPartial: (p) => append("[partial] " + JSON.stringify(p)),
        onFinal: (t) =>
          append("[final] " + (typeof t === "string" ? t : JSON.stringify(t))),
      });
    } catch (e) {
      append("[error] " + String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="font-medium mb-2">STT Test Runner</h3>
      <div className="flex gap-2 mb-3">
        {WAV_FILES.map((f) => (
          <button
            key={f}
            onClick={() => runFile(f)}
            disabled={running}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Run {f}
          </button>
        ))}
      </div>

      <div className="h-40 overflow-auto p-2 bg-gray-100 rounded">
        {logs.map((l, i) => (
          <div key={i} className="text-sm font-mono text-gray-800">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
