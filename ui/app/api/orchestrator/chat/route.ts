import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Get API base URL - supports both Docker local and Azure deployments
function getApiBaseUrl(): string {
  // Server-side: use FUNCTION_APP_BASE_URL (Docker internal network)
  // Fallback to NEXT_PUBLIC_API_URL for local dev outside Docker
  return process.env.FUNCTION_APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8050";
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  const base = getApiBaseUrl();

  const json = await req.json();
  const target = `${base.replace(/\/$/, "")}/api/chat`;

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  // Parse and remap response fields for UI compatibility
  const data = await res.json();
  
  // Check if session should end due to critical misstep
  const sessionEndedByMisstep = data.missteps?.some((m: { ends_session?: boolean }) => m.ends_session) || false;
  
  const mappedData = {
    ...data,
    aiResponse: data.response, // Map 'response' to 'aiResponse' for UI
    pulseStage: data.currentStage,
    pulseStageName: data.stageName,
    // Map saleOutcome to object format expected by UI
    saleOutcome: {
      status: sessionEndedByMisstep ? "lost" : (data.saleOutcome || "in_progress"),
      trustScore: data.trustScore ?? 5,
      feedback: data.missteps?.length > 0 
        ? data.missteps[0].response_hint 
        : "",
      misstepsThisTurn: data.missteps?.map((m: { id: string }) => m.id) || [],
    },
    // Also include emotion for avatar
    avatarEmotion: data.emotion || "neutral",
    // Flag for session-ending missteps (sexual harassment, etc.)
    sessionEndedByMisstep,
    misstepSeverity: data.missteps?.[0]?.severity || null,
  };

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(JSON.stringify(mappedData), { status: res.status, headers });
}
