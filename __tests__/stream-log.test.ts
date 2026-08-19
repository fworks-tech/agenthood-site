import { describe, it, expect, vi } from "vitest";
import { readSSEStream } from "../app/(main)/studio/_lib/stream";

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + "\n"));
      }
      controller.close();
    },
  });
  return new Response(body);
}

describe("readSSEStream log event routing", () => {
  it("routes type:'log' events through onLog", async () => {
    const onLog = vi.fn();
    const onDone = vi.fn();
    await readSSEStream(
      sseResponse([
        JSON.stringify({ type: "log", level: "info", event: "chat.routing", primary: "groq", correlationId: "c-1" }),
        JSON.stringify({ type: "token", data: "hi" }),
        JSON.stringify({ type: "log", level: "warn", event: "chat.aborted", correlationId: "c-1" }),
        JSON.stringify({ type: "done" }),
      ]),
      {
        onToken: vi.fn(),
        onError: vi.fn(),
        onDone,
        onLog,
      },
    );

    expect(onLog).toHaveBeenCalledTimes(2);
    expect(onLog.mock.calls[0][0]).toMatchObject({
      level: "info",
      event: "chat.routing",
      primary: "groq",
      correlationId: "c-1",
    });
    expect(onLog.mock.calls[1][0]).toMatchObject({
      level: "warn",
      event: "chat.aborted",
    });
  });

  it("does not require onLog (backward compatible with old streams)", async () => {
    const onDone = vi.fn();
    await readSSEStream(
      sseResponse([
        JSON.stringify({ type: "log", level: "error", event: "chat.error", correlationId: "c-2" }),
        JSON.stringify({ type: "done" }),
      ]),
      { onToken: vi.fn(), onError: vi.fn(), onDone },
    );
    expect(onDone).toHaveBeenCalled();
  });
});
