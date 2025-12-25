"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SESSION_ID_KEY = "pulse_session_id";

// Development mode test session ID - set via env var or defaults to a fixed ID
// This ensures consistent session tracking during development
const DEV_SESSION_ID = process.env.NEXT_PUBLIC_DEV_SESSION_ID || "dev-test-session-001";

export type ScenarioFiltersState = {
  step?: string;
  objection?: string;
  framework?: string;
};

export type AvatarState = "idle" | "speaking" | "listening" | "thinking";

export type PersonaInfo = {
  type: string;
  displayName: string;
  avatarId?: string;
  voiceId?: string;
};

type SessionState = {
  persona: string | null;
  personaInfo: PersonaInfo | null;
  filters: ScenarioFiltersState;
  sessionId: string | null;
  avatarUrl: string | null;
  avatarVideoUrl: string | null;
  avatarState: AvatarState;
  // Avatar swap: track current session's avatar/voice
  sessionAvatarId: string | null;
  sessionVoiceId: string | null;
  setPersona: (p: string | null) => void;
  setPersonaInfo: (info: PersonaInfo | null) => void;
  setFilters: (f: ScenarioFiltersState) => void;
  setSessionId: (id: string | null) => void;
  setAvatarUrl: (u: string | null) => void;
  setAvatarVideoUrl: (u: string | null) => void;
  setAvatarState: (s: AvatarState) => void;
  setSessionAvatarId: (id: string | null) => void;
  setSessionVoiceId: (id: string | null) => void;
};

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<string | null>(null);
  const [personaInfo, setPersonaInfo] = useState<PersonaInfo | null>(null);
  const [filters, setFilters] = useState<ScenarioFiltersState>({});
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  // Avatar swap: track current session's avatar/voice
  const [sessionAvatarId, setSessionAvatarId] = useState<string | null>(null);
  const [sessionVoiceId, setSessionVoiceId] = useState<string | null>(null);

  // Check if we're in dev mode (use test session ID)
  const isDevMode = process.env.NODE_ENV === "development" || 
                    process.env.NEXT_PUBLIC_USE_DEV_SESSION === "true";

  // Load session ID from localStorage on mount, or use dev session ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isDevMode && !localStorage.getItem(SESSION_ID_KEY)) {
        // In dev mode, auto-set the test session ID if none exists
        console.log("[SessionContext] Dev mode: using test session ID:", DEV_SESSION_ID);
        setSessionIdState(DEV_SESSION_ID);
        localStorage.setItem(SESSION_ID_KEY, DEV_SESSION_ID);
      } else {
        const stored = localStorage.getItem(SESSION_ID_KEY);
        if (stored) {
          setSessionIdState(stored);
        }
      }
    }
  }, [isDevMode]);

  // Wrapper to persist session ID to localStorage
  const setSessionId = (id: string | null) => {
    setSessionIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(SESSION_ID_KEY, id);
      } else {
        localStorage.removeItem(SESSION_ID_KEY);
      }
    }
  };

  const value = useMemo(
    () => ({
      persona,
      personaInfo,
      filters,
      sessionId,
      avatarUrl,
      avatarVideoUrl,
      avatarState,
      sessionAvatarId,
      sessionVoiceId,
      setPersona,
      setPersonaInfo,
      setFilters,
      setSessionId,
      setAvatarUrl,
      setAvatarVideoUrl,
      setAvatarState,
      setSessionAvatarId,
      setSessionVoiceId,
    }),
    [persona, personaInfo, filters, sessionId, avatarUrl, avatarVideoUrl, avatarState, sessionAvatarId, sessionVoiceId]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
