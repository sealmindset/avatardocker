import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://api:8000";

export const dynamic = "force-dynamic";

/**
 * GET /api/personas/[personaKey]
 * Get a specific persona by key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { personaKey: string } }
) {
  try {
    const response = await fetch(`${API_URL}/api/personas/${params.personaKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to get persona" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Persona API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get persona" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/personas/[personaKey]
 * Update a persona's configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { personaKey: string } }
) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/personas/${params.personaKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to update persona" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Persona API] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update persona" },
      { status: 500 }
    );
  }
}
