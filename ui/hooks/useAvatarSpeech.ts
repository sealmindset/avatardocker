"use client";

/**
 * useAvatarSpeech - STUB for AvatarDocker
 * 
 * This is a no-op stub. AvatarDocker uses LiteAvatar + Piper TTS instead of Azure Speech Avatar.
 * The actual avatar functionality is provided by useLiteAvatar and useAvatarLoops hooks.
 * 
 * This stub exists only to prevent import errors from session/page.tsx.
 * All methods are no-ops that log warnings.
 */

import { useCallback, useRef, useState } from "react";

export type AvatarState = "idle" | "connecting" | "connected" | "speaking" | "error";

interface AvatarConfig {
  available: boolean;
  character: string;
  style: string;
  voice: string;
  voice_style: string;
  description: string;
  region: string;
  persona: string;
}

interface UseAvatarSpeechOptions {
  persona?: string;
  onStateChange?: (state: AvatarState) => void;
  onError?: (error: Error) => void;
}

interface UseAvatarSpeechReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: AvatarState;
  isConnected: boolean;
  isSpeaking: boolean;
  avatarConfig: AvatarConfig | null;
  connect: () => Promise<void>;
  disconnect: (force?: boolean) => void;
  speak: (text: string, emotion?: string) => Promise<void>;
  stopSpeaking: () => void;
  error: Error | null;
}

/**
 * Stub hook - Azure Speech Avatar is disabled in AvatarDocker.
 * Use useLiteAvatar and useAvatarLoops instead for avatar functionality.
 */
export function useAvatarSpeech(options: UseAvatarSpeechOptions = {}): UseAvatarSpeechReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state] = useState<AvatarState>("idle");
  const [error] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    console.warn("[useAvatarSpeech] STUB: Azure Speech Avatar is disabled in AvatarDocker. Use useLiteAvatar instead.");
  }, []);

  const disconnect = useCallback((_force = false) => {
    // No-op stub
  }, []);

  const speak = useCallback(async (_text: string, _emotion?: string) => {
    console.warn("[useAvatarSpeech] STUB: Azure Speech Avatar is disabled in AvatarDocker. Use useLiteAvatar instead.");
  }, []);

  const stopSpeaking = useCallback(() => {
    // No-op stub
  }, []);

  return {
    videoRef,
    state,
    isConnected: false,
    isSpeaking: false,
    avatarConfig: null,
    connect,
    disconnect,
    speak,
    stopSpeaking,
    error,
  };
}

export default useAvatarSpeech;
