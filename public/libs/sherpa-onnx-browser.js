// Example shim for a browser build of sherpa-onnx.
// This file is a template and NOT a working implementation. It demonstrates
// the minimal global API `src/services/STT_service.jsx` expects.
//
// To use a real browser build, replace this with the loader JS that initializes
// the actual WASM runtime (and make sure it sets window.SherpaOnnx).

(function () {
  if (window.SherpaOnnx) return; // already present

  // Minimal, non-functional stub just to show the expected API surface.
  // A real loader would fetch and instantiate a .wasm and provide real
  // implementations of these functions.
  window.SherpaOnnx = {
    async createOnlineRecognizer(opts = {}) {
      console.warn(
        "sherpa-onnx: using example stub createOnlineRecognizer. Replace with a real browser build."
      );

      // Simple in-memory recognizer stub that echoes silence
      let buffer = [];

      return {
        acceptWaveform(chunk) {
          // push samples - no-op in stub
          buffer.push(chunk instanceof Float32Array ? chunk.slice(0) : chunk);
        },
        partialResult() {
          return { text: "" };
        },
        result() {
          return { text: "" };
        },
        finalResult() {
          return { text: "" };
        },
        reset() {
          buffer = [];
        },
      };
    },

    async readWave(arrayBuffer) {
      // Attempt to decode PCM/WAV headers in the simplest way. For real use,
      // your loader probably exposes a readWave or you can use WebAudio API.
      try {
        const audioCtx = new (window.OfflineAudioContext ||
          window.webkitOfflineAudioContext)(1, 1, 16000);
        // We can't decode offline without a proper AudioContext in some browsers.
      } catch (e) {
        // Fallback return: empty samples
      }
      return { sampleRate: 16000, samples: new Float32Array(0) };
    },
  };
})();

// Usage: keep this file at public/libs/sherpa-onnx-browser.js during development
// to prevent the auto-loader error. Replace it with a real loader + wasm to get
// actual recognition results.
