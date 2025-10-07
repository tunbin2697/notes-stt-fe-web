// Microphone control and raw audio chunk streaming
let audioContext = null;
let micStream = null;
let sourceNode = null;
let processorNode = null;
let chunkCallback = null;
let chunkIntervalMs = 200;

// Start microphone and stream raw audio chunks every chunkIntervalMs
export async function startMic(onChunk) {
  if (audioContext) return; // already running
  chunkCallback = onChunk;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    sourceNode = audioContext.createMediaStreamSource(micStream);
    // Load AudioWorklet processor
    await audioContext.audioWorklet.addModule(
      "/audio-worklet/mic-processor.js"
    );
    processorNode = new AudioWorkletNode(audioContext, "mic-processor");
    processorNode.port.onmessage = (event) => {
      // event.data is an ArrayBuffer containing Float32Array samples
      const chunk = new Float32Array(event.data);
      if (chunkCallback) chunkCallback(chunk);
    };
    sourceNode.connect(processorNode);
    // Optionally: processorNode.connect(audioContext.destination); // if you want to hear yourself
    console.log(
      "Microphone started. Streaming raw audio chunks every",
      chunkIntervalMs,
      "ms (AudioWorklet)."
    );
  } catch (err) {
    console.error("Microphone access denied or error:", err);
    alert("Could not get microphone access. Check your browser permissions.");
  }
}

// Stop microphone and audio processing (mute)
export function stopMic() {
  if (processorNode) {
    try {
      processorNode.disconnect();
    } catch (e) {}
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (e) {}
    sourceNode = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {}
    audioContext = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  chunkCallback = null;
  console.log("Microphone stopped (muted).");
}

// Meyda placeholder for future MFCC extraction
// TODO: In future, use Meyda to process each 200ms chunk and extract MFCCs for speech-to-text preprocessing.
// Example (not yet wired):
// import Meyda from "meyda";
// let meydaAnalyzer = Meyda.createMeydaAnalyzer({
//   audioContext,
//   source: sourceNode,
//   bufferSize: 512,
//   featureExtractors: ["mfcc"],
//   numberOfMFCCCoefficients: 13,
//   callback: (features) => {
//     const mfccs = features.mfcc;
//     if (mfccs) {
//       // Use MFCCs for STT preprocessing
//     }
//   },
// });
// meydaAnalyzer.start();

// What this version does:
// - Provides startMic(onChunk) and stopMic() to control microphone mute/unmute.
// - Streams raw audio chunks (Float32Array) every 200ms to the callback.
// - Placeholder for future Meyda MFCC extraction (see above).
