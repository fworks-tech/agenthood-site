/**
 * scripts/check-workspace-models.mjs
 *
 * Checks that the pinned models are still listed by the provider.
 *
 * Why this is a script and not a test: the invariants that can be asserted
 * offline (granted tools are real tools, every member routes somewhere) live in
 * __tests__/studio-types.test.ts, where they import the real functions and so
 * cannot drift. What cannot be a test is the upstream fact — a pinned model can
 * be removed at any time.
 *
 * Usage:
 *   node scripts/check-workspace-models.mjs            # offline: pins readable, tiers agree
 *   OPENCODE_API_KEY=... node scripts/check-workspace-models.mjs --online
 *
 * This is a necessary check, not a sufficient one. The catalogue exposes no
 * pricing and no capability/protocol metadata, so a listed model can still
 * answer 400 — gpt-5-nano and gpt-6-luna are both listed upstream and both
 * reject the request shape this site sends. Confirm that a pin actually works
 * with `npm run test:live`, which runs a real turn.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const online = process.argv.includes("--online");
const ZEN_BASE = "https://opencode.ai/zen/v1";

// curl, not fetch: undici times out on connect in this environment. spawnSync
// without a shell keeps the API key as an argv element, so it never appears in
// a command string or in an error message.
export function requestModels(key, spawn = spawnSync) {
  return spawn("curl", ["-sS", "--max-time", "30", `${ZEN_BASE}/models`, "-H", `authorization: Bearer ${key}`], {
    encoding: "utf8",
  });
}

export function failureDetail(result) {
  return (result.stderr || "").trim();
}

export function main() {
  const src = readFileSync(join(root, "app/(main)/studio/_types/studio.ts"), "utf8");
  const pin = (name) => src.match(new RegExp(`export const ${name} = "([^"]+)"`))?.[1] ?? null;
  const qa = pin("DEMO_QA_MODEL");
  const code = pin("DEMO_CODE_MODEL");

  if (!qa || !code) {
    console.error("Could not read the tier pins from _types/studio.ts");
    process.exit(1);
  }

  console.log(`qa    ${qa}`);
  console.log(`code  ${code}`);

  if (!online) {
    if (qa !== code) {
      console.error(`\nTiers have diverged: qa=${qa} code=${code}.`);
      console.error("The QA tier only ever serves tool-free turns, so this is safe —");
      console.error("but it means the QA pin needs its own live probe (npm run test:live).");
      process.exit(1);
    }
    console.log("\nOK — one pin for both tiers. Re-run with --online to check it upstream.");
    process.exit(0);
  }

  const key = process.env.OPENCODE_API_KEY;
  if (!key) {
    console.error("\n--online needs OPENCODE_API_KEY");
    process.exit(1);
  }

  const result = requestModels(key);
  if (result.error || result.status !== 0) {
    const detail = failureDetail(result);
    console.error(`\n/v1/models request failed${detail ? `: ${detail}` : ""}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(result.stdout).data;
  } catch (err) {
    console.error(`\n/v1/models response was not valid JSON: ${err.message}`);
    process.exit(1);
  }

  const live = new Set(data.map((d) => d.id));
  console.log(`\nprovider catalogue: ${live.size} models\n`);

  const problems = [];
  for (const [tier, id] of [["qa", qa], ["code", code]]) {
    const ok = live.has(id);
    console.log(`  ${tier.padEnd(5)} ${id.padEnd(24)} ${ok ? "listed" : "NOT LISTED"}`);
    if (!ok) problems.push(`DEMO_${tier.toUpperCase()}_MODEL "${id}" is not in the catalogue.`);
  }

  if (problems.length) {
    console.log("\nPROBLEMS\n");
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nOK — the pin is listed. Listed is not the same as working;");
  console.log("run `npm run test:live` to confirm a real turn.\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
