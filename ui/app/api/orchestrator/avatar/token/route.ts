import { NextRequest } from "next/server";

export const runtime = "nodejs";

function getApiBaseUrl(): string {
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
  const target = `${base.replace(/\/$/, "")}/api/avatar/token`;

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  const body = await res.text();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(body, { status: res.status, headers });
}
