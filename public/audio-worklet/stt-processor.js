class STTProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs /*, outputs, parameters */) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Copy because the buffer provided by the audio thread may be reused.
      const channelData = input[0];
      const copy = new Float32Array(channelData.length);
      copy.set(channelData);

      // Transfer the underlying ArrayBuffer to the main thread to avoid an extra copy.
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }

    // Keep processor alive
    return true;
  }
}

registerProcessor("stt-processor", STTProcessor);
