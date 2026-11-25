/**
 * scripts/check-deps.mjs
 *
 * Checks if installed dependencies are up to date with the latest on npm.
 * Exits with code 1 if any dependency is outdated (for CI gating).
 *
 * Usage:
 *   node scripts/check-deps.mjs            # warn only
 *   node scripts/check-deps.mjs --strict   # exit 1 on outdated or unresolvable
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

// Read package.json off disk: require("<name>/package.json") throws for
// packages whose exports map does not publish ./package.json (agenthood,
// @mantine/core), which used to silently skip those dependencies.
export function getInstalled(name, rootDir = root) {
  try {
    return JSON.parse(readFileSync(join(rootDir, "node_modules", name, "package.json"), "utf8")).version;
  } catch {
    return null;
  }
}

export function getLatest(name) {
  try {
    return execSync(`npm view ${name} version`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export const DEPS = [
  { name: "agenthood", critical: true },
  { name: "next", critical: false },
  { name: "react", critical: false },
  { name: "@mantine/core", critical: false },
  { name: "tailwindcss", critical: false },
];

export function collectStatus(deps, installedOf, latestOf) {
  let outdated = 0;
  let criticalOutdated = 0;
  let unresolved = 0;
  const lines = [];

  for (const { name, critical } of deps) {
    const installed = installedOf(name);
    const latest = latestOf(name);
    if (!installed || !latest) {
      unresolved++;
      lines.push(`  ? ${name}: could not resolve installed/latest version`);
      continue;
    }

    const status = installed === latest ? "✓" : "✗";
    const label = critical ? " [CRITICAL]" : "";
    if (installed !== latest) {
      outdated++;
      if (critical) criticalOutdated++;
      lines.push(`  ${status} ${name}: ${installed} → ${latest}${label}`);
    } else {
      lines.push(`  ${status} ${name}: ${installed}${label}`);
    }
  }

  return { outdated, criticalOutdated, unresolved, lines };
}

export function shouldFail(strict, { outdated, unresolved }) {
  return strict && (outdated > 0 || unresolved > 0);
}

function run() {
  const { outdated, criticalOutdated, unresolved, lines } = collectStatus(DEPS, getInstalled, getLatest);
  for (const line of lines) console.log(line);

  if (outdated > 0) {
    console.log(`\n  ${outdated} package(s) outdated`);
    if (criticalOutdated > 0) {
      console.log(
        `  ${criticalOutdated} critical — 3.55.2+ uses strict exports that break barrel imports; upgrade blocked until import paths migrate`,
      );
    }
  } else if (unresolved === 0) {
    console.log("\n  all dependencies up to date");
  }

  if (unresolved > 0) console.log(`\n  ${unresolved} package(s) could not be resolved`);
  if (shouldFail(strict, { outdated, unresolved })) process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
