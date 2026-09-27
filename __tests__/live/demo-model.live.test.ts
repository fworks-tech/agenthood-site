// Opt-in live smoke test — excluded from `npm test` by vitest.config.ts, and
// never run in CI.
//
// The failure this exists to catch is silent. A pin that is listed upstream but
// does not serve the chat-completions protocol answers 400 on every turn, and
// the only symptom is a user's screenshot. Unit tests mock the provider, so they
// cannot see it; the model catalogue check only proves an id is *listed*, which
// is not the same as *working*.
//
// Run it whenever a pin changes, and before blaming anything else:
//
//   OPENCODE_API_KEY=... npm run test:live
//
// Costs real money (a fraction of a cent per run) and takes ~30s, which is why
// it is opt-in.
import { describe, it, expect } from "vitest";
import { LightweightAdapter } from "../../app/(main)/studio/_lib/agenthood-adapter";
import { createWorkspaceTurnStream } from "../../app/(main)/studio/_lib/workspace-adapter";
import {
  DEMO_QA_MODEL,
  DEMO_CODE_MODEL,
  CLIENT_MESSAGE_ROLES,
} from "../../app/(main)/studio/_types/studio";

const TIMEOUT = 120_000;

type Ev = Record<string, unknown>;

async function drain(stream: ReadableStream): Promise<Ev[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Ev[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n").filter(Boolean)) {
      try {
        events.push(JSON.parse(line) as Ev);
      } catch {
        // partial frame at stream end
      }
    }
  }
  return events;
}

const app = (events: Ev[]) => events.filter((e) => e.type !== "log");
const text = (events: Ev[]) =>
  app(events).filter((e) => e.type === "token").map((e) => String(e.data)).join("");
const toolCalls = (events: Ev[]) => app(events).filter((e) => e.type === "tool_call");
const toolResults = (events: Ev[]) => app(events).filter((e) => e.type === "tool_result");
const errorText = (events: Ev[]) =>
  app(events)
    .filter((e) => e.type === "error" || e.type === "workspace.error")
    .map((e) => String(e.data ?? ""))
    .join("; ");

/**
 * The adapter reports provider failures as an `error` event rather than a
 * thrown exception, so "no text" and "provider refused" look identical unless
 * the error is surfaced. Every assertion below goes through here.
 */
function expectNoProviderError(events: Ev[], model: string): void {
  const err = errorText(events);
  expect(
    err,
    `Provider refused the request on ${model}: ${err || "(no detail)"}` +
      (/\b402\b/.test(err)
        ? "\n  -> account has no balance; top up or use a funded key"
        : /protocol/i.test(err)
          ? "\n  -> this model does not serve the chat-completions protocol we send; pick another pin"
          : ""),
  ).toBe("");
}

function reportCost(label: string, events: Ev[]): void {
  const trace = app(events).find((e) => e.type === "trace") as { cost?: unknown; model?: string } | undefined;
  if (trace) {
    const cost = typeof trace.cost === "number" ? `$${trace.cost.toFixed(6)}` : "n/a";
    console.log(`    ${label}: model=${trace.model} est.cost=${cost}`);
  }
}

const HAS_KEY = Boolean(process.env.OPENCODE_API_KEY);

describe("live demo-model smoke", () => {
  it("has a key to smoke with", () => {
    expect(
      process.env.OPENCODE_API_KEY,
      "OPENCODE_API_KEY is not set — nothing to smoke. Export a funded key and re-run.",
    ).toBeTruthy();
  });

  // The role allowlist is the invariant most likely to be broken by a careless
  // refactor of buildLLMMessages. It costs nothing to assert, so it runs even
  // without a key.
  it("the role allowlist is intact", () => {
    expect([...CLIENT_MESSAGE_ROLES]).toEqual(["user", "assistant"]);
  });

  // Skipped rather than failed when there is no key: without one these calls
  // hang against the provider instead of failing, which turns a clear "no key"
  // error into a five-minute stall. The test above still fails, so the run is
  // red either way.
  describe.skipIf(!HAS_KEY)("against the pinned models", () => {
    it(`QA pin ${DEMO_QA_MODEL} answers a plain turn`, async () => {
      const events = await drain(
        await new LightweightAdapter().chat({
          agentId: "the-scribe",
          messages: [{ role: "user", content: "In one short sentence, what is an ADR?" }],
        }),
      );
      expectNoProviderError(events, DEMO_QA_MODEL);
      expect(text(events).length, "empty answer — the model answered but produced no tokens").toBeGreaterThan(10);
      reportCost("plain turn", events);
    }, TIMEOUT);

    it(`tool pin ${DEMO_CODE_MODEL} emits and completes a tool call`, async () => {
      const events = await drain(
        await new LightweightAdapter().chat({
          agentId: "the-builder",
          messages: [
            {
              role: "user",
              content: "Use code_execution to run exactly this JavaScript and report the result: 21 * 2",
            },
          ],
          config: { enabledTools: ["code_execution"] },
        }),
      );
      expectNoProviderError(events, DEMO_CODE_MODEL);
      expect(
        toolCalls(events).length,
        "the model never called a tool — it cannot serve the tools protocol, so every " +
          "tool feature in the Studio is dead with this pin",
      ).toBeGreaterThan(0);
      expect(String(toolResults(events)[0]?.result ?? "")).toContain("42");
      reportCost("tool turn", events);
    }, TIMEOUT);

    it("a workspace member turn completes", async () => {
      const events = await drain(
        await createWorkspaceTurnStream({
          workspaceId: "ws-smoke",
          correlationId: "corr-smoke",
          memberId: "the-builder",
          instruction: "Use code_execution to run 21 * 2 and report the result.",
          thread: [],
          turnIndex: 0,
        }),
      );
      expectNoProviderError(events, "workspace turn");
      expect(
        app(events).some((e) => e.type === "workspace.turn_end"),
        "workspace turn never emitted turn_end",
      ).toBe(true);
      reportCost("workspace turn", events);
    }, TIMEOUT);
  });
});
