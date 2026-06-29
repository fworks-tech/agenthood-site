import { describe, it, expect, vi } from "vitest";
import { readSSEStream } from "../app/studio/_lib/stream";

function createStreamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
  return new Response(body);
}

describe("readSSEStream", () => {
  it("parses token events", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = createStreamResponse([
      JSON.stringify({ type: "token", data: "Hello" }),
      JSON.stringify({ type: "token", data: " World" }),
      JSON.stringify({ type: "done" }),
    ]);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, "Hello");
    expect(onToken).toHaveBeenNthCalledWith(2, " World");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError for error events", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = createStreamResponse([
      JSON.stringify({ type: "error", data: "Provider unavailable" }),
    ]);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error("Provider unavailable"));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("skips malformed JSON lines", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = createStreamResponse([
      "not json",
      JSON.stringify({ type: "token", data: "OK" }),
      JSON.stringify({ type: "done" }),
    ]);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith("OK");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles empty lines", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = createStreamResponse(["", JSON.stringify({ type: "done" }), ""]);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onToken).not.toHaveBeenCalled();
  });

  it("calls onError when response body is null", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = new Response(null);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onError).toHaveBeenCalledWith(new Error("Response body is not readable"));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("handles abort signal gracefully", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const controller = new AbortController();
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(JSON.stringify({ type: "token", data: "A" }) + "\n"));
        c.close();
      },
    });
    const res = new Response(body);

    controller.abort();
    await readSSEStream(res, { onToken, onDone, onError }, controller.signal);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone only once when done event is received", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const res = createStreamResponse([
      JSON.stringify({ type: "done" }),
      JSON.stringify({ type: "token", data: "should be ignored" }),
    ]);

    await readSSEStream(res, { onToken, onDone, onError });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onToken).not.toHaveBeenCalled();
  });
});
