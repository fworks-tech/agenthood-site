import { describe, it, expect } from "vitest";

describe("POST /api/studio/feedback", () => {
  it("accepts valid feedback with value up", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", value: "up" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("accepts valid feedback with value down", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-2", conversationId: "conv-1", value: "down" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("accepts null value (toggle off)", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-3", value: null }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects missing messageId", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "up" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("messageId");
  });

  it("rejects invalid value", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-4", value: "invalid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("value");
  });

  it("rejects non-JSON body", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("bounds string fields and drops unknown props", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "m".repeat(300), value: "up" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects oversized optional fields instead of dropping them", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", value: "up", agentId: "a".repeat(300) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("agentId");
  });

  it("accepts bounded optional fields", async () => {
    const { POST } = await import("../app/api/studio/feedback/route");
    const req = new Request("http://localhost/api/studio/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", value: "up", agentId: "the-builder", provider: "opencode" }),
    });
    expect((await POST(req)).status).toBe(200);
  });
});
