"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export type RecognitionState = "idle" | "listening" | "processing" | "error";

interface UseSpeechRecognitionOptions {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
  silenceTimeoutMs?: number; // How long to wait after speech ends before processing
}

interface UseSpeechRecognitionReturn {
  state: RecognitionState;
  isListening: boolean;
  interimText: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: Error | null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    onInterimResult,
    onFinalResult,
    onSpeechStart,
    onSpeechEnd,
    onError,
    silenceTimeoutMs = 1500, // 1.5 seconds of silence triggers processing
  } = options;

  const [state, setState] = useState<RecognitionState>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const audioConfigRef = useRef<SpeechSDK.AudioConfig | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTextRef = useRef<string>("");
  const isSpeakingRef = useRef(false);
  const isStartingRef = useRef(false); // Prevent multiple startListening calls

  const handleError = useCallback(
    (err: Error) => {
      console.error("[useSpeechRecognition] Error:", err);
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
      // User stopped speaking - send accumulated text
      if (accumulatedTextRef.current.trim()) {
        console.log("[useSpeechRecognition] Silence detected, sending:", accumulatedTextRef.current);
        setState("processing");
        onFinalResult?.(accumulatedTextRef.current.trim());
        accumulatedTextRef.current = "";
        setInterimText("");
      }
      isSpeakingRef.current = false;
      onSpeechEnd?.();
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs, onFinalResult, onSpeechEnd]);

  const stopListening = useCallback(() => {
    console.log("[useSpeechRecognition] Stopping...");
    clearSilenceTimer();

    if (recognizerRef.current) {
      try {
        recognizerRef.current.stopContinuousRecognitionAsync(
          () => {
            console.log("[useSpeechRecognition] Stopped successfully");
          },
          (err) => {
            console.warn("[useSpeechRecognition] Error stopping:", err);
          }
        );
        recognizerRef.current.close();
      } catch (e) {
        console.warn("[useSpeechRecognition] Error closing recognizer:", e);
      }
      recognizerRef.current = null;
    }

    if (audioConfigRef.current) {
      audioConfigRef.current.close();
      audioConfigRef.current = null;
    }

    // Send any remaining accumulated text
    if (accumulatedTextRef.current.trim()) {
      onFinalResult?.(accumulatedTextRef.current.trim());
      accumulatedTextRef.current = "";
    }

    setInterimText("");
    setState("idle");
  }, [clearSilenceTimer, onFinalResult]);

  const startListening = useCallback(async () => {
    if (state === "listening" || isStartingRef.current) {
      console.log("[useSpeechRecognition] Already listening or starting");
      return;
    }

    // Prevent concurrent startListening calls
    isStartingRef.current = true;

    // Clean up any existing recognizer first
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stopContinuousRecognitionAsync();
        recognizerRef.current.close();
      } catch (e) {
        console.warn("[useSpeechRecognition] Error cleaning up old recognizer:", e);
      }
      recognizerRef.current = null;
    }
    if (audioConfigRef.current) {
      audioConfigRef.current.close();
      audioConfigRef.current = null;
    }

    try {
      setState("listening");
      setError(null);
      accumulatedTextRef.current = "";
      setInterimText("");

      // Fetch speech token from our API (POST request)
      console.log("[useSpeechRecognition] Fetching speech token...");
      const tokenRes = await fetch("/api/orchestrator/avatar/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "default" }),
      });
      if (!tokenRes.ok) {
        throw new Error(`Failed to get speech token: ${tokenRes.status}`);
      }
      const tokenData = await tokenRes.json();
      
      if (!tokenData.token || !tokenData.region) {
        throw new Error("Invalid token response");
      }

      console.log("[useSpeechRecognition] Token received, region:", tokenData.region);

      // Create speech config with authorization token
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
        tokenData.token,
        tokenData.region
      );
      speechConfig.speechRecognitionLanguage = "en-US";
      
      // Enable interim results
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceResponse_RequestSentenceBoundary,
        "true"
      );

      // Create audio config from default microphone
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create recognizer
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfigRef.current
      );
      recognizerRef.current = recognizer;

      // Handle interim (recognizing) results
      recognizer.recognizing = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          const text = e.result.text;
          console.log("[useSpeechRecognition] Recognizing:", text);
          
          // User is speaking
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            onSpeechStart?.();
          }
          
          // Reset silence timer on each interim result
          startSilenceTimer();
          
          // Show interim text
          setInterimText(accumulatedTextRef.current + " " + text);
          onInterimResult?.(accumulatedTextRef.current + " " + text);
        }
      };

      // Handle final (recognized) results for each phrase
      recognizer.recognized = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          console.log("[useSpeechRecognition] Recognized:", text);
          
          // Accumulate recognized text
          if (text.trim()) {
            accumulatedTextRef.current += " " + text;
            setInterimText(accumulatedTextRef.current.trim());
          }
          
          // Start/reset silence timer
          startSilenceTimer();
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.log("[useSpeechRecognition] No match");
        }
      };

      // Handle session events
      recognizer.sessionStarted = () => {
        console.log("[useSpeechRecognition] Session started");
      };

      recognizer.sessionStopped = () => {
        console.log("[useSpeechRecognition] Session stopped");
      };

      recognizer.canceled = (_, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          console.error("[useSpeechRecognition] Canceled due to error:", e.errorDetails);
          handleError(new Error(e.errorDetails));
        } else {
          console.log("[useSpeechRecognition] Canceled:", e.reason);
        }
      };

      // Start continuous recognition
      console.log("[useSpeechRecognition] Starting continuous recognition...");
      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log("[useSpeechRecognition] Continuous recognition started");
          isStartingRef.current = false;
        },
        (err) => {
          console.error("[useSpeechRecognition] Failed to start:", err);
          isStartingRef.current = false;
          handleError(new Error(String(err)));
        }
      );
    } catch (err) {
      isStartingRef.current = false;
      handleError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [state, handleError, startSilenceTimer, onInterimResult, onSpeechStart]);

  // Store stopListening in a ref for cleanup
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListeningRef.current();
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    interimText,
    startListening,
    stopListening,
    error,
  };
}

export default useSpeechRecognition;
