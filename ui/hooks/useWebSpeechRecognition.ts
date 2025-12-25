"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecognitionState = "idle" | "listening" | "processing" | "error";

interface UseWebSpeechRecognitionOptions {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
  silenceTimeoutMs?: number;
  language?: string;
}

interface UseWebSpeechRecognitionReturn {
  state: RecognitionState;
  isListening: boolean;
  interimText: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: Error | null;
  isSupported: boolean;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

export function useWebSpeechRecognition(
  options: UseWebSpeechRecognitionOptions = {}
): UseWebSpeechRecognitionReturn {
  const {
    onInterimResult,
    onFinalResult,
    onSpeechStart,
    onSpeechEnd,
    onError,
    silenceTimeoutMs = 1500,
    language = "en-US",
  } = options;

  const [state, setState] = useState<RecognitionState>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTextRef = useRef<string>("");

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  const handleError = useCallback(
    (err: Error) => {
      console.error("[useWebSpeechRecognition] Error:", err);
      setError(err);
      setState("error");
      onError?.(err);
    },
    [onError]
  );

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (accumulatedTextRef.current.trim()) {
        console.log("[useWebSpeechRecognition] Silence detected, sending:", accumulatedTextRef.current);
        setState("processing");
        onFinalResult?.(accumulatedTextRef.current.trim());
        accumulatedTextRef.current = "";
        setInterimText("");
      }
      onSpeechEnd?.();
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs, onFinalResult, onSpeechEnd]);

  const stopListening = useCallback(() => {
    console.log("[useWebSpeechRecognition] Stopping...");
    clearSilenceTimer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("[useWebSpeechRecognition] Error stopping:", e);
      }
      recognitionRef.current = null;
    }

    if (accumulatedTextRef.current.trim()) {
      onFinalResult?.(accumulatedTextRef.current.trim());
      accumulatedTextRef.current = "";
    }

    setInterimText("");
    setState("idle");
  }, [clearSilenceTimer, onFinalResult]);

  const startListening = useCallback(async () => {
    if (state === "listening") {
      console.log("[useWebSpeechRecognition] Already listening");
      return;
    }

    const SpeechRecognitionAPI =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognitionAPI) {
      handleError(new Error("Speech recognition not supported in this browser"));
      return;
    }

    // Clean up existing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }

    try {
      setState("listening");
      setError(null);
      accumulatedTextRef.current = "";
      setInterimText("");

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("[useWebSpeechRecognition] Started");
      };

      recognition.onend = () => {
        console.log("[useWebSpeechRecognition] Ended");
        // Auto-restart if still in listening state
        if (state === "listening" && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore restart errors
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("[useWebSpeechRecognition] Error:", event.error);
        if (event.error === "not-allowed") {
          handleError(new Error("Microphone access denied"));
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          handleError(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      recognition.onspeechstart = () => {
        console.log("[useWebSpeechRecognition] Speech started");
        onSpeechStart?.();
      };

      recognition.onspeechend = () => {
        console.log("[useWebSpeechRecognition] Speech ended");
        startSilenceTimer();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          console.log("[useWebSpeechRecognition] Final:", finalTranscript);
          accumulatedTextRef.current += " " + finalTranscript;
          setInterimText(accumulatedTextRef.current.trim());
          startSilenceTimer();
        }

        if (interimTranscript) {
          console.log("[useWebSpeechRecognition] Interim:", interimTranscript);
          const fullText = accumulatedTextRef.current + " " + interimTranscript;
          setInterimText(fullText.trim());
          onInterimResult?.(fullText.trim());
          clearSilenceTimer(); // Don't timeout while actively speaking
        }
      };

      recognition.start();
      console.log("[useWebSpeechRecognition] Recognition started");
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [state, language, handleError, startSilenceTimer, clearSilenceTimer, onInterimResult, onSpeechStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    interimText,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}

export default useWebSpeechRecognition;
