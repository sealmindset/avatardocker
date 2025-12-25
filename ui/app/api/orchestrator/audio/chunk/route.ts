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
  const target = `${base.replace(/\/$/, "")}/audio/chunk`;

  const res = await fetch(target, {
    method: "POST",
    body: form,
  });

  const data = await res.arrayBuffer();
  const headers = new Headers();
  res.headers.forEach((v, k) => headers.set(k, v));
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(data, {
    status: res.status,
    headers,
  });
}
