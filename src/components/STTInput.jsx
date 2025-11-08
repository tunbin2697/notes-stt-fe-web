import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { CORRECT_TEXT } from "@/graphql/mutations";
import STTCore from "@/services/STTCoreService.js";

const STREAM_OVERLAP_MS = 200;

function stripOverlappingPrefix(existing, addition) {
  if (!existing) {
    return addition;
  }

  const normalizedExisting = existing.toLowerCase();
  const normalizedAddition = addition.toLowerCase();
  const maxOverlap = Math.min(60, addition.length, existing.length);

  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const existingSuffix = normalizedExisting.slice(
      normalizedExisting.length - overlap
    );
    const additionPrefix = normalizedAddition.slice(0, overlap);

    if (existingSuffix === additionPrefix) {
      return addition.slice(overlap).replace(/^\s+/, "");
    }
  }

  return addition;
}

/**
 * STTInput - Speech-to-Text Input Component
 *
 * Features:
 * - Real-time microphone recording with voice activity detection
 * - Audio file upload for transcription
 * - Visual feedback (recording status)
 * - Automatic appending of transcripts to note content
 * - Integrates with existing textarea/input fields
 */
export default function STTInput({
  value,
  onChange,
  placeholder = "Type or use microphone...",
  className = "",
  rows = 4,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volumeThreshold, setVolumeThreshold] = useState(-50);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [recentCorrection, setRecentCorrection] = useState(null);
  const [correctionWarning, setCorrectionWarning] = useState(null);

  const [correctTextMutation] = useMutation(CORRECT_TEXT);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const stopRecordingRef = useRef(null);
  const valueRef = useRef(value); // Keep a ref to always have the latest value
  const settingsRef = useRef(null);
  const segmentsRef = useRef([]);
  const segmentIdRef = useRef(0);
  const sessionSegmentIdsRef = useRef([]);
  const correctionHighlightTimeoutRef = useRef(null);

  // Update ref when value changes
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Close settings popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  // Initialize STT service once on mount
  useEffect(() => {
    let mounted = true;

    const initializeSTT = async () => {
      if (STTCore.isInitialized()) {
        setIsInitialized(true);
        return;
      }

      try {
        // Initialize the consolidated STT Core service
        await STTCore.initialize();

        if (!mounted) return;

        setIsInitialized(true);
        console.log("✅ STT Core initialized");
      } catch (err) {
        if (!mounted) return;
        console.error("Failed to initialize STT service:", err);
        setError("Speech recognition unavailable: " + err.message);
      }
    };

    initializeSTT();

    return () => {
      mounted = false;
      // Cleanup on unmount
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
        stopRecordingRef.current = null;
      }
      setIsInitialized(false);
      if (correctionHighlightTimeoutRef.current) {
        clearTimeout(correctionHighlightTimeoutRef.current);
        correctionHighlightTimeoutRef.current = null;
      }
    };
  }, []);

  const requestCorrection = useCallback(
    async (text) => {
      const cleaned = text?.trim();
      if (!cleaned) return cleaned;

      try {
        const { data } = await correctTextMutation({
          variables: { text: cleaned },
          context: {
            timeout: 15000, // 15 second timeout for correction
          },
        });

        const corrected = data?.correctText?.corrected;
        return typeof corrected === "string" && corrected.trim()
          ? corrected.trim()
          : cleaned;
      } catch (err) {
        console.error("Correction request failed:", err);
        // Don't set main error, just show warning
        setCorrectionWarning(
          "Text correction unavailable. Showing original transcript."
        );
        // Clear warning after 5 seconds
        setTimeout(() => setCorrectionWarning(null), 5000);
        return cleaned;
      }
    },
    [correctTextMutation]
  );

  const applyCorrectionToSegments = useCallback(
    (segmentIds, correctedText) => {
      if (!segmentIds?.length || !correctedText) return;

      const currentSegments = segmentsRef.current;
      if (!currentSegments.length) return;

      const indexes = [];
      currentSegments.forEach((segment, index) => {
        if (segmentIds.includes(segment.id)) {
          indexes.push(index);
        }
      });

      if (!indexes.length) return;

      const firstIndex = Math.min(...indexes);
      const count = indexes.length;
      const windowSegments = currentSegments.slice(
        firstIndex,
        firstIndex + count
      );
      const originalCombinedText = windowSegments
        .map((segment) => segment.text)
        .join("");

      const currentValue = valueRef.current || "";
      const matchIndex = currentValue.lastIndexOf(originalCombinedText);
      if (matchIndex === -1) {
        return;
      }

      const before = currentValue.slice(0, matchIndex);
      const after = currentValue.slice(
        matchIndex + originalCombinedText.length
      );

      let leadingWhitespace =
        windowSegments[0]?.text.match(/^[\s\r\n\t]*/)?.[0] ?? "";
      let trailingWhitespace =
        windowSegments[windowSegments.length - 1]?.text.match(
          /[\s\r\n\t]*$/
        )?.[0] ?? "";

      if (!leadingWhitespace && before && !/\s$/.test(before)) {
        leadingWhitespace = " ";
      }

      if (!trailingWhitespace && after && !/^\s/.test(after)) {
        trailingWhitespace = " ";
      }

      const trimmedCorrection = correctedText.trim();
      const correctedSegmentText = `${leadingWhitespace}${trimmedCorrection}${trailingWhitespace}`;
      const updatedValue = `${before}${correctedSegmentText}${after}`;

      valueRef.current = updatedValue;
      onChange({ target: { name: "content", value: updatedValue } });

      const updatedSegments = [...currentSegments];
      updatedSegments.splice(firstIndex, count, {
        id: segmentIdRef.current++,
        text: correctedSegmentText,
        status: "corrected",
      });
      segmentsRef.current = updatedSegments;

      if (correctionHighlightTimeoutRef.current) {
        clearTimeout(correctionHighlightTimeoutRef.current);
        correctionHighlightTimeoutRef.current = null;
      }

      setRecentCorrection({ text: trimmedCorrection, ts: Date.now() });
      correctionHighlightTimeoutRef.current = setTimeout(() => {
        setRecentCorrection(null);
        correctionHighlightTimeoutRef.current = null;
      }, 3500);
    },
    [onChange]
  );

  const runSessionCorrection = useCallback(async () => {
    const segmentIds = sessionSegmentIdsRef.current;
    if (!segmentIds.length) {
      return;
    }

    const sessionSegments = segmentsRef.current.filter((segment) =>
      segmentIds.includes(segment.id)
    );

    if (!sessionSegments.length) {
      sessionSegmentIdsRef.current = [];
      return;
    }

    const combinedText = sessionSegments
      .map((segment) => segment.text)
      .join("");
    if (!combinedText.trim()) {
      sessionSegmentIdsRef.current = [];
      return;
    }

    setIsCorrecting(true);
    try {
      const corrected = await requestCorrection(combinedText);
      if (corrected && corrected.trim()) {
        applyCorrectionToSegments(segmentIds.slice(), corrected);
        setError(null);
      }
    } catch (err) {
      console.error("Final correction failed:", err);
    } finally {
      sessionSegmentIdsRef.current = [];
      setIsCorrecting(false);
    }
  }, [applyCorrectionToSegments, requestCorrection]);

  const handleAudioChunk = useCallback(
    async (audioBlob) => {
      try {
        setIsProcessing(true);
        const transcript = await STTCore.inferSTT(audioBlob, {
          overlapMs: STREAM_OVERLAP_MS,
        });
        const cleanedTranscript = transcript?.trim();

        if (cleanedTranscript) {
          const currentValue = valueRef.current || "";
          const dedupedTranscript = stripOverlappingPrefix(
            currentValue,
            cleanedTranscript
          );
          if (!dedupedTranscript) {
            return;
          }

          const needsSpace = currentValue.length && !/\s$/.test(currentValue);
          const segmentId = segmentIdRef.current++;
          const appendedText = `${needsSpace ? " " : ""}${dedupedTranscript}`;
          const newContent = currentValue + appendedText;

          segmentsRef.current.push({
            id: segmentId,
            text: appendedText,
            status: "raw",
          });

          sessionSegmentIdsRef.current.push(segmentId);

          valueRef.current = newContent;
          onChange({ target: { name: "content", value: newContent } });
        }
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [onChange]
  );

  const handleVADStatus = useCallback((status) => {
    // status: { isSpeaking, volumeDb, duration }
    setIsSpeechDetected(!!status?.isSpeaking);
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!isInitialized) {
      setError("STT service not ready. Please wait...");
      return;
    }

    try {
      setError(null);
      if (correctionHighlightTimeoutRef.current) {
        clearTimeout(correctionHighlightTimeoutRef.current);
        correctionHighlightTimeoutRef.current = null;
      }
      setRecentCorrection(null);
      sessionSegmentIdsRef.current = [];
      setIsRecording(true);

      STTCore.resetStreamingState();

      // Start real-time STT with VAD using consolidated service
      const stopFn = STTCore.startRealTimeSTT(
        handleAudioChunk,
        handleVADStatus,
        volumeThreshold, // Use state value for volumeThreshold (dB)
        1000, // minChunkDuration (ms)
        2000, // maxChunkDuration (ms)
        300 // silenceGapMs
      );

      stopRecordingRef.current = stopFn;
    } catch (err) {
      console.error("Recording error:", err);
      setError(err.message || "Failed to start recording");
      setIsRecording(false);
    }
  }, [isInitialized, handleAudioChunk, handleVADStatus, volumeThreshold]);

  const handleStopRecording = useCallback(() => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
      stopRecordingRef.current = null;
    }
    setIsRecording(false);
    setIsSpeechDetected(false);
    runSessionCorrection();
  }, [runSessionCorrection]);

  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!isInitialized) {
        setError("STT service not ready");
        return;
      }

      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      const onProgress = (percent) => {
        setUploadProgress(Math.round(percent));
      };

      const onComplete = async (transcript) => {
        if (transcript?.trim()) {
          setUploadProgress(100);

          // Apply text correction to uploaded file transcript
          setIsCorrecting(true);
          try {
            const correctedText = await requestCorrection(transcript);
            const finalText = correctedText || transcript;

            // Use ref to get the latest value at completion time
            const currentValue = valueRef.current;
            const newContent = currentValue
              ? `${currentValue}\n${finalText}`.trim()
              : finalText;
            onChange({ target: { name: "content", value: newContent } });

            // Show correction indicator if text was corrected
            if (correctedText && correctedText !== transcript) {
              setRecentCorrection({ text: correctedText, ts: Date.now() });
              if (correctionHighlightTimeoutRef.current) {
                clearTimeout(correctionHighlightTimeoutRef.current);
              }
              correctionHighlightTimeoutRef.current = setTimeout(() => {
                setRecentCorrection(null);
                correctionHighlightTimeoutRef.current = null;
              }, 3500);
            }
          } catch (err) {
            console.error("File correction failed:", err);
            // Fall back to original transcript if correction fails
            const currentValue = valueRef.current;
            const newContent = currentValue
              ? `${currentValue}\n${transcript}`.trim()
              : transcript;
            onChange({ target: { name: "content", value: newContent } });
          } finally {
            setIsCorrecting(false);
          }
        }
        setIsUploading(false);
        setUploadProgress(0);
      };

      const onError = (error) => {
        setError(error.message || "Failed to process audio file");
        setIsUploading(false);
        setUploadProgress(0);
      };

      try {
        await STTCore.processAudioFile(file, onProgress, onComplete, onError);
      } catch (err) {
        console.error("File upload error:", err);
        onError(err);
      }

      // Reset file input
      event.target.value = "";
    },
    [isInitialized, onChange, requestCorrection]
  );

  const handleTextChange = useCallback(
    (e) => {
      onChange(e);
    },
    [onChange]
  );

  const textareaHighlightClass = recentCorrection
    ? "ring-2 ring-purple-400 shadow-inner transition-shadow duration-300"
    : isCorrecting
    ? "ring-2 ring-blue-400 shadow-inner transition-shadow duration-300"
    : "";

  return (
    <div className="space-y-2">
      {/* Textarea with STT controls */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          name="content"
          value={value}
          onChange={handleTextChange}
          rows={rows}
          placeholder={placeholder}
          disabled={isRecording || isUploading}
          className={`w-full px-3 py-2 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition-shadow ${textareaHighlightClass} ${className}`}
        />

        {/* STT Control Buttons (floating inside textarea) */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {/* Settings Button */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              disabled={isRecording || isUploading || !isInitialized}
              className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 text-white transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="Microphone Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* Settings Popover */}
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-4 z-50">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Microphone Settings
                </h4>

                {/* Volume Threshold Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">
                      Volume Threshold
                    </label>
                    <span className="text-xs font-bold text-gray-800">
                      {volumeThreshold} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="-20"
                    step="1"
                    value={volumeThreshold}
                    onChange={(e) =>
                      setVolumeThreshold(parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Quiet (-60)</span>
                    <span>Loud (-20)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Lower values (e.g., -60) detect quieter speech. Higher
                    values (e.g., -30) require louder speech.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Microphone Button */}
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isUploading || !isInitialized}
            className={`p-2 rounded-full transition-all duration-200 shadow-md ${
              isRecording
                ? isSpeechDetected
                  ? "bg-green-500 hover:bg-green-600 animate-pulse"
                  : "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            {isRecording ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>

          {/* Upload Audio File Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || isUploading || !isInitialized}
            className="p-2 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload Audio File"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Status Indicators */}
      {(isRecording ||
        isUploading ||
        error ||
        isProcessing ||
        isCorrecting ||
        recentCorrection ||
        correctionWarning) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {isRecording && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                isSpeechDetected
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <span className="flex h-2 w-2 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSpeechDetected ? "bg-green-400" : "bg-gray-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isSpeechDetected ? "bg-green-500" : "bg-gray-500"
                  }`}
                ></span>
              </span>
              <span className="font-medium">
                {isSpeechDetected
                  ? "🎤 Listening..."
                  : "🔇 Waiting for speech..."}
              </span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="font-medium">Transcribing...</span>
            </div>
          )}

          {isCorrecting && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="font-medium">Cleaning up transcript...</span>
            </div>
          )}

          {isUploading && (
            <div className="flex-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="font-medium">
                  Processing audio... {uploadProgress}%
                </span>
              </div>
              <div className="mt-1 w-full bg-blue-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">
              ⚠️ {error}
            </div>
          )}

          {correctionWarning && (
            <div className="flex-1 bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg font-medium border border-yellow-200">
              ℹ️ {correctionWarning}
            </div>
          )}

          {recentCorrection && (
            <div className="flex-1 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm">
              <span className="font-semibold mr-1">✨ Polished:</span>
              <span>
                {recentCorrection.text.length > 120
                  ? `${recentCorrection.text.slice(0, 117)}...`
                  : recentCorrection.text}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isRecording &&
        !isUploading &&
        !error &&
        !isCorrecting &&
        !recentCorrection &&
        !correctionWarning && (
          <div className="text-xs text-gray-500">
            💡 Click <strong className="text-blue-600">microphone</strong> for
            real-time transcription or{" "}
            <strong className="text-purple-600">upload</strong> an audio file.
            When you stop recording we send the full take for cleanup—watch for
            the purple glow when the polished version lands.
          </div>
        )}
    </div>
  );
}
