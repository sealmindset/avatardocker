import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://api:8000";

export const dynamic = "force-dynamic";

/**
 * GET /api/personas
 * Get all personas with their avatar/voice configurations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") !== "false";

    const response = await fetch(`${API_URL}/api/personas?active_only=${activeOnly}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to get personas" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Personas API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get personas" },
      { status: 500 }
    );
  }
}
