"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PulseProgressBar from "@/components/SbnProgressBar";
import SentimentGauge from "@/components/SentimentGauge";
import { useSession, AvatarState } from "@/components/SessionContext";
import { useRouter } from "next/navigation";
import { useAvatarSpeech } from "@/hooks/useAvatarSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useWebSpeechRecognition } from "@/hooks/useWebSpeechRecognition";
import { useLiteAvatar } from "@/hooks/useLiteAvatar";
import { useAvatarLoops } from "@/hooks/useAvatarLoops";
import EngagementOverlay from "@/components/EngagementOverlay";
import BuyingSignalIndicator from "@/components/BuyingSignalIndicator";

type TranscriptEntry = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default function SessionPage() {
  const router = useRouter();
  const { 
    sessionId, 
    avatarUrl, 
    avatarVideoUrl, 
    avatarState, 
    persona,
    personaInfo,
    sessionAvatarId,
    sessionVoiceId,
    setAvatarState,
    setAvatarVideoUrl,
  } = useSession();
  
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string | null>(null);
  const [useStreamingAvatar, setUseStreamingAvatar] = useState(false); // Disabled for Docker - using LiteAvatar instead
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // PULSE progress tracking
  const [pulseStage, setPulseStage] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [pulseStageName, setPulseStageName] = useState("Probe");
  const [pulseDetectedBehaviors, setPulseDetectedBehaviors] = useState<string[]>([]);
  
  // Sale outcome tracking
  const [saleOutcome, setSaleOutcome] = useState<{
    status: "in_progress" | "won" | "lost" | "stalled";
    trustScore: number;
    feedback: string;
    misstepsThisTurn: string[];
  }>({ status: "in_progress", trustScore: 5, feedback: "", misstepsThisTurn: [] });

  // EQ Intelligence metrics
  const [engagementLevel, setEngagementLevel] = useState(3);
  const [engagementTrend, setEngagementTrend] = useState<"rising" | "falling" | "stable">("stable");
  const [buyingSignalStrength, setBuyingSignalStrength] = useState(0);
  const [readyToClose, setReadyToClose] = useState(false);

  // EQ Gauge visibility toggles
  const [showSentimentGauge, setShowSentimentGauge] = useState(true);
  const [showEngagementGauge, setShowEngagementGauge] = useState(true);
  const [showBuyingSignalGauge, setShowBuyingSignalGauge] = useState(true);
  
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  
  // Audio playback guard - prevent double audio
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isAudioPlayingRef = useRef(false);
  
  // LiteAvatar state - CPU-based local avatar rendering (enabled by default for Docker)
  const [useLiteAvatarMode, setUseLiteAvatarMode] = useState(true);
  // Default to true for Docker mode - health check is slow due to lazy loading
  const [liteAvatarAvailable, setLiteAvatarAvailable] = useState(true);
  
  // Pre-flight check state (must be declared before useEffect that uses it)
  // For Docker/LiteAvatar mode, start with avatar ready since we don't need Azure avatar
  // Since useLiteAvatarMode defaults to true, we initialize avatar as "ready"
  const [sessionReady, setSessionReady] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<{
    avatar: "pending" | "connecting" | "ready" | "error";
    session: "pending" | "ready" | "error";
  }>({ avatar: "ready", session: "pending" });
  
  // LiteAvatar hook for CPU-based avatar rendering (kept for fallback/generation)
  const {
    videoRef: liteAvatarVideoRef,
    state: liteAvatarState,
    isRendering: isLiteAvatarRendering,
    isPlaying: isLiteAvatarPlaying,
    renderAndPlay: renderLiteAvatar,
    checkHealth: checkLiteAvatarHealth,
    fetchAvatars: fetchLiteAvatars,
    error: liteAvatarError,
  } = useLiteAvatar({
    avatarId: sessionAvatarId || undefined,  // Use session's avatar if available
    onStateChange: (state) => {
      if (state === "rendering") setAvatarState("thinking");
      else if (state === "playing") setAvatarState("speaking");
      else if (state === "idle") setAvatarState("idle");
    },
    onVideoEnd: () => {
      setAvatarState("idle");
    },
    onError: (err) => {
      console.error("[Session] LiteAvatar error:", err);
    },
  });

  // Avatar loops hook for instant video playback (no render delay)
  const loopVideoRef = useRef<HTMLVideoElement | null>(null);
  const {
    state: loopState,
    loopsReady,
    isGenerating: isGeneratingLoops,
    generateLoops,
    playTalking,
    playIdle,
    checkLoopsStatus,
  } = useAvatarLoops({
    videoRef: loopVideoRef,
    avatarId: sessionAvatarId || undefined,  // Pass session's avatar for loop generation
    onStateChange: (state) => {
      if (state === "talking") setAvatarState("speaking");
      else if (state === "idle") setAvatarState("idle");
    },
  });

  // Check LiteAvatar availability on mount
  useEffect(() => {
    const checkLiteAvatar = async () => {
      console.log("[Session] Checking LiteAvatar availability...");
      const healthy = await checkLiteAvatarHealth();
      console.log("[Session] LiteAvatar health check result:", healthy);
      setLiteAvatarAvailable(healthy);
      if (healthy) {
        console.log("[Session] LiteAvatar service available");
        fetchLiteAvatars();
        // Mark avatar as ready since LiteAvatar is available
        setPreflightStatus(prev => ({ ...prev, avatar: "ready" }));
      } else {
        console.log("[Session] LiteAvatar unavailable, using fallback mode");
        // Mark avatar as error (fallback mode) so session can proceed
        setPreflightStatus(prev => ({ ...prev, avatar: "error" }));
      }
    };
    checkLiteAvatar();
  }, [checkLiteAvatarHealth, fetchLiteAvatars]);
  
  // Speech queue for buffering responses until avatar is connected
  const speechQueueRef = useRef<Array<{ text: string; emotion: string }>>([]);
  const isProcessingQueueRef = useRef(false);

  // Azure Speech Avatar hook for real-time streaming
  const {
    videoRef: avatarVideoRef,
    state: avatarSpeechState,
    isConnected: isAvatarConnected,
    isSpeaking: isAvatarSpeaking,
    avatarConfig,
    connect: connectAvatar,
    disconnect: disconnectAvatar,
    speak: speakWithAvatar,
    stopSpeaking,
    error: avatarError,
  } = useAvatarSpeech({
    persona: personaInfo?.type || "Relater",
    onStateChange: (state) => {
      if (state === "speaking") setAvatarState("speaking");
      else if (state === "connected") {
        setAvatarState("idle");
        setPreflightStatus(prev => ({ ...prev, avatar: "ready" }));
        console.log("[Session] Pre-flight: Avatar ready");
      }
      else if (state === "connecting") {
        setAvatarState("thinking");
        setPreflightStatus(prev => ({ ...prev, avatar: "connecting" }));
      }
    },
    onError: (err) => {
      console.error("[Session] Avatar error:", err);
      setPreflightStatus(prev => ({ ...prev, avatar: "error" }));
      setUseStreamingAvatar(false);
    },
  });

  // Store connectAvatar in a ref to avoid dependency issues
  const connectAvatarRef = useRef(connectAvatar);
  connectAvatarRef.current = connectAvatar;
  
  // Track connection state in a ref to avoid closure issues in callbacks
  const isAvatarConnectedRef = useRef(isAvatarConnected);
  isAvatarConnectedRef.current = isAvatarConnected;

  // Connect streaming avatar when session starts (only once when conditions are met)
  const hasAttemptedConnection = useRef(false);
  useEffect(() => {
    if (sessionId && useStreamingAvatar && !isAvatarConnected && avatarSpeechState === "idle" && !hasAttemptedConnection.current) {
      hasAttemptedConnection.current = true;
      console.log("[Session] Pre-flight: Starting avatar connection...");
      setPreflightStatus(prev => ({ ...prev, avatar: "connecting" }));
      connectAvatarRef.current();
    }
  }, [sessionId, useStreamingAvatar, isAvatarConnected, avatarSpeechState]);

  // Mark session as ready when sessionId exists
  useEffect(() => {
    if (sessionId) {
      setPreflightStatus(prev => ({ ...prev, session: "ready" }));
      console.log("[Session] Pre-flight: Session ready");
    }
  }, [sessionId]);

  // Auto-scroll transcript to bottom when new messages are added
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript]);

  // Check if all pre-flight checks pass
  useEffect(() => {
    const avatarReady = preflightStatus.avatar === "ready" || preflightStatus.avatar === "error"; // error means fallback mode
    const sessionOk = preflightStatus.session === "ready";
    
    if (avatarReady && sessionOk && !sessionReady) {
      console.log("[Session] Pre-flight: All checks passed, session ready to start");
      setSessionReady(true);
    }
  }, [preflightStatus, sessionReady]);

  // Initialize with intro video if available (fallback mode)
  useEffect(() => {
    if (!useStreamingAvatar && avatarVideoUrl && !currentVideoSrc) {
      setCurrentVideoSrc(avatarVideoUrl);
    }
  }, [avatarVideoUrl, currentVideoSrc, useStreamingAvatar]);

  // Store disconnectAvatar in a ref for cleanup
  const disconnectAvatarRef = useRef(disconnectAvatar);
  disconnectAvatarRef.current = disconnectAvatar;

  // Cleanup on unmount (empty deps - only runs on unmount)
  useEffect(() => {
    return () => {
      // Force disconnect on actual unmount
      disconnectAvatarRef.current(true);
    };
  }, []);

  // Process queued speech when avatar becomes connected
  const processQueueRef = useRef<() => Promise<void>>();
  processQueueRef.current = async () => {
    if (isProcessingQueueRef.current || !isAvatarConnected) return;
    if (speechQueueRef.current.length === 0) return;
    
    isProcessingQueueRef.current = true;
    console.log("[Session] Processing speech queue, items:", speechQueueRef.current.length);
    
    while (speechQueueRef.current.length > 0 && isAvatarConnected) {
      const item = speechQueueRef.current.shift();
      if (item) {
        console.log("[Session] Speaking queued item:", item.text.substring(0, 30) + "...");
        try {
          await speakWithAvatar(item.text, item.emotion);
        } catch (err) {
          console.error("[Session] Error speaking queued item:", err);
        }
      }
    }
    
    isProcessingQueueRef.current = false;
  };

  // When avatar connects, process any queued speech
  useEffect(() => {
    if (isAvatarConnected && speechQueueRef.current.length > 0) {
      console.log("[Session] Avatar connected, processing queued speech...");
      processQueueRef.current?.();
    }
  }, [isAvatarConnected]);

  // Browser-native Web Speech Synthesis TTS fallback
  const speakWithBrowserTTS = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        console.warn("[Session] Web Speech Synthesis not available");
        resolve();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to get a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Alex")
      ) || voices.find(v => v.lang.startsWith("en"));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      setAvatarState("speaking");
      console.log("[Session] Speaking with browser TTS:", text.substring(0, 50) + "...");

      utterance.onend = () => {
        setAvatarState("idle");
        resolve();
      };

      utterance.onerror = (e) => {
        console.error("[Session] Browser TTS error:", e);
        setAvatarState("idle");
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const handleVideoEnded = () => {
    setAvatarState("idle");
  };

  // Send user text to backend and get AI response
  const sendUserMessage = useCallback(async (userText: string) => {
    console.log("[Session] sendUserMessage called with:", userText.substring(0, 50) + "...");
    if (!userText.trim() || !sessionId) {
      console.log("[Session] Skipping - no text or sessionId");
      return;
    }
    
    setIsProcessing(true);
    setAvatarState("thinking");
    
    // Add user message to transcript immediately
    setTranscript((t) => [...t, {
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    }]);

    console.log("[Session] Sending chat request to backend...");
    try {
      // Send text directly to a new text-based endpoint (faster than audio)
      const res = await fetch("/api/orchestrator/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userText,
          personaId: persona || personaInfo?.type || "relater",
          persona: persona || personaInfo?.type || "relater",
          currentStage: pulseStage,
          trustScore: saleOutcome.trustScore,
          conversationHistory: transcript.map(t => ({ role: t.role, content: t.content })),
        }),
      });
      
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
      
      const data = await res.json();
      console.log("[Session] Chat response received:", data.aiResponse?.substring(0, 50) + "...");
      console.log("[Session] audioBase64 in response:", !!data.audioBase64, "length:", data.audioBase64?.length || 0);
      
      // Update PULSE progress if returned from backend
      if (data.pulseStage && data.pulseStage >= 1 && data.pulseStage <= 5) {
        const newStage = data.pulseStage as 1 | 2 | 3 | 4 | 5;
        if (newStage !== pulseStage) {
          console.log("[Session] PULSE stage advanced:", pulseStage, "→", newStage, data.pulseStageName);
          setPulseStage(newStage);
          setPulseStageName(data.pulseStageName || data.pulseAnalysis?.stageName || "");
          setPulseDetectedBehaviors(data.pulseAnalysis?.detectedBehaviors || []);
        }
      }
      
      // Update sale outcome if returned from backend
      if (data.saleOutcome) {
        console.log("[Session] Sale outcome:", data.saleOutcome.status, "trust:", data.saleOutcome.trustScore);
        setSaleOutcome({
          status: data.saleOutcome.status || "in_progress",
          trustScore: data.saleOutcome.trustScore ?? 5,
          feedback: data.saleOutcome.feedback || "",
          misstepsThisTurn: data.saleOutcome.misstepsThisTurn || [],
        });
        
        // Check for session-ending misstep (sexual harassment, etc.)
        if (data.sessionEndedByMisstep) {
          console.log("[Session] CRITICAL: Session ended by inappropriate behavior");
          // Let the AI response play, then redirect to feedback after a delay
          setTimeout(() => {
            router.push(`/feedback?sessionId=${sessionId}&outcome=lost&reason=inappropriate_behavior`);
          }, 3000); // 3 second delay to let AI response play
        }
      }

      // Update EQ Intelligence metrics
      if (data.engagementLevel !== undefined) {
        setEngagementLevel(data.engagementLevel);
      }
      if (data.engagementTrend) {
        setEngagementTrend(data.engagementTrend);
      }
      if (data.buyingSignalStrength !== undefined) {
        setBuyingSignalStrength(data.buyingSignalStrength);
      }
      if (data.readyToClose !== undefined) {
        setReadyToClose(data.readyToClose);
      }
      
      // Add AI response to transcript
      if (data.aiResponse) {
        setTranscript((t) => [...t, {
          role: "assistant",
          content: String(data.aiResponse),
          timestamp: new Date().toISOString(),
        }]);
        
        // Use streaming avatar to speak the response
        const emotion = data.avatarEmotion || data.emotion || "neutral";
        // Use ref to get current connection state (avoids closure issues)
        const currentlyConnected = isAvatarConnectedRef.current;
        console.log("[Session] Avatar state check - useStreamingAvatar:", useStreamingAvatar, "useLiteAvatarMode:", useLiteAvatarMode, "isAvatarConnected:", currentlyConnected);
        
        // Play TTS audio from API response
        if (data.audioBase64) {
          console.log("[Session] Playing TTS audio from API, length:", data.audioBase64.length);
          console.log("[Session] Mode check - useLiteAvatarMode:", useLiteAvatarMode, "loopsReady:", loopsReady, "liteAvatarAvailable:", liteAvatarAvailable);
          
          // GUARD: Stop any existing audio before playing new audio
          if (currentAudioRef.current) {
            console.log("[Session] Stopping existing audio before playing new");
            currentAudioRef.current.pause();
            currentAudioRef.current.src = "";
            currentAudioRef.current = null;
          }
          if (isAudioPlayingRef.current) {
            console.log("[Session] WARNING: Audio already playing, skipping duplicate");
            return;
          }
          isAudioPlayingRef.current = true;
          
          // Best UX: Play talking loop with TTS audio immediately (no waiting for slow CPU lip-sync)
          // IMPORTANT: Only use loops path - real-time rendering is too slow and causes audio sync issues
          if (useLiteAvatarMode && loopsReady) {
            console.log("[Session] PATH: Playing talking loop (muted) with separate TTS audio");
            setAvatarState("speaking");
            
            // Play talking animation loop immediately
            playTalking();
            
            // Convert base64 to blob for reliable audio playback
            const byteCharacters = atob(data.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: "audio/wav" });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audio.volume = 1.0;
            currentAudioRef.current = audio;
            
            await new Promise<void>((resolve) => {
              audio.onended = () => {
                console.log("[Session] TTS audio finished, switching to idle");
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                isAudioPlayingRef.current = false;
                playIdle();
                resolve();
              };
              audio.onerror = (e) => {
                console.error("[Session] TTS audio error:", e);
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                isAudioPlayingRef.current = false;
                playIdle();
                resolve();
              };
              audio.oncanplaythrough = () => {
                console.log("[Session] Audio ready, duration:", audio.duration, "seconds");
                audio.play().catch((err) => {
                  console.error("[Session] Audio play failed:", err);
                  URL.revokeObjectURL(audioUrl);
                  currentAudioRef.current = null;
                  isAudioPlayingRef.current = false;
                  playIdle();
                  resolve();
                });
              };
              audio.load();
            });
            setAvatarState("idle");
          }
          // Skip real-time LiteAvatar rendering - it's too slow and causes double audio issues
          // Just play TTS audio directly when loops aren't ready
          else if (useLiteAvatarMode) {
            console.log("[Session] PATH: Loops not ready, playing TTS audio only (skipping slow real-time rendering)");
            setAvatarState("speaking");
            
            // Play TTS audio directly without video rendering
            const byteCharacters = atob(data.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: "audio/wav" });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audio.volume = 1.0;
            currentAudioRef.current = audio;
            
            await new Promise<void>((resolve) => {
              audio.onended = () => {
                console.log("[Session] TTS audio finished");
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                isAudioPlayingRef.current = false;
                resolve();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                isAudioPlayingRef.current = false;
                resolve();
              };
              audio.oncanplaythrough = () => {
                audio.play().catch(() => {
                  URL.revokeObjectURL(audioUrl);
                  currentAudioRef.current = null;
                  isAudioPlayingRef.current = false;
                  resolve();
                });
              };
              audio.load();
            });
            setAvatarState("idle");
          } else {
            // Play TTS audio directly without lip-sync
            setAvatarState("speaking");
            const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
            audio.volume = 1.0;
            currentAudioRef.current = audio;
            
            audio.onended = () => {
              console.log("[Session] TTS audio finished");
              currentAudioRef.current = null;
              isAudioPlayingRef.current = false;
              setAvatarState("idle");
            };
            
            audio.onerror = (e) => {
              console.error("[Session] TTS audio error:", e);
              currentAudioRef.current = null;
              isAudioPlayingRef.current = false;
              setAvatarState("idle");
            };
            
            try {
              await audio.play();
              console.log("[Session] TTS audio playing");
            } catch (err) {
              console.error("[Session] TTS audio play failed:", err);
              currentAudioRef.current = null;
              isAudioPlayingRef.current = false;
              await speakWithBrowserTTS(data.aiResponse);
            }
          }
        } else {
          // Fallback to browser TTS if no audio from API
          console.log("[Session] No audio from API, using browser TTS");
          await speakWithBrowserTTS(data.aiResponse);
        }
      }
      
      setAvatarState("idle");
    } catch (e) {
      console.error("[Session] Chat request failed:", e);
      setAvatarState("idle");
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, personaInfo, useStreamingAvatar, useLiteAvatarMode, liteAvatarAvailable, loopsReady, speakWithAvatar, renderLiteAvatar, playTalking, playIdle, setAvatarState, preflightStatus]);

  // State to track which speech recognition to use
  const [useWebSpeech, setUseWebSpeech] = useState(true); // Default to Web Speech API for Docker

  // Web Speech API hook (browser-native, works without Azure)
  const webSpeech = useWebSpeechRecognition({
    onInterimResult: (text) => {
      setInterimTranscript(text);
    },
    onFinalResult: (text) => {
      console.log("[Session] Final speech result (Web):", text);
      setInterimTranscript("");
      sendUserMessageRef.current(text);
    },
    onSpeechStart: () => {
      console.log("[Session] User started speaking (Web)");
      setAvatarState("listening");
    },
    onSpeechEnd: () => {
      console.log("[Session] User stopped speaking (Web)");
    },
    onError: (err) => {
      console.error("[Session] Web speech recognition error:", err);
    },
    silenceTimeoutMs: 1500,
  });

  // Azure Speech SDK hook (requires Azure credentials)
  const azureSpeech = useSpeechRecognition({
    onInterimResult: (text) => {
      setInterimTranscript(text);
    },
    onFinalResult: (text) => {
      console.log("[Session] Final speech result (Azure):", text);
      setInterimTranscript("");
      sendUserMessageRef.current(text);
    },
    onSpeechStart: () => {
      console.log("[Session] User started speaking (Azure)");
      setAvatarState("listening");
    },
    onSpeechEnd: () => {
      console.log("[Session] User stopped speaking (Azure)");
    },
    onError: (err) => {
      console.error("[Session] Azure speech recognition error:", err);
      // Fall back to Web Speech API if Azure fails
      if (!useWebSpeech) {
        console.log("[Session] Falling back to Web Speech API");
        setUseWebSpeech(true);
      }
    },
    silenceTimeoutMs: 1500,
  });

  // Use the appropriate speech recognition based on mode
  const recognitionState = useWebSpeech ? webSpeech.state : azureSpeech.state;
  const isListening = useWebSpeech ? webSpeech.isListening : azureSpeech.isListening;
  const interimText = useWebSpeech ? webSpeech.interimText : azureSpeech.interimText;
  const startListening = useWebSpeech ? webSpeech.startListening : azureSpeech.startListening;
  const stopListening = useWebSpeech ? webSpeech.stopListening : azureSpeech.stopListening;
  const recognitionError = useWebSpeech ? webSpeech.error : azureSpeech.error;

  // Store sendUserMessage in ref for the hook
  const sendUserMessageRef = useRef(sendUserMessage);
  sendUserMessageRef.current = sendUserMessage;

  const completeSession = async () => {
    if (!sessionId) return;
    stopListening();
    try {
      const res = await fetch("/api/orchestrator/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, 
          transcript: transcript.map(t => `${t.role}: ${t.content}`).join("\n"),
        }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
    } finally {
      router.push("/feedback");
    }
  };

  // Avatar state indicator styles
  const getAvatarStateIndicator = () => {
    switch (avatarState) {
      case "speaking":
        return <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>;
      case "listening":
        return <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>;
      case "thinking":
        return <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span></span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Training Session</h1>
        {personaInfo && (
          <span className="text-sm text-gray-600">
            Persona: <span className="font-medium">{personaInfo.displayName}</span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <PulseProgressBar currentStep={pulseStage} />
          </div>
          {/* Trust Score Meter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Trust</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <div
                  key={level}
                  className={`w-2 h-4 rounded-sm ${
                    level <= saleOutcome.trustScore
                      ? level <= 3
                        ? "bg-red-500"
                        : level <= 6
                        ? "bg-yellow-500"
                        : "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-gray-700">{saleOutcome.trustScore}/10</span>
          </div>
        </div>
        
        {/* PULSE behavior feedback */}
        {pulseDetectedBehaviors.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>{pulseStageName}:</strong> {pulseDetectedBehaviors.join(", ")}</span>
          </div>
        )}
        
        {/* Misstep warning */}
        {saleOutcome.misstepsThisTurn.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span><strong>Misstep:</strong> {saleOutcome.misstepsThisTurn.map(m => m.replace(/_/g, " ")).join(", ")}</span>
          </div>
        )}
      </div>
      
      {/* Sale Outcome Modal */}
      {(saleOutcome.status === "won" || saleOutcome.status === "lost") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center ${
            saleOutcome.status === "won" ? "border-4 border-green-500" : "border-4 border-red-500"
          }`}>
            {saleOutcome.status === "won" ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">Sale Won!</h2>
                <p className="text-gray-600 mb-4">{saleOutcome.feedback}</p>
                <p className="text-sm text-gray-500 mb-6">Final Trust Score: {saleOutcome.trustScore}/10</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">😔</div>
                <h2 className="text-2xl font-bold text-red-700 mb-2">Sale Lost</h2>
                <p className="text-gray-600 mb-4">{saleOutcome.feedback}</p>
                <p className="text-sm text-gray-500 mb-6">Final Trust Score: {saleOutcome.trustScore}/10</p>
              </>
            )}
            <button
              onClick={() => router.push("/feedback")}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              View Feedback
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Avatar Video/Image Display */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
            {getAvatarStateIndicator()}
            
            {/* Streaming Avatar (Azure Speech Avatar via WebRTC) */}
            {useStreamingAvatar && !useLiteAvatarMode && (
              <video
                ref={avatarVideoRef}
                autoPlay
                playsInline
                muted={false}
                className={`absolute inset-0 h-full w-full object-cover ${isAvatarConnected ? "z-10" : "z-0 opacity-0"}`}
              />
            )}
            
            {/* Loop-based Avatar (instant playback, no render delay) */}
            {useLiteAvatarMode && loopsReady && (
              <video
                ref={loopVideoRef}
                autoPlay
                playsInline
                loop
                muted
                className="absolute inset-0 h-full w-full object-contain bg-gray-900 z-10"
              />
            )}
            
            {/* LiteAvatar (CPU-based local avatar rendering - fallback when loops not ready) */}
            {/* NOTE: Do NOT use autoPlay here - the useLiteAvatar hook controls playback via video.play() */}
            {/* The video has embedded audio from ffmpeg muxing, so muted={false} is correct */}
            {useLiteAvatarMode && !loopsReady && (
              <video
                ref={liteAvatarVideoRef}
                playsInline
                muted={false}
                className={`absolute inset-0 h-full w-full object-contain bg-gray-900 ${isLiteAvatarPlaying ? "z-10" : "z-0 opacity-0"}`}
              />
            )}
            
            {/* Persona image - shown as fallback when avatar not connected */}
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={avatarUrl} 
                alt="Persona Avatar" 
                className={`absolute inset-0 h-full w-full object-cover ${(isAvatarConnected || isLiteAvatarPlaying) ? "z-0" : "z-10"}`}
              />
            )}
            
            {/* Fallback: Pre-generated video */}
            {currentVideoSrc && !useStreamingAvatar && !useLiteAvatarMode && (
              <video
                ref={fallbackVideoRef}
                src={currentVideoSrc}
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover z-10"
                onEnded={handleVideoEnded}
              />
            )}
            
            {/* Placeholder when no avatar image available */}
            {!avatarUrl && !currentVideoSrc && (
              <div className="flex h-full flex-col items-center justify-center text-gray-400">
                <svg className="h-16 w-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm">
                  {avatarSpeechState === "connecting" ? "Connecting avatar..." : "Avatar will appear when session starts"}
                </span>
              </div>
            )}
            
            {/* Engagement Overlay - Full screen floating line */}
            {sessionReady && showEngagementGauge && (
              <EngagementOverlay
                level={engagementLevel}
                trend={engagementTrend}
              />
            )}

            {/* EQ Intelligence Gauges Overlay */}
            {sessionReady && (showSentimentGauge || showBuyingSignalGauge) && (
              <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-2">
                {showSentimentGauge && (
                  <SentimentGauge
                    trustScore={saleOutcome.trustScore}
                    size="sm"
                    showLabels={true}
                  />
                )}
                {showBuyingSignalGauge && (
                  <BuyingSignalIndicator
                    strength={buyingSignalStrength}
                    readyToClose={readyToClose}
                    size="sm"
                  />
                )}
              </div>
            )}

            {/* EQ Gauge Toggle Controls - Vertical stack on right side */}
            {sessionReady && (
              <div className="absolute top-12 right-2 z-20">
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-1.5 flex flex-col gap-1.5">
                  {/* Sentiment Toggle */}
                  <button
                    onClick={() => setShowSentimentGauge(!showSentimentGauge)}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      showSentimentGauge
                        ? "bg-purple-500/80 text-white shadow-lg shadow-purple-500/30"
                        : "bg-gray-600/50 text-gray-400 hover:bg-gray-500/50"
                    }`}
                    title="Toggle Sentiment Gauge"
                  >
                    <span className="text-base">😊</span>
                  </button>

                  {/* Engagement Toggle */}
                  <button
                    onClick={() => setShowEngagementGauge(!showEngagementGauge)}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      showEngagementGauge
                        ? "bg-green-500/80 text-white shadow-lg shadow-green-500/30"
                        : "bg-gray-600/50 text-gray-400 hover:bg-gray-500/50"
                    }`}
                    title="Toggle Engagement Gauge"
                  >
                    <span className="text-base">📊</span>
                  </button>

                  {/* Buying Signal Toggle */}
                  <button
                    onClick={() => setShowBuyingSignalGauge(!showBuyingSignalGauge)}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      showBuyingSignalGauge
                        ? "bg-blue-500/80 text-white shadow-lg shadow-blue-500/30"
                        : "bg-gray-600/50 text-gray-400 hover:bg-gray-500/50"
                    }`}
                    title="Toggle Buying Signal Indicator"
                  >
                    <span className="text-base">💰</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Avatar connection status indicator */}
            {useStreamingAvatar && !useLiteAvatarMode && avatarSpeechState === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <span className="text-sm">Connecting avatar...</span>
                </div>
              </div>
            )}
            
            {/* Loop generation prompt - shown when loops not ready */}
            {useLiteAvatarMode && !loopsReady && !isGeneratingLoops && liteAvatarAvailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-30">
                <div className="text-center text-white p-4">
                  <p className="text-sm mb-3">Avatar loops not generated yet.</p>
                  <button
                    onClick={generateLoops}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Generate Avatar Loops
                  </button>
                  <p className="text-xs text-gray-400 mt-2">This takes ~30 seconds (one-time setup)</p>
                </div>
              </div>
            )}
            
            {/* Loop generation progress indicator */}
            {useLiteAvatarMode && isGeneratingLoops && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-30">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <span className="text-sm">Generating avatar loops...</span>
                  <p className="text-xs text-gray-400 mt-1">This is a one-time setup</p>
                </div>
              </div>
            )}
            
            {/* LiteAvatar rendering status indicator */}
            {useLiteAvatarMode && !loopsReady && isLiteAvatarRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <span className="text-sm">Rendering avatar video...</span>
                </div>
              </div>
            )}
            
            {/* Avatar error indicator */}
            {avatarError && !useLiteAvatarMode && (
              <div className="absolute bottom-2 left-2 right-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
                Avatar unavailable: Using fallback mode
              </div>
            )}
            
            {/* LiteAvatar mode indicator */}
            {useLiteAvatarMode && liteAvatarAvailable && (
              <div className="absolute top-2 left-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded">
                LiteAvatar (Local)
              </div>
            )}
          </div>
          
          
          {/* Pre-flight Status Panel */}
          {!sessionReady && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-3">Preparing Session...</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {preflightStatus.session === "ready" ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                  )}
                  <span className={preflightStatus.session === "ready" ? "text-green-700" : "text-gray-600"}>
                    Session initialized
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {preflightStatus.avatar === "ready" ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : preflightStatus.avatar === "error" ? (
                    <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                  )}
                  <span className={
                    preflightStatus.avatar === "ready" ? "text-green-700" : 
                    preflightStatus.avatar === "error" ? "text-yellow-700" : "text-gray-600"
                  }>
                    {preflightStatus.avatar === "ready" ? "Avatar connected" : 
                     preflightStatus.avatar === "error" ? "Avatar unavailable (using fallback)" :
                     preflightStatus.avatar === "connecting" ? "Connecting avatar..." : "Waiting for avatar..."}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {!isListening ? (
                <button 
                  onClick={startListening} 
                  disabled={isProcessing || !sessionReady}
                  className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!sessionReady ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-white"></div>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  )}
                  {sessionReady ? "Start Conversation" : "Preparing..."}
                </button>
              ) : (
                <button 
                  onClick={stopListening} 
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-white hover:bg-green-500 transition-colors"
                >
                  <svg className="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  Listening... (click to stop)
                </button>
              )}
              <button 
                onClick={completeSession} 
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Complete Session
              </button>
              
              {/* LiteAvatar toggle - only show if available */}
              {liteAvatarAvailable && (
                <button
                  onClick={() => setUseLiteAvatarMode(!useLiteAvatarMode)}
                  className={`rounded-lg px-3 py-2 text-xs transition-colors ${
                    useLiteAvatarMode 
                      ? "bg-green-100 text-green-800 border border-green-300" 
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                  title={useLiteAvatarMode ? "Using LiteAvatar (local)" : "Click to use LiteAvatar"}
                >
                  {useLiteAvatarMode ? "🎭 LiteAvatar ON" : "🎭 LiteAvatar"}
                </button>
              )}
            </div>
            
            {/* Interim transcript display */}
            {interimTranscript && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <span className="font-medium">You&apos;re saying: </span>
                {interimTranscript}
              </div>
            )}
            
            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                Processing your message...
              </div>
            )}
            
            {/* Recognition error */}
            {recognitionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                Speech recognition error: {recognitionError.message}
              </div>
            )}
          </div>
        </div>
        
        {/* Transcript Panel */}
        <div>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="font-medium text-gray-900">Conversation</h3>
            </div>
            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Start speaking to begin the conversation...
                </p>
              ) : (
                <>
                  {transcript.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-3 text-sm ${
                        entry.role === "user"
                          ? "bg-blue-50 text-blue-900 ml-4"
                          : "bg-gray-100 text-gray-900 mr-4"
                      }`}
                    >
                      <div className="font-medium text-xs mb-1 opacity-70">
                        {entry.role === "user" ? "You" : personaInfo?.displayName || "Customer"}
                      </div>
                      {entry.content}
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
