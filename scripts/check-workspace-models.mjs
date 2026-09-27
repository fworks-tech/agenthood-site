/**
 * scripts/check-workspace-models.mjs
 *
 * Checks that the pinned models still exist in the provider catalogue.
 *
 * Why this is a script and not a test: the invariants that can be asserted
 * offline (granted tools are real tools, every member routes somewhere) live in
 * __tests__/studio-types.test.ts, where they import the real functions and so
 * cannot drift. What cannot be a test is the upstream fact — a pinned model can
 * be delisted at any time, and that is exactly how gpt-5-nano shipped and broke
 * every Workspace turn with "400 Model does not support this protocol".
 *
 * Usage:
 *   node scripts/check-workspace-models.mjs            # offline: pins are readable
 *   OPENCODE_API_KEY=... node scripts/check-workspace-models.mjs --online
 *
 * The catalogue exposes no pricing and no capability/protocol metadata, so this
 * cannot tell you whether a model is cheap or whether it serves tools. A listed
 * model can still answer 400. Confirm those with a live turn probe.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const online = process.argv.includes("--online");
const ZEN_BASE = "https://opencode.ai/zen/v1";

const src = readFileSync(join(root, "app/(main)/studio/_types/studio.ts"), "utf8");
const pin = (name) => src.match(new RegExp(`export const ${name} = "([^"]+)"`))?.[1] ?? null;
const qa = pin("DEMO_QA_MODEL");
const code = pin("DEMO_CODE_MODEL");

// Only the pinned provider's list matters; the other provider blocks are inert
// picker entries.
const listed = [
  ...(src.match(/\n  opencode: \{[\s\S]*?\n  \},/)?.[0] ?? "").matchAll(/\{\s*id:\s*"([^"]+)"/g),
].map((m) => m[1]);

if (!qa || !code) {
  console.error("Could not read the tier pins from _types/studio.ts");
  process.exit(1);
}

console.log(`qa    ${qa}`);
console.log(`code  ${code}`);

if (!online) {
  const unknown = [qa, code].filter((m) => !listed.includes(m));
  if (unknown.length) {
    console.error(`\nPinned but absent from PROVIDER_MODELS: ${unknown.join(", ")}`);
    process.exit(1);
  }
  console.log("\nOK — both pins are listed. Re-run with --online to check the catalogue.");
  process.exit(0);
}

const key = process.env.OPENCODE_API_KEY;
if (!key) {
  console.error("\n--online needs OPENCODE_API_KEY");
  process.exit(1);
}

// curl, not fetch: undici times out on connect in this environment, and the
// sibling scripts/check-deps.mjs already shells out for network calls.
let data;
try {
  data = JSON.parse(
    execSync(`curl -sS --max-time 30 ${ZEN_BASE}/models -H "authorization: Bearer ${key}"`, {
      encoding: "utf8",
    }),
  ).data;
} catch (err) {
  console.error(`\n/v1/models request failed: ${err.message}`);
  process.exit(1);
}

const live = new Set(data.map((d) => d.id));
console.log(`\nprovider catalogue: ${live.size} models\n`);

const problems = [];
for (const [tier, id] of [["qa", qa], ["code", code]]) {
  const ok = live.has(id);
  console.log(`  ${tier.padEnd(5)} ${id.padEnd(24)} ${ok ? "in catalogue" : "DELISTED"}`);
  if (!ok) problems.push(`DEMO_${tier.toUpperCase()}_MODEL "${id}" is delisted upstream.`);
}

const dead = listed.filter((id) => !live.has(id));
if (dead.length) {
  console.log(`\n  ${dead.length}/${listed.length} models in PROVIDER_MODELS are delisted:`);
  console.log(`  ${dead.join(", ")}`);
  problems.push(`${dead.length} models in PROVIDER_MODELS.opencode no longer exist upstream.`);
}

if (problems.length) {
  console.log("\nPROBLEMS\n");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("\nOK — both pins are in the catalogue.\n");
