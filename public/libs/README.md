This folder is intended to hold a browser-compatible build of the sherpa-onnx runtime (loader JS + .wasm).

## Why this is needed

- The npm package `sherpa-onnx` that you installed is a Node-targeted distribution and requires Node APIs (it contains an Emscripten "nodejs" wrapper). That package must not be bundled into browser client code.
- To run speech recognition directly in the browser you need a browser (WASM) distribution: a small JS loader that initializes the WASM runtime and exposes a global API (we expect `window.SherpaOnnx`).

## What files to put here

Place the following files in this folder (filenames are suggestions and must match what your loader expects):

- `sherpa-onnx-browser.js` — the JavaScript loader that initializes the WASM module and exposes a global (for example `window.SherpaOnnx`).
- `sherpa-onnx.wasm` — the compiled WebAssembly module used by the loader.

## What the loader must export (expected API)

Your browser loader should set a global object `window.SherpaOnnx` and expose at least the functions used by the client code. The minimal API shape expected by the service in this project is:

```js
// Example API surface expected by src/services/STT_service.jsx
window.SherpaOnnx = {
  // Create and return an OnlineRecognizer instance
  // args may include { modelPath: string, sampleRate: number, ... }
  createOnlineRecognizer: async (opts) => {
    // must return an object with methods: acceptWaveform(Float32Array|Int16Array),
    // partialResult() -> { text }, result() -> { text }, finalResult() -> { text }, reset()
  },

  // readWave(arrayBuffer) -> { sampleRate: number, samples: Float32Array }
  readWave: async (arrayBuffer) => {
    // decode wave bytes and return an object with `sampleRate` and `samples` (Float32Array)
  },
};
```

## How to obtain a browser build

There are two common options:

1. Download an official browser distribution (if the library authors publish one).

   - Look for a `browser` or `web` build under releases or the project's website. Download the loader JS and the corresponding `.wasm` file and copy them into this folder.

2. Build a browser distribution yourself from the `sherpa-onnx` source using Emscripten.

   - This requires setting up Emscripten and running the repo's build instructions for a browser target. The output is typically a JS loader and a `.wasm` file.

3. Alternative: run recognition on a Node/Server backend and send transcripts to the browser.

## After copying the loader and wasm here

- Your client code (in this project) will try to auto-load `/libs/sherpa-onnx-browser.js` when it doesn't find a browser global. If you place the loader file here and the loader sets `window.SherpaOnnx` with the API above, the TestRunner and STT service should start working.

If you need help producing or obtaining a browser build I can:

- add an HTML <script> snippet to `index.html` that loads the loader eagerly, or
- adjust the service to point to a different path or to provide a small demo loader template.

## Notes

- The names in your distribution may differ; if the loader sets a different global name, update `src/services/STT_service.jsx` to match it.
- Keep the `.wasm` file next to the loader so relative fetches in the loader succeed (many loaders fetch the wasm using a relative path).
