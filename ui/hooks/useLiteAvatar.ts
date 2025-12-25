"use client";

import { useCallback, useRef, useState } from "react";

export type LiteAvatarState = "idle" | "rendering" | "playing" | "error";

interface LiteAvatarInfo {
  id: string;
  name: string;
  path: string;
}

interface RenderResponse {
  video_base64: string;
  duration_seconds: number;
  frames: number;
}

interface UseLiteAvatarOptions {
  avatarUrl?: string;
  avatarId?: string;  // Avatar ID to use for rendering (from session)
  onStateChange?: (state: LiteAvatarState) => void;
  onError?: (error: Error) => void;
  onVideoEnd?: () => void;
}

interface UseLiteAvatarReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: LiteAvatarState;
  isRendering: boolean;
  isPlaying: boolean;
  availableAvatars: LiteAvatarInfo[];
  selectedAvatar: string;
  setSelectedAvatar: (id: string) => void;
  renderAndPlay: (audioBase64: string) => Promise<void>;
  playVideo: (videoBase64: string) => Promise<void>;
  stop: () => void;
  checkHealth: () => Promise<boolean>;
  fetchAvatars: () => Promise<void>;
  error: Error | null;
}

export function useLiteAvatar(options: UseLiteAvatarOptions = {}): UseLiteAvatarReturn {
  const {
    // Use the Next.js API proxy to avoid CORS issues
    avatarUrl = "/api/orchestrator/avatar/lite",
    avatarId,  // Avatar ID from session (takes precedence over selectedAvatar)
    onStateChange,
    onError,
    onVideoEnd,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<LiteAvatarState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [availableAvatars, setAvailableAvatars] = useState<LiteAvatarInfo[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("preload");
  const currentVideoUrlRef = useRef<string | null>(null);
  
  // Use avatarId from props if provided, otherwise use selectedAvatar
  const effectiveAvatarId = avatarId || selectedAvatar;

  const updateState = useCallback(
    (newState: LiteAvatarState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const handleError = useCallback(
    (err: Error) => {
      console.error("[useLiteAvatar] Error:", err);
      setError(err);
      updateState("error");
      onError?.(err);
    },
    [onError, updateState]
  );

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      // Use proxy API with endpoint query param
      const healthUrl = `${avatarUrl}?endpoint=health`;
      console.log("[useLiteAvatar] Checking health at:", healthUrl);
      const res = await fetch(healthUrl, {
        method: "GET",
      });
      console.log("[useLiteAvatar] Health response status:", res.status);
      if (!res.ok) {
        console.warn("[useLiteAvatar] Health check returned non-OK:", res.status);
        return false;
      }
      const data = await res.json();
      console.log("[useLiteAvatar] Health data:", data);
      return data.status === "healthy";
    } catch (err) {
      console.warn("[useLiteAvatar] Health check failed:", err);
      return false;
    }
  }, [avatarUrl]);

  const fetchAvatars = useCallback(async () => {
    try {
      // Use proxy API with endpoint query param
      const res = await fetch(`${avatarUrl}?endpoint=avatars`);
      if (!res.ok) throw new Error(`Failed to fetch avatars: ${res.status}`);
      const data = await res.json();
      setAvailableAvatars(data.avatars || []);
      console.log("[useLiteAvatar] Available avatars:", data.avatars);
    } catch (err) {
      console.warn("[useLiteAvatar] Failed to fetch avatars:", err);
    }
  }, [avatarUrl]);

  const playVideo = useCallback(
    async (videoBase64: string): Promise<void> => {
      console.log("[useLiteAvatar] playVideo called, video base64 length:", videoBase64.length);
      console.log("[useLiteAvatar] videoRef.current exists:", !!videoRef.current);
      
      return new Promise((resolve, reject) => {
        if (!videoRef.current) {
          console.error("[useLiteAvatar] Video element ref is null!");
          reject(new Error("Video element not available"));
          return;
        }

        // Clean up previous video URL
        if (currentVideoUrlRef.current) {
          URL.revokeObjectURL(currentVideoUrlRef.current);
          currentVideoUrlRef.current = null;
        }

        try {
          // Convert base64 to blob
          console.log("[useLiteAvatar] Converting base64 to blob...");
          const byteCharacters = atob(videoBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "video/mp4" });

          // Create object URL
          const videoUrl = URL.createObjectURL(blob);
          currentVideoUrlRef.current = videoUrl;

          const video = videoRef.current;
          
          // Use video's audio track for synchronized lip-sync
          video.muted = false;
          
          video.onended = () => {
            console.log("[useLiteAvatar] Video playback ended");
            updateState("idle");
            onVideoEnd?.();
            resolve();
          };

          video.onerror = (e) => {
            console.error("[useLiteAvatar] Video playback error:", e);
            updateState("error");
            reject(new Error("Video playback failed"));
          };

          video.oncanplay = () => {
            console.log("[useLiteAvatar] Video can play, starting...");
            updateState("playing");
            video.play().catch((err) => {
              console.error("[useLiteAvatar] Play failed:", err);
              reject(err);
            });
          };

          video.src = videoUrl;
          video.load();
        } catch (err) {
          handleError(err instanceof Error ? err : new Error(String(err)));
          reject(err);
        }
      });
    },
    [updateState, handleError, onVideoEnd]
  );

  const renderAndPlay = useCallback(
    async (audioBase64: string): Promise<void> => {
      if (state === "rendering") {
        console.warn("[useLiteAvatar] Already rendering, skipping");
        return;
      }

      updateState("rendering");
      setError(null);

      try {
        console.log("[useLiteAvatar] Sending audio to LiteAvatar for rendering...");
        console.log("[useLiteAvatar] Audio base64 length:", audioBase64.length);

        // POST directly to proxy API (it handles /render internally)
        console.log("[useLiteAvatar] Fetching from:", avatarUrl, "with avatar:", effectiveAvatarId);
        const res = await fetch(avatarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_base64: audioBase64,
            avatar_id: effectiveAvatarId,
          }),
        });

        console.log("[useLiteAvatar] Response status:", res.status);

        if (!res.ok) {
          const text = await res.text();
          console.error("[useLiteAvatar] Render failed:", res.status, text);
          throw new Error(`Render failed: ${res.status} - ${text}`);
        }

        const data: RenderResponse = await res.json();
        console.log(
          "[useLiteAvatar] Render complete:",
          data.frames,
          "frames,",
          data.duration_seconds?.toFixed(2) || "unknown",
          "seconds"
        );
        console.log("[useLiteAvatar] Video base64 length:", data.video_base64?.length || 0);

        // Play the rendered video
        if (data.video_base64) {
          await playVideo(data.video_base64);
        } else {
          console.error("[useLiteAvatar] No video_base64 in response");
        }
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [state, avatarUrl, effectiveAvatarId, updateState, playVideo, handleError]
  );

  const stop = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    updateState("idle");
  }, [updateState]);

  return {
    videoRef,
    state,
    isRendering: state === "rendering",
    isPlaying: state === "playing",
    availableAvatars,
    selectedAvatar,
    setSelectedAvatar,
    renderAndPlay,
    playVideo,
    stop,
    checkHealth,
    fetchAvatars,
    error,
  };
}

export default useLiteAvatar;
