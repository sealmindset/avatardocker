"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type AvatarLoopState = "idle" | "talking" | "loading" | "error";

interface UseAvatarLoopsOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  avatarId?: string;  // Avatar ID for dynamic avatar swapping
  onStateChange?: (state: AvatarLoopState) => void;
}

interface UseAvatarLoopsReturn {
  state: AvatarLoopState;
  loopsReady: boolean;
  isGenerating: boolean;
  generateLoops: () => Promise<void>;
  playTalking: () => void;
  playIdle: () => void;
  checkLoopsStatus: () => Promise<boolean>;
}

const PROXY_URL = "/api/orchestrator/avatar/lite";

export function useAvatarLoops({
  videoRef,
  avatarId,
  onStateChange,
}: UseAvatarLoopsOptions): UseAvatarLoopsReturn {
  const [state, setState] = useState<AvatarLoopState>("loading");
  const [loopsReady, setLoopsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const idleVideoUrl = useRef<string | null>(null);
  const talkingVideoUrl = useRef<string | null>(null);
  const currentLoop = useRef<"idle" | "talking">("idle");
  const initialized = useRef(false);

  const updateState = useCallback((newState: AvatarLoopState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Check if loop videos exist
  const checkLoopsStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${PROXY_URL}?endpoint=loops/status`);
      if (!res.ok) return false;
      const data = await res.json();
      const ready = data.ready === true;
      setLoopsReady(ready);
      return ready;
    } catch (error) {
      console.error("[useAvatarLoops] Failed to check loops status:", error);
      return false;
    }
  }, []);

  // Generate loop videos
  const generateLoops = useCallback(async (): Promise<void> => {
    setIsGenerating(true);
    updateState("loading");
    
    try {
      console.log("[useAvatarLoops] Generating loop videos for avatar:", avatarId || "default");
      const res = await fetch(`${PROXY_URL}?endpoint=loops/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_id: avatarId }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to generate loops: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("[useAvatarLoops] Loop generation result:", data);
      
      if (data.status === "success") {
        setLoopsReady(true);
        await loadLoopVideos();
        updateState("idle");
      } else {
        throw new Error("Loop generation failed");
      }
    } catch (error) {
      console.error("[useAvatarLoops] Failed to generate loops:", error);
      updateState("error");
    } finally {
      setIsGenerating(false);
    }
  }, [updateState, avatarId]);

  // Load loop video URLs
  const loadLoopVideos = useCallback(async () => {
    try {
      // Fetch idle video
      const idleRes = await fetch(`${PROXY_URL}?endpoint=loops/idle`);
      if (idleRes.ok) {
        const idleBlob = await idleRes.blob();
        if (idleVideoUrl.current) {
          URL.revokeObjectURL(idleVideoUrl.current);
        }
        idleVideoUrl.current = URL.createObjectURL(idleBlob);
        console.log("[useAvatarLoops] Loaded idle loop video");
      }
      
      // Fetch talking video
      const talkingRes = await fetch(`${PROXY_URL}?endpoint=loops/talking`);
      if (talkingRes.ok) {
        const talkingBlob = await talkingRes.blob();
        if (talkingVideoUrl.current) {
          URL.revokeObjectURL(talkingVideoUrl.current);
        }
        talkingVideoUrl.current = URL.createObjectURL(talkingBlob);
        console.log("[useAvatarLoops] Loaded talking loop video");
      }
      
      return idleVideoUrl.current !== null && talkingVideoUrl.current !== null;
    } catch (error) {
      console.error("[useAvatarLoops] Failed to load loop videos:", error);
      return false;
    }
  }, []);

  // Play idle loop - switch to idle video source
  const playIdle = useCallback(() => {
    if (!videoRef.current || !idleVideoUrl.current) return;
    
    if (currentLoop.current === "idle") {
      return; // Already in idle state
    }
    
    console.log("[useAvatarLoops] Switching to idle state");
    currentLoop.current = "idle";
    
    const video = videoRef.current;
    video.src = idleVideoUrl.current;
    video.loop = true;
    video.muted = true;
    video.play().catch((err: unknown) => {
      console.error("[useAvatarLoops] Failed to play idle:", err);
    });
    
    updateState("idle");
  }, [videoRef, updateState]);

  // Play talking loop - ensure video is playing
  const playTalking = useCallback(() => {
    if (!videoRef.current || !talkingVideoUrl.current) return;
    
    console.log("[useAvatarLoops] Switching to talking state");
    currentLoop.current = "talking";
    
    const video = videoRef.current;
    
    // If video isn't playing or has wrong source, set it up
    if (video.src !== talkingVideoUrl.current || video.paused) {
      video.src = talkingVideoUrl.current;
      video.loop = true;
      video.muted = true;
      video.play().catch((err: unknown) => {
        console.error("[useAvatarLoops] Failed to play talking:", err);
      });
    }
    
    updateState("talking");
  }, [videoRef, updateState]);

  // Initialize on mount - only run once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    const init = async () => {
      console.log("[useAvatarLoops] Initializing, checking loops status...");
      const ready = await checkLoopsStatus();
      console.log("[useAvatarLoops] Loops ready:", ready);
      if (ready) {
        console.log("[useAvatarLoops] Loading loop videos...");
        const loaded = await loadLoopVideos();
        console.log("[useAvatarLoops] Loop videos loaded:", loaded);
        if (loaded) {
          updateState("idle");
          // Start playing idle loop on session start
          if (videoRef.current && idleVideoUrl.current) {
            currentLoop.current = "idle";
            videoRef.current.src = idleVideoUrl.current;
            videoRef.current.loop = true;
            videoRef.current.muted = true;
            videoRef.current.play().catch((err: unknown) => {
              console.error("[useAvatarLoops] Failed to play loop on init:", err);
            });
          }
        }
      } else {
        console.log("[useAvatarLoops] Loops not ready, staying in loading state");
        updateState("loading");
      }
    };
    
    init();
    
    // Cleanup
    return () => {
      if (idleVideoUrl.current) {
        URL.revokeObjectURL(idleVideoUrl.current);
      }
      if (talkingVideoUrl.current) {
        URL.revokeObjectURL(talkingVideoUrl.current);
      }
    };
  }, []);

  return {
    state,
    loopsReady,
    isGenerating,
    generateLoops,
    playTalking,
    playIdle,
    checkLoopsStatus,
  };
}
