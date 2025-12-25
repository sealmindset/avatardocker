import { NextRequest } from "next/server";

export const runtime = "nodejs";

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
  const base = process.env.FUNCTION_APP_BASE_URL;
  if (!base) {
    return new Response("Missing FUNCTION_APP_BASE_URL", { status: 500 });
  }

  const form = await req.formData();
  const target = `${base.replace(/\/$/, "")}/context`;

  const res = await fetch(target, {
    method: "POST",
    body: form,
  });

  const body = await res.text();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json" });
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(body, { status: res.status, headers });
}
