// Do NOT statically import the `sherpa-onnx` npm package in client code.
// The npm package ships a Node-targeted build that uses Node APIs
// (fs/path). Bundling it into the browser causes runtime errors like
// "Cannot read properties of undefined (reading 'posix')".
//
// Instead, initRecognizer below will dynamically load the appropriate
// implementation at runtime: the npm package in Node environments, or a
// browser-friendly WASM build exposed on `window` (you must provide that
// browser build under `public/` and load it before calling initRecognizer).

const MODEL_PATH = "/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/";

// Use the actual filenames present in your public/models folder
const config = {
  featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: {
    transducer: {
      encoder: MODEL_PATH + "encoder-epoch-99-avg-1-chunk-16-left-128.onnx",
      decoder: MODEL_PATH + "decoder-epoch-99-avg-1-chunk-16-left-128.onnx",
      joiner: MODEL_PATH + "joiner-epoch-99-avg-1-chunk-16-left-128.onnx",
    },
    tokens: MODEL_PATH + "tokens.txt",
    numThreads: 1,
    provider: "webgl",
  },
  // add decode/VAD config here if needed
};

let recognizer = null;
let audioCtx = null;
let micStream = null;
let processor = null; // either AudioWorkletNode or ScriptProcessorNode
let workletNode = null;

/**
 * Initialize the OnlineRecognizer (async)
 */
// Small helper to load a script and wait for it to initialize a global.
function loadScript(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      // Already present: wait for the global to appear
      const start = Date.now();
      (function check() {
        if (window.SherpaOnnx || window.sherpaOnnxModule || window.sherpaOnnx)
          return resolve();
        if (Date.now() - start > timeout)
          return reject(new Error("timeout waiting for script"));
        setTimeout(check, 100);
      })();
      return;
    }

    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load " + url));
    document.head.appendChild(s);
    if (timeout)
      setTimeout(() => reject(new Error("timeout loading " + url)), timeout);
  });
}

export async function initRecognizer(options = {}) {
  if (recognizer) return recognizer;
  const cfg = { ...config, ...options };

  // Node / server environment: dynamically import the npm package
  if (typeof window === "undefined") {
    const pkg = await import("sherpa-onnx");
    if (pkg.createOnlineRecognizer) {
      recognizer = await pkg.createOnlineRecognizer(cfg);
      return recognizer;
    }
    if (pkg.default && pkg.default.createOnlineRecognizer) {
      recognizer = await pkg.default.createOnlineRecognizer(cfg);
      return recognizer;
    }
    if (pkg.OnlineRecognizer) {
      recognizer = new pkg.OnlineRecognizer(cfg);
      return recognizer;
    }
    throw new Error("sherpa-onnx: unexpected Node package shape");
  }

  // Browser environment: try existing global, otherwise try to auto-load a
  // browser bundle from /libs/sherpa-onnx-browser.js (place the loader + wasm
  // in public/libs/ so it's served at that path).
  let globalSherpa =
    window.SherpaOnnx || window.sherpaOnnxModule || window.sherpaOnnx || null;
  if (!globalSherpa) {
    try {
      await loadScript("/libs/sherpa-onnx-browser.js", 15000);
      globalSherpa =
        window.SherpaOnnx ||
        window.sherpaOnnxModule ||
        window.sherpaOnnx ||
        null;
    } catch (e) {
      throw new Error(
        [
          "sherpa-onnx: browser build not found and auto-load failed.",
          `Tried to load '/libs/sherpa-onnx-browser.js' and got: ${e.message}.`,
          "Please place a browser-compatible WASM distribution under /public and load it so it sets window.SherpaOnnx.",
        ].join(" ")
      );
    }
  }

  if (
    globalSherpa &&
    typeof globalSherpa.createOnlineRecognizer === "function"
  ) {
    recognizer = await globalSherpa.createOnlineRecognizer(cfg);
    return recognizer;
  }

  if (
    globalSherpa &&
    globalSherpa.default &&
    typeof globalSherpa.default.createOnlineRecognizer === "function"
  ) {
    recognizer = await globalSherpa.default.createOnlineRecognizer(cfg);
    return recognizer;
  }

  if (globalSherpa && typeof globalSherpa.OnlineRecognizer === "function") {
    recognizer = new globalSherpa.OnlineRecognizer(cfg);
    return recognizer;
  }

  throw new Error(
    "sherpa-onnx: unexpected browser build API. Check the distribution you loaded."
  );
}

/**
 * Resample a Float32Array chunk to targetSampleRate using OfflineAudioContext.
 * Returns Float32Array at targetSampleRate.
 */
