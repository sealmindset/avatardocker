import { NextRequest, NextResponse } from "next/server";

/**
 * Combined TTS + Avatar Render endpoint
 * 
 * Flow: Text → Piper TTS → Audio → LiteAvatar → Video
 * 
 * This provides a single endpoint for text-to-video avatar rendering.
 */

const PIPER_TTS_URL = process.env.PIPER_TTS_URL || "http://piper-tts:8000";

// Get LiteAvatar URL based on AVATAR_MODE
function getLiteAvatarUrl(): string {
  const avatarMode = process.env.AVATAR_MODE || "docker";
  if (avatarMode === "native") {
    return "http://host.docker.internal:8060";
  }
  return "http://avatar:8080";
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for video rendering

interface SpeakRequest {
  text: string;
  voice?: string;
  avatar_id?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: SpeakRequest = await request.json();
    const { text, voice, avatar_id } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Missing text parameter" },
        { status: 400 }
      );
    }

    console.log(`[Avatar Speak] Starting: "${text.substring(0, 50)}..." voice=${voice} avatar=${avatar_id}`);

    // Step 1: Generate TTS audio using Piper
    console.log(`[Avatar Speak] Step 1: Generating TTS audio via Piper...`);
    const ttsResponse = await fetch(`${PIPER_TTS_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        input: text,
        voice: voice || "amy",
        speed: 1.0,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error(`[Avatar Speak] TTS failed: ${ttsResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: "TTS synthesis failed", details: errorText },
        { status: 503 }
      );
    }

    const ttsData = await ttsResponse.json();
    const ttsTime = Date.now() - startTime;
    console.log(`[Avatar Speak] TTS complete: ${ttsData.duration_seconds?.toFixed(2)}s audio in ${ttsTime}ms`);

    // Step 2: Render avatar video with lip sync
    console.log(`[Avatar Speak] Step 2: Rendering avatar video via LiteAvatar...`);
    const renderStartTime = Date.now();
    
    const liteAvatarUrl = getLiteAvatarUrl();
    console.log(`[Avatar Speak] Using LiteAvatar at: ${liteAvatarUrl}`);
    
    const renderResponse = await fetch(`${liteAvatarUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_base64: ttsData.audio_base64,
        avatar_id: avatar_id || "default",
      }),
      signal: AbortSignal.timeout(300000), // 5 minutes for long renders
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error(`[Avatar Speak] Render failed: ${renderResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: "Avatar render failed", details: errorText },
        { status: 503 }
      );
    }

    const renderData = await renderResponse.json();
    const renderTime = Date.now() - renderStartTime;
    const totalTime = Date.now() - startTime;
    
    console.log(`[Avatar Speak] Complete: ${renderData.frames} frames, ${renderData.duration_seconds?.toFixed(2)}s video`);
    console.log(`[Avatar Speak] Timing: TTS=${ttsTime}ms, Render=${renderTime}ms, Total=${totalTime}ms`);

    return NextResponse.json({
      success: true,
      video_base64: renderData.video_base64,
      audio_base64: ttsData.audio_base64,
      duration_seconds: renderData.duration_seconds,
      frames: renderData.frames,
      timing: {
        tts_ms: ttsTime,
        render_ms: renderTime,
        total_ms: totalTime,
      },
    });

  } catch (error) {
    console.error("[Avatar Speak] Error:", error);
    return NextResponse.json(
      { 
        error: "Avatar speak failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
