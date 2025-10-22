/**
 * STT Engine - ONNX Runtime Web for Speech-to-Text inference
 * Handles model loading, inference, and CTC decoding
 */

import * as ort from "onnxruntime-web";

let session = null;

// CTC vocabulary - adjust based on your model's training vocabulary
const VOCAB = " abcdefghijklmnopqrstuvwxyz'";
const BLANK_TOKEN = "_"; // CTC blank token

/**
 * Initialize the STT ONNX model
 * @returns {Promise<void>}
 */
export async function initSTT() {
  try {
    // Configure ONNX Runtime to use WASM from node_modules via Vite
    // Vite will automatically serve files from node_modules
    ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    console.log("Loading STT model from /stt-model/stt_model.onnx...");

    // Load the ONNX model from public folder
    // Use fetch to ensure the file exists and get better error messages
    const modelPath = "/stt-model/stt_model.onnx";
    const response = await fetch(modelPath);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch model file: ${response.status} ${response.statusText}. Make sure stt_model.onnx exists in public/stt-model/`
      );
    }

    const modelArrayBuffer = await response.arrayBuffer();

    if (modelArrayBuffer.byteLength === 0) {
      throw new Error("Model file is empty");
    }

    console.log(`Model file loaded: ${modelArrayBuffer.byteLength} bytes`);
    const modelUint8Array = new Uint8Array(modelArrayBuffer);

    session = await ort.InferenceSession.create(modelUint8Array, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });

    console.log("✅ STT ONNX model loaded successfully");
    console.log("Model inputs:", session.inputNames);
    console.log("Model outputs:", session.outputNames);
  } catch (error) {
    console.error("❌ Failed to load STT model:", error);
    throw error;
  }
}

/**
 * Run STT inference on mel spectrogram
 * @param {Float32Array} melData - Mel spectrogram data (flat array)
 * @param {Array<number>} shape - Shape [batch=1, n_mels=80, T]
 * @returns {Promise<Float32Array>} - CTC log probabilities
 */
export async function runSTT(melData, shape) {
  if (!session) {
    throw new Error("STT session not initialized. Call initSTT() first.");
  }

  try {
    const [batch, nMels, timeSteps] = shape;

    // Create input tensors
    const melTensor = new ort.Tensor("float32", melData, shape);
    const featLengthsTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from([BigInt(timeSteps)]),
      [1]
    );

    // Prepare inputs based on model's expected input names
    const inputs = {
      feats: melTensor,
      feat_lens: featLengthsTensor,
    };

    // Run inference
    const outputs = await session.run(inputs);

    // Get log probabilities output
    const logProbs = outputs["log_probs"] || outputs[session.outputNames[0]];

    return logProbs.data;
  } catch (error) {
    console.error("❌ STT inference error:", error);
    throw error;
  }
}

/**
 * Greedy CTC decoder - simple best path decoding
 * @param {Float32Array|Array} logits - Raw CTC logits [T * vocab_size]
 * @param {number} vocabSize - Size of vocabulary (default: VOCAB.length)
 * @returns {string} - Decoded text
 */
export function ctcGreedyDecode(logits, vocabSize = VOCAB.length) {
  const T = Math.floor(logits.length / vocabSize);
  let decoded = "";
  let prevChar = BLANK_TOKEN;

  for (let t = 0; t < T; t++) {
    // Get slice for this timestep
    const startIdx = t * vocabSize;
    const endIdx = startIdx + vocabSize;
    const slice = Array.from(logits.slice(startIdx, endIdx));

    // Find max probability index
    const maxIdx = slice.indexOf(Math.max(...slice));
    const char = VOCAB[maxIdx] || BLANK_TOKEN;

    // CTC collapse: skip blank and repeated characters
    if (char !== BLANK_TOKEN && char !== prevChar) {
      decoded += char;
    }

    prevChar = char;
  }

  return decoded;
}

/**
 * Post-process decoded text
 * @param {string} text - Raw decoded text
 * @returns {string} - Cleaned text
 */
export function postProcessText(text) {
  return text
    .trim()
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/^\s*|\s*$/g, ""); // Trim edges
}

/**
 * Check if STT engine is initialized
 * @returns {boolean}
 */
export function isSTTInitialized() {
  return session !== null;
}
