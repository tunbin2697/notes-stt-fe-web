import { startMic, stopMic } from "@/services/AudioContext";

export default function Test() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Test Page</h1>
      <p className="text-gray-700">
        This is a test page for various components.
      </p>
      <button
        onClick={() =>
          startMic((chunk) => {
            console.log("Mic chunk:", chunk);
          })
        }
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Start Mic
      </button>
      <button
        onClick={stopMic}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Stop Mic
      </button>
    </div>
  );
}
