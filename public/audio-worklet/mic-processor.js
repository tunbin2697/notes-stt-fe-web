class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._lastTime = 0;
    this._interval = 500; // ms
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      // Flatten and buffer samples
      this._buffer.push(...input[0]);
      const now = currentTime * 1000;
      if (now - this._lastTime >= this._interval) {
        this._lastTime = now;
        // Send chunk to main thread
        const chunk = new Float32Array(this._buffer);
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this._buffer = [];
      }
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
