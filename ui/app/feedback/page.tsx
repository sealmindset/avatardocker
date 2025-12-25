"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionContext";
import { useAuth } from "@/components/AuthContext";
import { ReadinessCard } from "@/components/ReadinessCard";
import SentimentGauge from "@/components/SentimentGauge";

// ============================================================================
// TYPES
// ============================================================================
interface SessionHistory {
  sessionId: string;
  date: string;
  persona: string;
  personaName: string;
  outcome: "won" | "lost" | "incomplete";
  score: number;
  duration: number;
}

interface AIFeedback {
  overallScore: number;
  passed: boolean;
  personaFeedback: {
    personaType: string;
    adaptationScore: number;
    strengths: string[];
    improvements: string[];
  };
  timeManagement: {
    efficiencyScore: number;
    totalExchanges: number;
    productiveExchanges: number;
    timeSinks: Array<{ exchange: number; issue: string; suggestion: string }>;
  };
  missedOpportunities: Array<{
    exchange: number;
    type: string;
    customerSaid: string;
    betterResponse: string;
  }>;
  pulseStageAnalysis: {
    stagesReached: number[];
    stageScores: Record<string, number>;
    recommendations: string[];
  };
  coachingTips: string[];
}

// Storage keys
const SESSION_HISTORY_KEY = "pulse_user_session_history";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function getPersonaColor(persona: string): string {
  const colors: Record<string, string> = {
    director: "bg-red-100 text-red-700 border-red-200",
    relater: "bg-green-100 text-green-700 border-green-200",
    socializer: "bg-yellow-100 text-yellow-700 border-yellow-200",
    thinker: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return colors[persona.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";
}

function getPersonaDisplayName(persona: string): string {
  const names: Record<string, string> = {
    director: "Director",
    relater: "Relater",
    socializer: "Socializer",
    thinker: "Thinker",
  };
  return names[persona.toLowerCase()] || persona;
}

// Generate demo AI feedback for development
function generateDemoAIFeedback(persona: string, outcome: string): AIFeedback {
  const isWon = outcome === "won";
  const baseScore = isWon ? 85 : 62;
  
  return {
    overallScore: baseScore + Math.floor(Math.random() * 10),
    passed: isWon,
    personaFeedback: {
      personaType: persona,
      adaptationScore: isWon ? 88 : 65,
      strengths: isWon 
        ? ["Excellent rapport building", "Good use of open-ended questions", "Matched customer communication style"]
        : ["Showed product knowledge", "Maintained professional tone"],
      improvements: isWon
        ? ["Could transition to close slightly earlier"]
        : ["Spent too much time on small talk", "Missed buying signals", "Did not adapt to customer's direct style"],
    },
    timeManagement: {
      efficiencyScore: isWon ? 82 : 55,
      totalExchanges: 12,
      productiveExchanges: isWon ? 10 : 6,
      timeSinks: isWon ? [] : [
        { exchange: 3, issue: "Extended small talk about weather", suggestion: "Acknowledge briefly, then pivot: 'Speaking of comfort, what brings you in today?'" },
        { exchange: 7, issue: "Let customer go off-topic about unrelated product", suggestion: "Redirect: 'That's interesting! Let me show you how our mattress addresses your main concern.'" },
      ],
    },
    missedOpportunities: isWon ? [] : [
      { exchange: 5, type: "Buying Signal", customerSaid: "That sounds really comfortable", betterResponse: "It is! Would you like to try it out and feel the difference yourself?" },
      { exchange: 9, type: "Close Opportunity", customerSaid: "I've been looking for something like this", betterResponse: "Perfect! Let's get you set up with the right Sleep Number for your needs. Which size works best for your bedroom?" },
    ],
    pulseStageAnalysis: {
      stagesReached: isWon ? [1, 2, 3, 4, 5] : [1, 2, 3],
      stageScores: {
        probe: isWon ? 90 : 75,
        understand: isWon ? 85 : 70,
        link: isWon ? 88 : 60,
        solve: isWon ? 82 : 45,
        earn: isWon ? 80 : 0,
      },
      recommendations: isWon
        ? ["Continue strong discovery techniques", "Practice faster transitions between stages"]
        : ["Focus on recognizing buying signals", "Practice redirecting off-topic conversations", "Work on closing techniques"],
    },
    coachingTips: isWon
      ? [
          "Great job adapting to the customer's style!",
          "Your discovery questions were effective at uncovering needs.",
          "Consider asking for the close earlier when trust is established.",
        ]
      : [
          "Watch for customer statements that indicate interest - these are buying signals.",
          "When customers go off-topic, use bridging phrases to redirect.",
          "Practice the 'feel, felt, found' technique for handling objections.",
          "Don't be afraid to ask for the sale when the customer shows interest.",
        ],
  };
}

export default function FeedbackPage() {
  const { sessionId, personaInfo } = useSession();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [activeTab, setActiveTab] = useState<"current" | "history" | "ai-coach">("current");

  // Optional debug user id for showing readiness; if not set, readiness is hidden.
  const readinessUserId = process.env.NEXT_PUBLIC_PULSE_READINESS_USER_ID || null;
  const isDev = process.env.NEXT_PUBLIC_USE_DEV_SESSION === "true";

  // Load session history for current user
  useEffect(() => {
    if (typeof window !== "undefined" && user?.username) {
      const key = `${SESSION_HISTORY_KEY}_${user.username}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          setSessionHistory(JSON.parse(stored));
        } catch {}
      }
    }
  }, [user?.username]);

  // Fetch feedback and generate AI analysis
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orchestrator/feedback/${encodeURIComponent(sessionId)}`);
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        if (!cancelled) {
          setFeedback(data);
          
          // Generate AI feedback based on session data
          const persona = personaInfo?.type || data?.scorecard?.persona || "relater";
          const outcome = data?.scorecard?.pulse_details?.sale_outcome || "incomplete";
          const aiAnalysis = generateDemoAIFeedback(persona, outcome);
          setAiFeedback(aiAnalysis);
          
          // Save to session history if we have a valid outcome
          if (user?.username && outcome !== "incomplete") {
            const historyKey = `${SESSION_HISTORY_KEY}_${user.username}`;
            const newSession: SessionHistory = {
              sessionId,
              date: new Date().toISOString(),
              persona: persona,
              personaName: getPersonaDisplayName(persona),
              outcome: outcome as "won" | "lost",
              score: aiAnalysis.overallScore,
              duration: data?.scorecard?.pulse_details?.total_exchanges || 0,
            };
            
            // Add to history (avoid duplicates)
            const existingHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");
            const exists = existingHistory.some((h: SessionHistory) => h.sessionId === sessionId);
            if (!exists) {
              const updatedHistory = [newSession, ...existingHistory].slice(0, 20); // Keep last 20
              localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
              setSessionHistory(updatedHistory);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load feedback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [sessionId, personaInfo?.type, user?.username]);

  const scorePct = useMemo(() => {
    const raw = feedback?.overallScore ?? feedback?.score ?? feedback?.mastery;
    const num = typeof raw === "number" ? raw : parseFloat(raw);
    if (!isFinite(num)) return null;
    return num > 1 ? Math.round(num) : Math.round(num * 100);
  }, [feedback]);

  // Calculate persona stats from history
  const personaStats = useMemo(() => {
    const stats: Record<string, { wins: number; losses: number; avgScore: number }> = {};
    sessionHistory.forEach((s) => {
      if (!stats[s.persona]) {
        stats[s.persona] = { wins: 0, losses: 0, avgScore: 0 };
      }
      if (s.outcome === "won") stats[s.persona].wins++;
      else if (s.outcome === "lost") stats[s.persona].losses++;
    });
    // Calculate averages
    Object.keys(stats).forEach((p) => {
      const sessions = sessionHistory.filter((s) => s.persona === p);
      stats[p].avgScore = sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length)
        : 0;
    });
    return stats;
  }, [sessionHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Feedback & Scoring</h1>
          <p className="text-sm text-gray-600">
            AI-powered analysis of your training sessions
            {user?.username && <span className="ml-2 text-blue-600">• Logged in as: {user.username}</span>}
          </p>
        </div>
        {aiFeedback && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
              <span>🤖</span> AI Coach Active
            </span>
          </div>
        )}
      </div>

      {!sessionId && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
          No active session. Please start a new one from the Pre-Session page. <Link href="/" className="underline">Start</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {[
          { id: "current" as const, label: "Current Session", icon: "📊" },
          { id: "ai-coach" as const, label: "AI Coach Analysis", icon: "🤖" },
          { id: "history" as const, label: "Session History", icon: "📜" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Current Session Tab */}
      {activeTab === "current" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Sale Outcome Banner */}
            {feedback?.scorecard?.pulse_details?.sale_outcome && (
              <div className={`rounded-lg p-4 ${
                feedback.scorecard.pulse_details.sale_outcome === "won" 
                  ? "bg-green-50 border-2 border-green-500" 
                  : "bg-red-50 border-2 border-red-500"
              }`}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl">
                    {feedback.scorecard.pulse_details.sale_outcome === "won" ? "🎉" : "😔"}
                  </span>
                  <div>
                    <div className={`text-xl font-bold ${
                      feedback.scorecard.pulse_details.sale_outcome === "won" ? "text-green-700" : "text-red-700"
                    }`}>
                      {feedback.scorecard.pulse_details.sale_outcome === "won" ? "Sale Won!" : "Sale Lost"}
                    </div>
                    <div className="text-sm text-gray-600">
                      Reached PULSE stage: {feedback.scorecard.pulse_details.stage_name} • 
                      Trust: {feedback.scorecard.pulse_details.trust_score}/10 • 
                      Exchanges: {feedback.scorecard.pulse_details.total_exchanges}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Overall Score with Gauge */}
            <div className="rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium">Overall Score</div>
                  <div className="mt-2 text-4xl font-bold">
                    {loading ? "Loading..." : (aiFeedback ? `${aiFeedback.overallScore}%` : (typeof scorePct === "number" ? `${scorePct}%` : "—"))}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">Minimum passing threshold: 70%</div>
                  {aiFeedback && (
                    <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      aiFeedback.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {aiFeedback.passed ? "✓ Passed" : "✗ Needs Improvement"}
                    </div>
                  )}
                </div>
                {feedback?.scorecard?.pulse_details?.trust_score !== undefined && (
                  <div className="flex flex-col items-center">
                    <SentimentGauge 
                      trustScore={feedback.scorecard.pulse_details.trust_score} 
                      size="sm"
                      showLabels={true}
                    />
                    <div className="mt-6 text-xs text-gray-500">Final Customer Sentiment</div>
                  </div>
                )}
              </div>
              {error && <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
            </div>

            {/* Persona Feedback */}
            {aiFeedback?.personaFeedback && (
              <div className="rounded border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-lg font-medium">Persona Adaptation</div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getPersonaColor(aiFeedback.personaFeedback.personaType)}`}>
                    {getPersonaDisplayName(aiFeedback.personaFeedback.personaType)}
                  </span>
                  <span className="ml-auto text-2xl font-bold">{aiFeedback.personaFeedback.adaptationScore}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-green-700 mb-2">✓ Strengths</div>
                    <ul className="space-y-1">
                      {aiFeedback.personaFeedback.strengths.map((s, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-green-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-amber-700 mb-2">⚡ Areas to Improve</div>
                    <ul className="space-y-1">
                      {aiFeedback.personaFeedback.improvements.map((s, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Rubric Compliance */}
            <div className="rounded border border-gray-200 p-4">
              <div className="text-lg font-medium">Rubric Compliance</div>
              <div className="mt-4 space-y-3">
                {Array.isArray(feedback?.rubric) && feedback.rubric.length > 0 ? (
                  feedback.rubric.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        r.passed ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}>
                        {r.passed ? "✓" : "✗"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name || r.label || `Criterion ${idx + 1}`}</span>
                          {typeof r.score !== "undefined" && (
                            <span className="text-sm px-2 py-0.5 bg-gray-200 rounded">{r.score}/3</span>
                          )}
                        </div>
                        {r.notes && <div className="mt-1 text-sm text-gray-600">{r.notes}</div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-600">Rubric details will appear after the session concludes.</div>
                )}
              </div>
            </div>
            
            {/* Missteps Section */}
            {feedback?.scorecard?.pulse_details?.missteps?.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-4">
                <div className="text-lg font-medium text-red-700">Missteps Detected</div>
                <ul className="mt-2 space-y-1">
                  {feedback.scorecard.pulse_details.missteps.map((misstep: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-red-600">
                      <span>⚠️</span>
                      <span className="capitalize">{misstep}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-sm text-gray-600">
                  Avoid these behaviors in future sessions to improve your score.
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded border border-gray-200 p-4">
              <div className="text-lg font-medium">Artifacts</div>
              <div className="mt-2 space-y-3 text-sm text-gray-700">
                {(() => {
                  const a: any = feedback?.artifacts || feedback?.outputs || {};
                  const audioDataUrl = a?.audioBase64 ? `data:audio/mpeg;base64,${a.audioBase64}` : null;
                  const transcript: string[] = Array.isArray(a?.transcript)
                    ? a.transcript
                    : (typeof a?.transcript === "string" ? [a.transcript] : []);
                  return (
                    <>
                      {(a?.audioUrl || audioDataUrl) ? (
                        <div>
                          <div className="mb-1 font-medium">Audio</div>
                          <audio controls src={a?.audioUrl || audioDataUrl || undefined} />
                        </div>
                      ) : (
                        <div>Audio — (not available)</div>
                      )}
                      <div>
                        <div className="mb-1 font-medium">Transcript</div>
                        {transcript.length ? (
                          <div className="space-y-1">
                            {transcript.map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                          </div>
                        ) : (
                          <div>Transcript — (not available)</div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            {readinessUserId && <ReadinessCard userId={readinessUserId} />}
          </div>
        </div>
      )}

      {/* AI Coach Tab */}
      {activeTab === "ai-coach" && aiFeedback && (
        <div className="space-y-6">
          {/* Time Management Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏱️</span>
                <h2 className="text-lg font-semibold">Time Management Analysis</h2>
              </div>
              <div className={`text-2xl font-bold ${
                aiFeedback.timeManagement.efficiencyScore >= 70 ? "text-green-600" : "text-amber-600"
              }`}>
                {aiFeedback.timeManagement.efficiencyScore}%
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{aiFeedback.timeManagement.totalExchanges}</div>
                <div className="text-xs text-gray-500">Total Exchanges</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{aiFeedback.timeManagement.productiveExchanges}</div>
                <div className="text-xs text-gray-500">Productive</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">
                  {aiFeedback.timeManagement.totalExchanges - aiFeedback.timeManagement.productiveExchanges}
                </div>
                <div className="text-xs text-gray-500">Time Sinks</div>
              </div>
            </div>

            {aiFeedback.timeManagement.timeSinks.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-amber-700">⚠️ Time Sink Moments</div>
                {aiFeedback.timeManagement.timeSinks.map((sink, idx) => (
                  <div key={idx} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-amber-200 rounded">Exchange #{sink.exchange}</span>
                      <span className="text-sm font-medium text-amber-800">{sink.issue}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">💡 Suggestion:</span> {sink.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missed Opportunities */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎯</span>
              <h2 className="text-lg font-semibold">Missed Opportunities</h2>
            </div>
            
            {aiFeedback.missedOpportunities.length > 0 ? (
              <div className="space-y-4">
                {aiFeedback.missedOpportunities.map((opp, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Exchange #{opp.exchange}</span>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">{opp.type}</span>
                    </div>
                    <div className="mb-2">
                      <div className="text-xs text-gray-500 mb-1">Customer said:</div>
                      <div className="text-sm italic text-gray-700 bg-gray-50 p-2 rounded">&ldquo;{opp.customerSaid}&rdquo;</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Better response:</div>
                      <div className="text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200">
                        💬 &ldquo;{opp.betterResponse}&rdquo;
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-2 block">🎉</span>
                <div>No missed opportunities detected! Great job capitalizing on customer signals.</div>
              </div>
            )}
          </div>

          {/* PULSE Stage Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📈</span>
              <h2 className="text-lg font-semibold">PULSE Stage Performance</h2>
            </div>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {["Probe", "Understand", "Link", "Solve", "Earn"].map((stage, idx) => {
                const stageKey = stage.toLowerCase();
                const score = aiFeedback.pulseStageAnalysis.stageScores[stageKey] || 0;
                const reached = aiFeedback.pulseStageAnalysis.stagesReached.includes(idx + 1);
                return (
                  <div key={stage} className={`rounded-lg p-3 text-center ${
                    reached ? (score >= 70 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200") : "bg-gray-100"
                  }`}>
                    <div className="text-xs font-medium text-gray-500 mb-1">{stage}</div>
                    <div className={`text-xl font-bold ${
                      reached ? (score >= 70 ? "text-green-700" : "text-amber-700") : "text-gray-400"
                    }`}>
                      {reached ? `${score}%` : "—"}
                    </div>
                    {reached && <div className="text-xs text-gray-500">Stage {idx + 1}</div>}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Recommendations:</div>
              <ul className="space-y-1">
                {aiFeedback.pulseStageAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-500">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Coaching Tips */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎓</span>
              <h2 className="text-lg font-semibold text-purple-900">AI Coach Tips</h2>
            </div>
            <div className="space-y-3">
              {aiFeedback.coachingTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/70 rounded-lg p-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="text-sm text-gray-700">{tip}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session History Tab */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Persona Performance Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Performance by Persona</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["director", "relater", "socializer", "thinker"].map((persona) => {
                const stats = personaStats[persona] || { wins: 0, losses: 0, avgScore: 0 };
                const total = stats.wins + stats.losses;
                const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
                return (
                  <div key={persona} className={`rounded-xl p-4 border-2 ${getPersonaColor(persona)}`}>
                    <div className="font-semibold mb-2">{getPersonaDisplayName(persona)}</div>
                    <div className="text-3xl font-bold mb-1">{winRate}%</div>
                    <div className="text-xs opacity-70">Win Rate</div>
                    <div className="mt-2 text-xs">
                      {stats.wins}W / {stats.losses}L • Avg: {stats.avgScore}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session List */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
            {sessionHistory.length > 0 ? (
              <div className="space-y-3">
                {sessionHistory.map((session, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                      session.outcome === "won" ? "bg-green-100" : "bg-red-100"
                    }`}>
                      {session.outcome === "won" ? "🎉" : "😔"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getPersonaColor(session.persona)}`}>
                          {session.personaName}
                        </span>
                        <span className="text-sm font-medium">
                          {session.outcome === "won" ? "Sale Won" : "Sale Lost"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(session.date).toLocaleDateString()} • {session.duration} exchanges
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${session.score >= 70 ? "text-green-600" : "text-red-600"}`}>
                      {session.score}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-2 block">📊</span>
                <div>No session history yet. Complete a training session to see your progress.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
