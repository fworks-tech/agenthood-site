// Arms the committed pre-push hook. Runs from `npm install` via the `prepare`
// script, because core.hooksPath lives in .git/config and a fresh clone does
// not inherit it — without this, every new clone silently pushes with no gate
// at all, which is the same failure as having no hook.
import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
} catch {
  // Installed as a dependency, or in an exported tarball. Nothing to arm.
  process.exit(0);
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
console.log("[hooks] core.hooksPath = .githooks — pre-push gate active");
