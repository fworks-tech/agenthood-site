// Writes .agenthood/config.json redirecting agenthood trace persistence to
// /tmp — but only on Vercel, where /var/task is read-only and every provider
// call otherwise logs an ENOENT error. Local dev is untouched (no $VERCEL).
// Existing config keys (providers, etc.) are preserved via merge.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

if (!process.env.VERCEL) process.exit(0);

mkdirSync(".agenthood", { recursive: true });
let config = {};
try {
  if (existsSync(".agenthood/config.json")) {
    config = JSON.parse(readFileSync(".agenthood/config.json", "utf8"));
  }
} catch { /* start from an empty config on corrupt files */ }
config.observability = {
  ...(typeof config.observability === "object" ? config.observability : {}),
  tracePath: "/tmp/agenthood-traces/traces.ndjson",
};
writeFileSync(".agenthood/config.json", JSON.stringify(config, null, 2));
console.log("vercel-trace-path: trace persistence redirected to /tmp");
