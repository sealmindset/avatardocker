"use client";

/**
 * useSpeechRecognition - STUB for AvatarDocker
 * 
 * This is a no-op stub. AvatarDocker uses the browser's Web Speech API instead of Azure Speech SDK.
 * Use useWebSpeechRecognition hook for actual speech recognition functionality.
 * 
 * This stub exists only to prevent import errors from session/page.tsx.
 */

import { useCallback, useRef, useState } from "react";

export type RecognitionState = "idle" | "listening" | "processing" | "error";

interface UseSpeechRecognitionOptions {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
  silenceTimeoutMs?: number;
}

interface UseSpeechRecognitionReturn {
  state: RecognitionState;
  isListening: boolean;
  interimText: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: Error | null;
}

/**
 * Stub hook - Azure Speech Recognition is disabled in AvatarDocker.
 * Use useWebSpeechRecognition instead for browser-based speech recognition.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [state] = useState<RecognitionState>("idle");
  const [interimText] = useState("");
  const [error] = useState<Error | null>(null);

  const startListening = useCallback(async () => {
    console.warn("[useSpeechRecognition] STUB: Azure Speech SDK is disabled in AvatarDocker. Use useWebSpeechRecognition instead.");
  }, []);

  const stopListening = useCallback(() => {
    // No-op stub
  }, []);

  return {
    state,
    isListening: false,
    interimText,
    startListening,
    stopListening,
    error,
  };
}

export default useSpeechRecognition;
