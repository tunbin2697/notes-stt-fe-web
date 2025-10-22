/**
 * WASM-based log-mel spectrogram computation wrapper
 * Wraps mel.wasm for efficient audio feature extraction
 */

let melModule = null;

/**
 * Initialize the mel WASM module
 * @returns {Promise<void>}
 */
export async function initMel() {
  try {
    // Load the mel.js script if not already loaded
    if (!window.createMelModule) {
      // Dynamically load mel.js as a script
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/src/lib/mel.js";
        script.type = "text/javascript";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Wait a bit for the module to be available
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!window.createMelModule) {
      throw new Error(
        "createMelModule not found on window after loading mel.js"
      );
    }

    // Initialize the WASM module
    // Provide locateFile to help find mel.wasm in public folder
    melModule = await window.createMelModule({
      locateFile: (path) => {
        if (path.endsWith(".wasm")) {
          return `/mel-preprocess/${path}`;
        }
        return path;
      },
    });

    console.log("✅ mel.wasm loaded successfully");
    return melModule;
  } catch (error) {
    console.error("❌ Failed to load mel.wasm:", error);
    throw error;
  }
}

/**
 * Compute log-mel spectrogram from audio data
 * @param {Float32Array} audioFloat32Array - Audio samples (16kHz)
 * @returns {Object} - { data: Float32Array, shape: [T, n_mels] }
 */
export function computeLogMel(audioFloat32Array) {
  if (!melModule) {
    throw new Error("mel.wasm not loaded. Call initMel() first.");
  }

  try {
    // Call the WASM function exported via embind
    // The C++ function signature: compute_log_mel(emscripten::val audio_array)
    const result = melModule.compute_log_mel(audioFloat32Array);

    // Debug: log the result structure
    console.log("Mel result type:", typeof result);
    console.log("Mel result:", result);

    // Check if result is already a typed array
    if (result instanceof Float32Array || result instanceof Float64Array) {
      // Result is a flat array, assume shape [T, 80]
      const numSamples = audioFloat32Array.length;
      // Calculate T based on hop_length=160
      const T = Math.floor((numSamples - 512) / 160) + 1;
      return {
        data: new Float32Array(result),
        shape: [T, 80],
      };
    }

    // If result has data and shape properties
    if (result && result.data && result.shape) {
      return {
        data: new Float32Array(result.data),
        shape: result.shape,
      };
    }

    // If result is an object with size/length
    if (result && (result.size !== undefined || result.length !== undefined)) {
      const len = result.size || result.length;
      const data = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        data[i] = result[i] || 0;
      }
      const numSamples = audioFloat32Array.length;
      const T = Math.floor((numSamples - 512) / 160) + 1;
      return {
        data,
        shape: [T, 80],
      };
    }

    console.error("Unexpected mel result:", result);
    throw new Error("Unable to parse mel result from WASM module");
  } catch (error) {
    console.error("❌ Error computing log-mel:", error);
    throw error;
  }
}

/**
 * Check if mel module is initialized
 * @returns {boolean}
 */
export function isMelInitialized() {
  return melModule !== null;
}
