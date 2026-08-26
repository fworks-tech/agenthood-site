import { CaptchaError } from "./errors";
import { logger } from "./logger";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED !== "false";
const TURNSTILE_REQUIRED = process.env.TURNSTILE_REQUIRED !== "false";

/**
 * Shared server-side Turnstile verification for the Studio API. Gated by the
 * same env contract as ADR-005: enabled+misconfigured fails open with a loud
 * log instead of taking the endpoint down.
 */
export async function validateTurnstile(token: unknown): Promise<void> {
  if (!TURNSTILE_ENABLED || !TURNSTILE_SECRET || !TURNSTILE_SITE_KEY) {
    if (TURNSTILE_ENABLED && TURNSTILE_REQUIRED) {
      logger.error("turnstile.config_missing", { message: "Turnstile enabled but TURNSTILE_SECRET_KEY or NEXT_PUBLIC_TURNSTILE_SITE_KEY not set. CAPTCHA bypassed." });
    }
    return;
  }
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
  } catch (err) {
    if (err instanceof CaptchaError) throw err;
    throw new CaptchaError("CAPTCHA service unavailable. Please try again.");
  }
}