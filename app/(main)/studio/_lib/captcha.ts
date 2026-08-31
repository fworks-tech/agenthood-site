import { CaptchaError } from "./errors";
import { logger } from "./logger";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED !== "false";
const TURNSTILE_REQUIRED = process.env.TURNSTILE_REQUIRED !== "false";

export const CAPTCHA_COOKIE_NAME = "captcha_verified";
export const CAPTCHA_COOKIE_MAX_AGE = 86400;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function signCaptchaCookie(expiry: number): Promise<string> {
  const secret = TURNSTILE_SECRET ?? "";
  if (!secret) return "";
  const data = `v1:${expiry}`;
  // WebCrypto is available in Node 18+ / edge; fallback to no signature if unavailable
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex;
  } catch {
    return "";
  }
}

export async function createCaptchaCookieValue(): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + CAPTCHA_COOKIE_MAX_AGE;
  const sig = await signCaptchaCookie(expiry);
  return sig ? `1:${expiry}:${sig}` : "1";
}

export async function isValidCaptchaCookie(value: string | null | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3 || parts[0] !== "1") return false;
  const expiry = Number(parts[1]);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const sig = parts[2];
  if (!sig) return false;
  const expected = await signCaptchaCookie(expiry);
  if (!expected) return false;
  return timingSafeEqual(sig, expected);
}

export function getCaptchaCookieAttributes(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; Max-Age=${CAPTCHA_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`;
}

export function parseCaptchaCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== CAPTCHA_COOKIE_NAME) continue;
    return trimmed.slice(eq + 1).trim() || null;
  }
  return null;
}

/**
 * Shared server-side Turnstile verification for the Studio API. When
 * TURNSTILE_REQUIRED is true (ADR-005), a missing config fails closed;
 * otherwise it fails open with a loud log so a misconfigured deploy does not
 * take the endpoint down in non-required mode.
 */
export async function validateTurnstile(token: unknown, verifiedCookie?: string | null): Promise<boolean> {
  if (!TURNSTILE_ENABLED || !TURNSTILE_SECRET || !TURNSTILE_SITE_KEY) {
    if (TURNSTILE_ENABLED && TURNSTILE_REQUIRED) {
      logger.error("turnstile.config_missing", { message: "Turnstile enabled but TURNSTILE_SECRET_KEY or NEXT_PUBLIC_TURNSTILE_SITE_KEY not set." });
      throw new CaptchaError("CAPTCHA configuration missing. Please try again later.");
    }
    return false;
  }
  // One-shot gate: once the browser has a valid signed cookie, skip token
  if (await isValidCaptchaCookie(verifiedCookie)) return false;
  if (typeof token !== "string" || !token) {
    throw new CaptchaError("Missing CAPTCHA token. Please refresh and try again.");
  }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }),
    });
    const data = await res.json() as { success?: boolean };
    if (!data.success) {
      throw new CaptchaError("Token expired or invalid. Retrying...");
    }
    return true;
  } catch (err) {
    if (err instanceof CaptchaError) throw err;
    throw new CaptchaError("CAPTCHA service unavailable. Please try again.");
  }
}
