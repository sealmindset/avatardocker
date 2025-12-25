import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET() {
  const base = process.env.FUNCTION_APP_BASE_URL;
  if (!base) return new Response("Missing FUNCTION_APP_BASE_URL", { status: 500 });
  const target = `${base.replace(/\/$/, "")}/admin/prompts`;
  const res = await fetch(target, { method: "GET" });
  const body = await res.text();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(body, { status: res.status, headers });
}

export async function POST(req: NextRequest) {
  const base = process.env.FUNCTION_APP_BASE_URL;
  if (!base) return new Response("Missing FUNCTION_APP_BASE_URL", { status: 500 });
  const json = await req.json();
  const target = `${base.replace(/\/$/, "")}/admin/prompts`;
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
