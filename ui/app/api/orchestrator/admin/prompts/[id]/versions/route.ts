import { NextRequest } from "next/server";

export const runtime = "nodejs";

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const base = process.env.FUNCTION_APP_BASE_URL;
  if (!base) return new Response("Missing FUNCTION_APP_BASE_URL", { status: 500 });
  const target = `${base.replace(/\/$/, "")}/admin/prompts/${encodeURIComponent(params.id)}/versions`;
  const res = await fetch(target, { method: "GET" });
  const body = await res.text();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(body, { status: res.status, headers });
}
