import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../scripts/lib/fetch-retry.mjs";

function response(status: number, body = "") {
  return new Response(body, { status, statusText: `status-${status}` });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchWithRetry", () => {
  it("returns the response on first success", async () => {
    vi.mocked(fetch).mockResolvedValue(response(200, "ok"));
    const res = await fetchWithRetry("https://example.com/a");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 then returns the recovered response", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, "recovered"));
    const res = await fetchWithRetry("https://example.com/b", undefined, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("recovered");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on 404 without retrying", async () => {
    vi.mocked(fetch).mockResolvedValue(response(404));
    await expect(fetchWithRetry("https://example.com/c")).rejects.toThrow("404");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting attempts on persistent 503", async () => {
    vi.mocked(fetch).mockResolvedValue(response(503));
    await expect(
      fetchWithRetry("https://example.com/d", undefined, { attempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow("503");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("falls back to a mirror when the primary stays throttled", async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("mirror")
          ? response(200, "mirrored")
          : response(503),
      ),
    );
    const res = await fetchWithRetry("https://example.com/e", undefined, {
      attempts: 2,
      baseDelayMs: 1,
      mirrors: ["https://mirror.example.com/e"],
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("mirrored");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("tries the mirror after 2 primary failures instead of exhausting retries", async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("mirror")
          ? response(200, "mirrored")
          : response(503),
      ),
    );
    const res = await fetchWithRetry("https://example.com/f", undefined, {
      attempts: 5,
      baseDelayMs: 1,
      mirrors: ["https://mirror.example.com/f"],
    });
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("includes the response body in the failure message", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(response(403, "API rate limit exceeded for installer.")),
    );
    const err = await fetchWithRetry("https://example.com/g").catch((e) => e);
    expect(err.message).toContain("403");
    expect(err.message).toContain("API rate limit exceeded");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
