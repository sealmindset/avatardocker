import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for video rendering

// Get LiteAvatar service URL based on AVATAR_MODE
// native mode: use host.docker.internal to reach native macOS service (MPS/Metal GPU)
// docker mode: use avatar container name (CPU only)
function getLiteAvatarUrl(): string {
  const avatarMode = process.env.AVATAR_MODE || "native";
  
  // If LITE_AVATAR_URL is a full URL, use it directly
  if (process.env.LITE_AVATAR_URL?.startsWith("http")) {
    return process.env.LITE_AVATAR_URL;
  }
  
  if (avatarMode === "native") {
    // Native mode: avatar runs on host macOS with MPS/Metal GPU
    // Use host.docker.internal to reach the host from inside Docker
    return "http://host.docker.internal:8060";
  } else {
    // Docker mode: avatar runs in container (CPU only)
    return "http://avatar:8080";
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Health check, avatar list, and loop videos
export async function GET(req: NextRequest) {
  const base = getLiteAvatarUrl();
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint") || "health";

  try {
    const target = `${base}/${endpoint}`;
    
    // Use AbortController with 2 minute timeout for health checks (first request can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
    
    const res = await fetch(target, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // For loop video endpoints, return the video directly
    if (endpoint.startsWith("loops/") && !endpoint.includes("status")) {
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Loop video not found" }),
          { status: res.status, headers: { "Content-Type": "application/json" } }
        );
      }
      const videoBuffer = await res.arrayBuffer();
      return new Response(videoBuffer, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[LiteAvatar API] GET error:", error);
    return new Response(
      JSON.stringify({ error: "LiteAvatar service unavailable", details: String(error) }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Render avatar video from audio, or generate loops
export async function POST(req: NextRequest) {
  const base = getLiteAvatarUrl();
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");

  try {
    // Handle loop generation
    if (endpoint === "loops/generate") {
      // Parse request body to get avatar_id
      let requestBody: { avatar_id?: string } = {};
      try {
        requestBody = await req.json();
      } catch {
        // No body provided, use defaults
      }
      
      console.log("[LiteAvatar API] Generating loop videos for avatar:", requestBody.avatar_id || "default");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
      
      const res = await fetch(`${base}/loops/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      console.log("[LiteAvatar API] Loop generation result:", data);
      
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const json = await req.json();
    const target = `${base}/render`;

    // Map camelCase to snake_case for backend compatibility
    const requestBody = {
      audio_base64: json.audioBase64 || json.audio_base64,
      avatar_id: json.avatarId || json.avatar_id || "default",
    };

    console.log("[LiteAvatar API] Rendering avatar video, audio length:", requestBody.audio_base64?.length || 0);

    // Use AbortController with 5 minute timeout for long renders
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error("[LiteAvatar API] Render failed:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Render failed", status: res.status, details: text }),
        {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await res.json();
    console.log("[LiteAvatar API] Render complete:", data.frames, "frames,", data.duration_seconds, "seconds");

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[LiteAvatar API] POST error:", error);
    return new Response(
      JSON.stringify({ error: "LiteAvatar render failed", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
