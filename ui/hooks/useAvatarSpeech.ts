"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

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

interface TokenResponse {
  token: string;
  region: string;
  iceServers: {
    Urls: string[];
    Username: string;
    Password: string;
  } | null;
  expiresIn: number;
  avatarConfig: AvatarConfig;
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

export function useAvatarSpeech(options: UseAvatarSpeechOptions = {}): UseAvatarSpeechReturn {
  const { persona = "Relater", onStateChange, onError } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<AvatarState>("idle");
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const synthesizerRef = useRef<SpeechSDK.AvatarSynthesizer | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const tokenExpiryRef = useRef<number>(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateState = useCallback(
    (newState: AvatarState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const handleError = useCallback(
    (err: Error) => {
      console.error("[useAvatarSpeech] Error:", err);
      setError(err);
      updateState("error");
      onError?.(err);
    },
    [onError, updateState]
  );

  const fetchToken = useCallback(async (): Promise<TokenResponse | null> => {
    try {
      const res = await fetch("/api/orchestrator/avatar/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token fetch failed: ${res.status} - ${text}`);
      }

      const data: TokenResponse = await res.json();
      tokenRef.current = data.token;
      tokenExpiryRef.current = Date.now() + data.expiresIn * 1000;
      setAvatarConfig(data.avatarConfig);
      return data;
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [persona, handleError]);

  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const timeUntilExpiry = tokenExpiryRef.current - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 60000, 30000);

    refreshTimerRef.current = setTimeout(async () => {
      console.log("[useAvatarSpeech] Refreshing token proactively");
      await fetchToken();
      scheduleTokenRefresh();
    }, refreshTime);
  }, [fetchToken]);

  const connect = useCallback(async () => {
    console.log("[useAvatarSpeech] connect() called, state:", state, "isConnecting:", isConnectingRef.current);
    
    // Use ref to prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || state === "connected") {
      console.log("[useAvatarSpeech] Skipping connect - already connecting or connected");
      return;
    }
    isConnectingRef.current = true;

    updateState("connecting");
    setError(null);

    console.log("[useAvatarSpeech] Fetching token...");
    try {
      const tokenData = await fetchToken();
      if (!tokenData) {
        throw new Error("Failed to fetch avatar token");
      }

      const { token, region, iceServers, avatarConfig: config } = tokenData;
      
      // Validate required fields
      if (!config || !config.character) {
        throw new Error("Avatar config missing or incomplete - Azure Speech Avatar may not be configured");
      }
      
      console.log("[useAvatarSpeech] Token received, region:", region, "character:", config.character);

      // Check if AvatarSynthesizer is available
      if (!SpeechSDK.AvatarSynthesizer || !SpeechSDK.AvatarConfig) {
        throw new Error("AvatarSynthesizer not available in this SDK version");
      }

      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = config.voice;

      const avatarCharacter = config.character;
      const avatarStyle = config.style;

      console.log("[useAvatarSpeech] Creating avatar config:", avatarCharacter, avatarStyle);
      
      const avatarVideoFormat = new SpeechSDK.AvatarVideoFormat();

      const avatarSynthConfig = new SpeechSDK.AvatarConfig(
        avatarCharacter,
        avatarStyle,
        avatarVideoFormat
      );

      console.log("[useAvatarSpeech] Creating AvatarSynthesizer");
      const synthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarSynthConfig);
      synthesizerRef.current = synthesizer;

      // Log ICE servers received from token
      console.log("[useAvatarSpeech] ICE servers from token:", iceServers ? JSON.stringify(iceServers) : "none");
      
      // Azure returns Urls as an array, RTCPeerConnection expects urls (lowercase) which can be string or array
      const iceConfig = iceServers
        ? [
            {
              urls: Array.isArray(iceServers.Urls) ? iceServers.Urls : [iceServers.Urls],
              username: iceServers.Username,
              credential: iceServers.Password,
            },
          ]
        : [];
      
      console.log("[useAvatarSpeech] RTCPeerConnection config:", JSON.stringify({ iceServers: iceConfig }));
      
      const peerConnection = new RTCPeerConnection({ iceServers: iceConfig });
      peerConnectionRef.current = peerConnection;

      // Collect all tracks (video and audio) into a single stream
      const mediaStream = new MediaStream();
      
      peerConnection.ontrack = (event) => {
        console.log("[useAvatarSpeech] Received track:", event.track.kind, "enabled:", event.track.enabled, "readyState:", event.track.readyState);
        
        // Add both video and audio tracks to the stream
        mediaStream.addTrack(event.track);
        
        // Log all tracks in the stream
        console.log("[useAvatarSpeech] MediaStream tracks:", mediaStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
        
        // Attach stream to video element (includes both video and audio)
        if (videoRef.current && videoRef.current.srcObject !== mediaStream) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = false; // Ensure audio is not muted
          videoRef.current.volume = 1.0;  // Full volume
          
          // Log video element state
          console.log("[useAvatarSpeech] Video element - muted:", videoRef.current.muted, "volume:", videoRef.current.volume);
          
          videoRef.current.play().catch((err) => {
            console.warn("[useAvatarSpeech] Autoplay blocked, user interaction needed:", err);
          });
        }
        
        // Monitor track state changes
        event.track.onended = () => {
          console.log("[useAvatarSpeech] Track ended:", event.track.kind);
        };
        event.track.onmute = () => {
          console.log("[useAvatarSpeech] Track muted:", event.track.kind);
        };
        event.track.onunmute = () => {
          console.log("[useAvatarSpeech] Track unmuted:", event.track.kind);
        };
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log("[useAvatarSpeech] ICE state:", peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === "failed") {
          handleError(new Error("ICE connection failed"));
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log("[useAvatarSpeech] Connection state:", peerConnection.connectionState);
      };
      
      // CRITICAL: Add transceivers to tell WebRTC to expect video and audio tracks
      // Without this, the PeerConnection won't negotiate for media tracks
      peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
      console.log("[useAvatarSpeech] Added video and audio transceivers");
      
      // Log initial peer connection state
      console.log("[useAvatarSpeech] PeerConnection initial state:", peerConnection.connectionState, "ICE:", peerConnection.iceConnectionState);

      console.log("[useAvatarSpeech] Starting avatar connection...");
      
      // Add event listener for when avatar starts
      synthesizer.avatarEventReceived = (s, e) => {
        console.log("[useAvatarSpeech] Avatar event:", e.description, "offset:", e.offset);
      };
      
      const startResult = await synthesizer.startAvatarAsync(peerConnection);
      
      // Log the result of startAvatarAsync
      console.log("[useAvatarSpeech] startAvatarAsync result:", startResult);
      console.log("[useAvatarSpeech] startAvatarAsync result.reason:", startResult.reason);
      
      // Check if avatar start was successful
      if (startResult.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log("[useAvatarSpeech] Avatar started successfully");
      } else if (startResult.reason === SpeechSDK.ResultReason.Canceled) {
        const cancelResult = startResult as unknown as SpeechSDK.SpeechSynthesisResult;
        console.error("[useAvatarSpeech] Avatar start canceled:", cancelResult.errorDetails);
      }
      
      // Log peer connection state after avatar starts
      console.log("[useAvatarSpeech] PeerConnection after start:", peerConnection.connectionState, "ICE:", peerConnection.iceConnectionState);
      console.log("[useAvatarSpeech] MediaStream tracks after start:", mediaStream.getTracks().length);

      console.log("[useAvatarSpeech] Avatar connected, sending initial greeting...");
      scheduleTokenRefresh();
      
      // Send an initial greeting to make the avatar appear
      // The avatar only streams video when speaking
      // We wait for this to complete before marking as "connected" so the UI knows it's ready
      try {
        isSpeakingRef.current = true;
        const voice = config.voice || "en-US-JennyNeural";
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voice}">Hello, I'm ready to begin our session.</voice>
        </speak>`;
        console.log("[useAvatarSpeech] Sending initial greeting to activate avatar...");
        await synthesizer.speakSsmlAsync(ssml);
        console.log("[useAvatarSpeech] Initial greeting completed");
        isSpeakingRef.current = false;
      } catch (greetErr) {
        console.warn("[useAvatarSpeech] Initial greeting failed:", greetErr);
        isSpeakingRef.current = false;
      }
      
      // Only mark as connected AFTER initial greeting completes
      // This ensures the avatar is truly ready to accept new speech requests
      updateState("connected");
      isConnectingRef.current = false;
      console.log("[useAvatarSpeech] Avatar fully ready");
    } catch (err) {
      console.error("[useAvatarSpeech] Connection error:", err);
      isConnectingRef.current = false;
      handleError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [state, fetchToken, updateState, handleError, scheduleTokenRefresh]);

  const disconnect = useCallback((force = false) => {
    // Don't interrupt an active connection attempt or active speech unless forced
    if ((isConnectingRef.current || isSpeakingRef.current) && !force) {
      console.log("[useAvatarSpeech] Skipping disconnect - operation in progress");
      return;
    }

    // Only log if we were actually connected or connecting
    if (synthesizerRef.current || peerConnectionRef.current) {
      console.log("[useAvatarSpeech] Disconnecting");
    }
    isConnectingRef.current = false;
    isSpeakingRef.current = false;

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (synthesizerRef.current) {
      try {
        synthesizerRef.current.close();
      } catch (e) {
        console.warn("[useAvatarSpeech] Error closing synthesizer:", e);
      }
      synthesizerRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    tokenRef.current = null;
    updateState("idle");
  }, [updateState]);

  const speak = useCallback(
    async (text: string, emotion?: string) => {
      if (!synthesizerRef.current) {
        console.warn("[useAvatarSpeech] Cannot speak: synthesizer not available");
        return;
      }
      
      if (state !== "connected" && state !== "speaking") {
        console.warn("[useAvatarSpeech] Cannot speak: not connected, state:", state);
        return;
      }

      updateState("speaking");

      try {
        const voiceStyle = emotion || avatarConfig?.voice_style || "neutral";
        const voice = avatarConfig?.voice || "en-US-JennyNeural";

        // Escape special XML characters
        const escapedText = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
           xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
          <voice name="${voice}">
            <mstts:express-as style="${voiceStyle}">
              ${escapedText}
            </mstts:express-as>
          </voice>
        </speak>`;

        console.log("[useAvatarSpeech] Speaking with voice:", voice, "style:", voiceStyle);
        console.log("[useAvatarSpeech] SSML length:", ssml.length, "text length:", text.length);
        
        isSpeakingRef.current = true;
        
        const result = await synthesizerRef.current!.speakSsmlAsync(ssml);
        
        isSpeakingRef.current = false;
        
        console.log("[useAvatarSpeech] Speech result reason:", result.reason, "ResultReason enum:", {
          SynthesizingAudioCompleted: SpeechSDK.ResultReason.SynthesizingAudioCompleted,
          Canceled: SpeechSDK.ResultReason.Canceled
        });
        
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log("[useAvatarSpeech] Speech completed successfully");
        } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
          // Cast to access cancellation details
          const cancelResult = result as unknown as SpeechSDK.SpeechSynthesisResult;
          if (cancelResult.errorDetails) {
            console.error("[useAvatarSpeech] Speech canceled:", cancelResult.errorDetails);
          } else {
            console.error("[useAvatarSpeech] Speech canceled, no error details available");
          }
        } else {
          console.warn("[useAvatarSpeech] Speech synthesis result:", result.reason);
        }

        updateState("connected");
      } catch (err) {
        console.error("[useAvatarSpeech] Speak error:", err);
        updateState("connected");
      }
    },
    [state, avatarConfig, updateState]
  );

  const stopSpeaking = useCallback(() => {
    if (synthesizerRef.current) {
      try {
        synthesizerRef.current.stopSpeakingAsync();
      } catch (e) {
        console.warn("[useAvatarSpeech] Error stopping speech:", e);
      }
    }
    if (state === "speaking") {
      updateState("connected");
    }
  }, [state, updateState]);

  // Store disconnect in a ref to avoid cleanup being called on every re-render
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  // Only disconnect on actual unmount (empty deps)
  useEffect(() => {
    return () => {
      disconnectRef.current(true); // Force disconnect on unmount
    };
  }, []);

  return {
    videoRef,
    state,
    isConnected: state === "connected" || state === "speaking",
    isSpeaking: state === "speaking",
    avatarConfig,
    connect,
    disconnect,
    speak,
    stopSpeaking,
    error,
  };
}

export default useAvatarSpeech;
