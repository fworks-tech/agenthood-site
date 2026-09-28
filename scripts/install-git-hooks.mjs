// Arms the committed pre-push hook. Runs from `npm install` via the `prepare`
// script, because core.hooksPath lives in .git/config and a fresh clone does
// not inherit it — without this, every new clone silently pushes with no gate
// at all, which is the same failure as having no hook.
//
// Nothing in here may fail the install. A convenience that breaks `npm
// install` for a contributor who cannot run it is worse than no hook, so both
// git calls are guarded: not a git work tree, no git binary, a read-only or
// foreign-owned .git (git's safe.directory check rejects the latter), and a
// git too old for core.hooksPath all exit 0 with a note.
import { execFileSync } from "node:child_process";

const git = (args) => execFileSync("git", args, { stdio: ["ignore", "ignore", "ignore"] });

try {
  git(["rev-parse", "--is-inside-work-tree"]);
} catch {
  // Installed as a dependency, or in an exported tarball. Nothing to arm.
  process.exit(0);
}

try {
  git(["config", "core.hooksPath", ".githooks"]);
  console.log("[hooks] core.hooksPath = .githooks — pre-push gate active");
} catch {
  console.warn("[hooks] could not set core.hooksPath; the pre-push gate is off.");
  console.warn("[hooks] run manually: git config core.hooksPath .githooks");
}