async function resampleChunk(float32Chunk, srcSampleRate, targetSampleRate) {
  if (srcSampleRate === targetSampleRate) return float32Chunk;
  const lengthTarget = Math.round(
    (float32Chunk.length * targetSampleRate) / srcSampleRate
  );
  const offlineCtx = new OfflineAudioContext(1, lengthTarget, targetSampleRate);
  const buffer = offlineCtx.createBuffer(1, float32Chunk.length, srcSampleRate);
  buffer.copyToChannel(float32Chunk, 0);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Start microphone capture and feed audio to recognizer.
 * onPartial/onFinal are optional callbacks receiving recognition text.
 */
export async function startRecognition({ onPartial, onFinal } = {}) {
  if (!recognizer) await initRecognizer();

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micStream = audioCtx.createMediaStreamSource(stream);

  // Prefer AudioWorklet (non-deprecated, runs on audio thread)
  if (audioCtx.audioWorklet) {
    try {
      // stt-processor.js is served from public/audio-worklet/
      await audioCtx.audioWorklet.addModule("/audio-worklet/stt-processor.js");
      workletNode = new AudioWorkletNode(audioCtx, "stt-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });

      // Handle incoming raw Float32Array buffers from the audio worklet
      workletNode.port.onmessage = async (evt) => {
        // evt.data is an ArrayBuffer transferred from the worklet
        const floatBuffer = new Float32Array(evt.data);
        const chunk =
          audioCtx.sampleRate === 16000
            ? floatBuffer
            : await resampleChunk(floatBuffer, audioCtx.sampleRate, 16000);

        try {
          recognizer.acceptWaveform(chunk);

          if (typeof recognizer.partialResult === "function") {
            const partial = recognizer.partialResult();
            if (partial && onPartial) onPartial(partial);
          }
          if (typeof recognizer.result === "function") {
            const res = recognizer.result();
            if (res && res.text && onFinal) onFinal(res.text);
          }
        } catch (e) {
          console.error("Recognizer error:", e);
        }
      };

      // Connect mic -> worklet. No need to connect worklet to destination since it has no outputs.
      micStream.connect(workletNode);
      // keep a reference for cleanup
      processor = workletNode;
    } catch (e) {
      console.warn(
        "AudioWorklet failed, falling back to ScriptProcessorNode:",
        e
      );
    }
  }

  // Fallback: ScriptProcessorNode if AudioWorklet not available or failed
  if (!processor) {
    const bufferSize = 4096;
    processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = async (evt) => {
      const input = evt.inputBuffer.getChannelData(0); // Float32Array
      const chunk =
        audioCtx.sampleRate === 16000
          ? input.slice(0)
          : await resampleChunk(input, audioCtx.sampleRate, 16000);

      try {
        recognizer.acceptWaveform(chunk);

        if (typeof recognizer.partialResult === "function") {
          const partial = recognizer.partialResult();
          if (partial && onPartial) onPartial(partial);
        }
        if (typeof recognizer.result === "function") {
          const res = recognizer.result();
          if (res && res.text && onFinal) onFinal(res.text);
        }
      } catch (e) {
        console.error("Recognizer error:", e);
      }
    };

    micStream.connect(processor);
    // connect to destination to keep it alive (ScriptProcessor requires connection)
    processor.connect(audioCtx.destination);
  }
}

// Helper: sleep for ms
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Transcribe a WAV file available via URL by decoding it, resampling to 16k if needed,
 * and streaming it in chunks into the recognizer (simulates live audio).
 *
 * url - absolute or relative URL to the WAV file (served by Vite from /public)
 * options: { chunkSizeMs = 200, simulateRealTime = true, onPartial, onFinal }
 */
export async function transcribeWavUrl(
  url,
  { chunkSizeMs = 200, simulateRealTime = true, onPartial, onFinal } = {}
) {
  if (!recognizer) await initRecognizer();

  // Fetch the file
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();

  // Decode using a temporary AudioContext
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      decodeCtx.close();
    } catch (e) {}
  }

  const srcSampleRate = audioBuffer.sampleRate;
  const channelData =
    audioBuffer.numberOfChannels > 0
      ? audioBuffer.getChannelData(0)
      : new Float32Array();

  // Resample to 16000 if needed
  const data16k =
    srcSampleRate === 16000
      ? channelData
      : await resampleChunk(channelData, srcSampleRate, 16000);

  const samplesPerChunk = Math.max(
    256,
    Math.floor((16000 * chunkSizeMs) / 1000)
  );

  for (let offset = 0; offset < data16k.length; offset += samplesPerChunk) {
    const end = Math.min(offset + samplesPerChunk, data16k.length);
    // Copy chunk to avoid passing views of a large underlying buffer
    const chunk = new Float32Array(data16k.subarray(offset, end));

    try {
      recognizer.acceptWaveform(chunk);

      if (typeof recognizer.partialResult === "function") {
        const partial = recognizer.partialResult();
        if (partial && onPartial) onPartial(partial);
      }
      if (typeof recognizer.result === "function") {
        const res = recognizer.result();
        if (res && res.text && onFinal) onFinal(res.text);
      }
    } catch (e) {
      console.error("Recognizer error while streaming file:", e);
      throw e;
    }

    if (simulateRealTime) await sleep(chunkSizeMs);
  }

  // Optionally finalize
  if (recognizer && typeof recognizer.finalResult === "function") {
    const final = recognizer.finalResult();
    if (final && final.text && onFinal) onFinal(final.text);
    return final;
  }

  return null;
}

/**
 * Stop recognition and release microphone
 */
export function stopRecognition() {
  try {
    if (processor) {
      // If it's a worklet node, disconnect its port & node
      try {
        if (workletNode && workletNode.port) {
          workletNode.port.onmessage = null;
        }
      } catch (e) {
        // ignore
      }

      try {
        processor.disconnect();
      } catch (e) {
        // ignore
      }

      if (processor.onaudioprocess) processor.onaudioprocess = null;
      processor = null;
      workletNode = null;
    }
    if (micStream) {
      try {
        micStream.disconnect();
      } catch (e) {}
      micStream = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    // If recognizer needs explicit finalize/flush, call here:
    if (recognizer && typeof recognizer.finalResult === "function") {
      const final = recognizer.finalResult();
      console.log("final result", final);
    }
  } catch (e) {
    console.warn("Error stopping recognition", e);
  }
}
