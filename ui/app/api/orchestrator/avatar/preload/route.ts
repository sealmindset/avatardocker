import { NextRequest, NextResponse } from "next/server";

/**
 * Avatar Preload Endpoint
 * 
 * Preloads avatars into the LiteAvatar cache to reduce latency
 * when starting a training session.
 * 
 * Call this endpoint when:
 * - User selects a persona (preload that persona's avatar)
 * - Session is about to start (preload the session's avatar)
 */

// Get LiteAvatar URL based on AVATAR_MODE
function getLiteAvatarUrl(): string {
  const avatarMode = process.env.AVATAR_MODE || "docker";
  if (avatarMode === "native") {
    return "http://host.docker.internal:8060";
  }
  return "http://avatar:8080";
}

export const dynamic = "force-dynamic";

interface PreloadRequest {
  avatar_ids: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: PreloadRequest = await request.json();
    const { avatar_ids } = body;

    if (!avatar_ids || !Array.isArray(avatar_ids) || avatar_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid avatar_ids array" },
        { status: 400 }
      );
    }

    console.log(`[Avatar Preload] Preloading ${avatar_ids.length} avatar(s): ${avatar_ids.join(", ")}`);

    const liteAvatarUrl = getLiteAvatarUrl();
    
    const response = await fetch(`${liteAvatarUrl}/cache/preload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_ids }),
      signal: AbortSignal.timeout(120000), // 2 minutes for preloading
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Avatar Preload] Failed: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: "Avatar preload failed", details: errorText },
        { status: 503 }
      );
    }

    const data = await response.json();
    console.log(`[Avatar Preload] Complete: ${JSON.stringify(data)}`);

    return NextResponse.json({
      success: true,
      ...data,
    });

  } catch (error) {
    console.error("[Avatar Preload] Error:", error);
    return NextResponse.json(
      { 
        error: "Avatar preload failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check cache stats
 */
export async function GET() {
  try {
    const liteAvatarUrl = getLiteAvatarUrl();
    
    const response = await fetch(`${liteAvatarUrl}/cache/stats`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to get cache stats", details: errorText },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[Avatar Cache Stats] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get cache stats",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
