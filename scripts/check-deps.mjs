/**
 * scripts/check-deps.mjs
 *
 * Checks if installed dependencies are up to date with the latest on npm.
 * Exits with code 1 if any dependency is outdated (for CI gating).
 *
 * Usage:
 *   node scripts/check-deps.mjs            # warn only
 *   node scripts/check-deps.mjs --strict   # exit 1 on outdated
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const strict = process.argv.includes("--strict");

function getInstalled(name) {
  try {
    const pkg = require(`${name}/package.json`);
    return pkg.version;
  } catch {
    return null;
  }
}

function getLatest(name) {
  try {
    return execSync(`npm view ${name} version`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const DEPS = [
  { name: "agenthood", critical: true },
  { name: "next", critical: false },
  { name: "react", critical: false },
  { name: "@mantine/core", critical: false },
  { name: "tailwindcss", critical: false },
];

let outdated = 0;
let criticalOutdated = 0;

for (const { name, critical } of DEPS) {
  const installed = getInstalled(name);
  const latest = getLatest(name);
  if (!installed || !latest) continue;

  const status = installed === latest ? "✓" : "✗";
  const label = critical ? " [CRITICAL]" : "";
  if (installed !== latest) {
    outdated++;
    if (critical) criticalOutdated++;
    console.log(`  ${status} ${name}: ${installed} → ${latest}${label}`);
  } else {
    console.log(`  ${status} ${name}: ${installed}${label}`);
  }
}

if (outdated > 0) {
  console.log(`\n  ${outdated} package(s) outdated`);
  if (criticalOutdated > 0) {
    console.log(`  ${criticalOutdated} critical — run npm install agenthood@latest to fix`);
  }
  if (strict) process.exit(1);
} else {
  console.log("\n  all dependencies up to date");
}
