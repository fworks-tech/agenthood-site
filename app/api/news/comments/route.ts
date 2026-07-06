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

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("comments.turnstile_secret_missing");
    }
    return true;
  }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }),
    });
    const result = await res.json() as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

function parseComment(raw: string): Comment | null {
  try {
    const c = JSON.parse(raw) as Comment;
    if (c.id && c.name && c.text && c.date) return c;
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: { name?: string; text?: string; token?: string; slug?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
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
  await KV.rpush(key, JSON.stringify(comment));

  return NextResponse.json({ success: true, comment });
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!KV) {
    return NextResponse.json({ comments: [] });
  }

  const key = `news:comments:${slug}`;
  const raw = await KV.lrange(key, 0, -1);
  const comments: Comment[] = (raw ?? []).map(parseComment).filter(Boolean) as Comment[];
  return NextResponse.json({ comments });
}
