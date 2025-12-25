import { NextRequest, NextResponse } from "next/server";

// Piper TTS is the primary TTS provider (local, fast, no API costs)
const PIPER_TTS_URL = process.env.PIPER_TTS_URL || "http://piper-tts:8000";
const FUNCTION_APP_BASE_URL = process.env.FUNCTION_APP_BASE_URL || "http://api:8000";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Missing text parameter" },
        { status: 400 }
      );
    }

    console.log(`[TTS Synthesize] Generating audio for: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Primary: Use Piper TTS (local neural TTS)
    try {
      console.log(`[TTS Synthesize] Trying Piper TTS at ${PIPER_TTS_URL}`);
      const piperResponse = await fetch(`${PIPER_TTS_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          input: text,
          voice: voice || "amy",
          speed: 1.0,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (piperResponse.ok) {
        const piperData = await piperResponse.json();
        
        console.log(`[TTS Synthesize] Piper TTS success, duration: ${piperData.duration_seconds?.toFixed(2)}s`);
        
        return NextResponse.json({
          success: true,
          provider: "piper",
          audio_base64: piperData.audio_base64,
          content_type: "audio/wav",
          duration_seconds: piperData.duration_seconds,
        });
      } else {
        const errorText = await piperResponse.text();
        console.error(`[TTS Synthesize] Piper TTS failed: ${piperResponse.status} - ${errorText}`);
        throw new Error(`Piper TTS failed: ${piperResponse.status}`);
      }
    } catch (piperError) {
      console.error("[TTS Synthesize] Piper TTS error:", piperError);
      
      // Fallback: Try backend API TTS (OpenAI/other cloud TTS)
      console.log("[TTS Synthesize] Falling back to backend API TTS...");
      try {
        const backendResponse = await fetch(`${FUNCTION_APP_BASE_URL}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text, 
            voiceId: voice || "alloy",
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (backendResponse.ok) {
          const audioBuffer = await backendResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioBuffer).toString("base64");
          
          console.log(`[TTS Synthesize] Backend TTS fallback success, audio size: ${audioBuffer.byteLength} bytes`);
          
          return NextResponse.json({
            success: true,
            provider: "openai",
            audio_base64: audioBase64,
            content_type: "audio/mpeg",
          });
        }
      } catch (backendError) {
        console.error("[TTS Synthesize] Backend TTS fallback also failed:", backendError);
      }
      
      // Both failed
      throw piperError;
    }

  } catch (error) {
    console.error("[TTS Synthesize] Error:", error);
    return NextResponse.json(
      { 
        error: "TTS synthesis failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 503 }
    );
  }
}
