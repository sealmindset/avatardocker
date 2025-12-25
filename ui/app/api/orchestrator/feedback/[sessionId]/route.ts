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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const base = getApiBaseUrl();

  const target = `${base.replace(/\/$/, "")}/api/feedback/${encodeURIComponent(params.sessionId)}`;
  const res = await fetch(target, { method: "GET" });

  const body = await res.text();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(body, { status: res.status, headers });
}
