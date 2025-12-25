import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.FUNCTION_APP_BASE_URL || process.env.API_URL || "http://localhost:8050";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const response = await fetch(`${API_URL}/api/avatars/download/${params.jobId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get download status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting download status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
