import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

const KV = process.env.KV_URL && process.env.KV_TOKEN
  ? new Redis({ url: process.env.KV_URL, token: process.env.KV_TOKEN })
  : null;

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";

interface Comment {
  id: string;
  name: string;
  text: string;
  date: string;
}

function slugFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const match = url.pathname.match(/^\/news\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }),
    });
    const data = await res.json() as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const slug = slugFromReferer(request.headers.get("referer"));
  if (!slug) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  let body: { name?: string; text?: string; token?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 50);
  const text = (body.text ?? "").trim().slice(0, 2000);
  const token = (body.token ?? "").trim();

  if (!name || !text) {
    return NextResponse.json({ error: "Name and comment are required" }, { status: 400 });
  }

  if (!token || !(await verifyTurnstile(token))) {
    return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
  }

  if (!KV) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const comment: Comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    text,
    date: new Date().toISOString(),
  };

  const key = `news:comments:${slug}`;
  const existing = await KV.get<Comment[]>(key) ?? [];
  existing.push(comment);
  await KV.set(key, existing);

  return NextResponse.json({ success: true, comment });
}

export async function GET(request: NextRequest) {
  const slug = slugFromReferer(request.headers.get("referer")) ?? request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!KV) {
    return NextResponse.json({ comments: [] });
  }

  const key = `news:comments:${slug}`;
  const comments = await KV.get<Comment[]>(key) ?? [];
  return NextResponse.json({ comments });
}
