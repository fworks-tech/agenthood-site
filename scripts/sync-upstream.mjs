#!/usr/bin/env node
/**
 * scripts/sync-upstream.mjs
 *
 * Single entry point for upstream sync. Thin dispatcher — each subcommand
 * imports the existing script's runner, so behavior is identical to calling
 * the scripts directly (which still works).
 *
 * Usage: node scripts/sync-upstream.mjs [docs|skills|news|all]
 *          [--lenient] [--verify] [--allow-main]
 *
 * `all` (default, used by prebuild/predev) runs docs → news → skills.
 * --lenient applies to news only, --verify/--allow-main to skills only.
 */
import { runDocs } from "./sync-docs.mjs";
import { runSkills, verifySkills } from "./sync-skills.mjs";
import { runNewsManifest } from "./build-news-manifest.mjs";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "all";
const lenient = args.includes("--lenient");
const verify = args.includes("--verify");
const allowMain = args.includes("--allow-main");

async function run(targetName) {
  if (targetName === "docs" || targetName === "all") {
    console.log("sync-upstream: docs");
    await runDocs();
  }
  if (targetName === "news" || targetName === "all") {
    console.log("sync-upstream: news");
    runNewsManifest({ lenient });
  }
  if (targetName === "skills" || targetName === "all") {
    console.log("sync-upstream: skills");
    if (verify) await verifySkills();
    else await runSkills({ allowMain });
  }
}

if (!["docs", "skills", "news", "all"].includes(target)) {
  console.error(`unknown target "${target}"; expected docs|skills|news|all`);
  process.exit(1);
}

run(target).catch((err) => {
  console.error(`sync-upstream (${target}) failed:`, err.message);
  process.exit(1);
});
