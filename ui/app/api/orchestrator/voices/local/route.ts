import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8050";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/voices/local`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch local voices" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching local voices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
