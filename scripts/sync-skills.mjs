import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./lib/fetch-retry.mjs";
import { MEMBERS, skillDir, siteMemberId } from "./lib/members.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(PROJECT_ROOT, "app", "(main)", "studio", "_data");
const OUTPUT_FILE = join(OUTPUT_DIR, "agents.generated.ts");
const PROMPTS_FILE = join(OUTPUT_DIR, "agentPrompts.generated.ts");
const REGISTRY_FILE = join(OUTPUT_DIR, "registry.generated.ts");

function getInstalledVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "node_modules", "agenthood", "package.json"), "utf8"));
    return pkg.version;
  } catch {
    return null;
  }
}

const INSTALLED_VERSION = getInstalledVersion();
const REF = INSTALLED_VERSION ? `v${INSTALLED_VERSION}` : "main";
const RAW_BASE = `https://raw.githubusercontent.com/fworks-tech/agenthood/${REF}`;
const MIRROR_BASE = `https://cdn.jsdelivr.net/gh/fworks-tech/agenthood@${REF}`;

function withMirror(url) {
  return { mirrors: [url.replace(RAW_BASE, MIRROR_BASE)] };
}

async function fetchSkill(member) {
  const url = `${RAW_BASE}/skills/${skillDir(member)}/SKILL.md`;
  const res = await fetchWithRetry(url, undefined, withMirror(url));
  return await res.text();
}

async function fetchRegistry() {
  const url = `${RAW_BASE}/docs/members/registry.json`;
  const res = await fetchWithRetry(url, undefined, withMirror(url));
  return res.json();
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\n*/, "").trim();
}

function extractWhenToUse(markdown) {
  const headingMatch = markdown.match(/## When to Use\n([\s\S]*?)(?=\n## |\n*$)/);
  if (!headingMatch) return [];
  const block = headingMatch[1];
  const items = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^- (.+)/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

// 4.0 declares each member's tools in `allowed-tools`. The Studio's code
// sandbox is only for members whose contract grants code.write/code.refactor.
// shortcut: parses the inline form only; every member ships it today, upgrade
// to a YAML parser when one starts using a block list.
function hasCodeWriteContract(markdown) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return false;
  const declared = frontmatter[1].match(/^allowed-tools:(.*)$/m);
  return Boolean(declared && /\bcode\.(write|refactor)\b/.test(declared[1]));
}

export async function collectMemberData(fetchMember) {
  const skills = {};
  const prompts = {};
  const codeAgents = [];

  for (const member of MEMBERS) {
    const raw = await fetchMember(member);
    skills[member] = stripFrontmatter(raw);
    prompts[member] = extractWhenToUse(raw);
    if (hasCodeWriteContract(raw)) codeAgents.push(member);
    console.log(`  ✓ ${member} (${prompts[member].length} prompts)`);
  }

  return { skills, prompts, codeAgents };
}

export async function runSkills({ allowMain = false } = {}) {
  if (INSTALLED_VERSION) {
    console.log(`  → pinning to agenthood v${INSTALLED_VERSION}`);
  } else if (allowMain || process.argv.includes("--allow-main")) {
    console.warn("  ! could not detect installed agenthood version, falling back to main (--allow-main)");
  } else {
    console.error("  ✗ cannot determine installed agenthood version; refusing to generate from a moving ref. Install the published package or pass --allow-main.");
    process.exit(1);
  }

  const registry = await fetchRegistry();
  const registryIds = new Set(registry.members.map((m) => siteMemberId(m.name)));
  const unmirrored = registry.members.filter((m) => !MEMBERS.includes(siteMemberId(m.name)));
  if (unmirrored.length > 0) {
    console.warn(`  ! upstream registry lists members not mirrored here: ${unmirrored.map((m) => m.name).join(", ")}`);
  }

  for (const member of MEMBERS) {
    if (!registryIds.has(member)) {
      console.warn(`  ! ${member} missing from upstream registry.json`);
    }
  }

  const { skills, prompts, codeAgents } = await collectMemberData(fetchSkill);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Shared conversational style + tool-skill catalog, mirroring what the
  // upstream runtime injects (MemberAgent.getSystemPrompt + discoverSkills)
  // so the Studio chat prompts match `agenthood run` behavior.
  const sharedStylePath = join(PROJECT_ROOT, "node_modules", "agenthood", "skills", "_shared", "CONVERSATIONAL-STYLE.md");
  const sharedStyle = existsSync(sharedStylePath) ? readFileSync(sharedStylePath, "utf8").trim() : "";

  const pkgSkillsDir = join(PROJECT_ROOT, "node_modules", "agenthood", "skills");
  // Deprecated aliases advertise themselves as "Deprecated alias for the-X. Do
  // not select directly", so listing them in a member's prompt only invites the
  // model to pick the one option it was told not to pick.
  const isDeprecatedAlias = (dir) => {
    const doc = join(pkgSkillsDir, dir, "SKILL.md");
    if (!existsSync(doc)) return false;
    return /^description:\s*Deprecated alias/im.test(readFileSync(doc, "utf8"));
  };
  const memberDirs = new Set(MEMBERS.map(skillDir));
  const toolSkills = existsSync(pkgSkillsDir)
    ? readdirSync(pkgSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !memberDirs.has(e.name) && e.name !== "_shared")
        .map((e) => e.name)
        .filter((name) => !isDeprecatedAlias(name))
        .sort()
    : [];

  const ts = `// Auto-generated by scripts/sync-skills.mjs
// Do not edit manually. Run \`npm run sync-skills\` to regenerate.

export const agentSkills: Record<string, string> = ${JSON.stringify(skills, null, 2)};

export const sharedConversationalStyle: string = ${JSON.stringify(sharedStyle)};

export const toolSkills: string[] = ${JSON.stringify(toolSkills)};
`;

  const promptsTs = `// Auto-generated by scripts/sync-skills.mjs
// Do not edit manually. Run \`npm run sync-skills\` to regenerate.

export const agentPrompts: Record<string, string[]> = ${JSON.stringify(prompts, null, 2)};
`;

  const registryEntries = registry.members.map((m) => ({
    name: siteMemberId(m.name),
    displayName: m.displayName,
    tagline: m.tagline,
    role: m.role,
    stage: m.stage,
    priority: m.priority,
  }));
  const registryTs = `// Auto-generated by scripts/sync-skills.mjs
// Do not edit manually. Run \`npm run sync-skills\` to regenerate.

export interface RegistryEntry {
  name: string;
  displayName: string;
  tagline: string;
  role: string;
  stage: string[];
  priority: number;
}

export const agentRegistry: RegistryEntry[] = ${JSON.stringify(registryEntries, null, 2)};

export const codeAgents: string[] = ${JSON.stringify(codeAgents, null, 2)};
`;

  writeFileSync(OUTPUT_FILE, ts, "utf-8");
  writeFileSync(PROMPTS_FILE, promptsTs, "utf-8");
  writeFileSync(REGISTRY_FILE, registryTs, "utf-8");
  console.log(`\nGenerated ${OUTPUT_FILE}`);
  console.log(`Generated ${PROMPTS_FILE}`);
  console.log(`Generated ${REGISTRY_FILE} (${registryEntries.length} members)`);
}

export async function verifySkills() {
  if (!INSTALLED_VERSION) {
    console.error("  ✗ cannot verify: installed agenthood version unknown");
    process.exit(1);
  }
  const pkgSpec = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"))?.dependencies?.agenthood ?? "";
  if (/^(file|link|workspace):/.test(pkgSpec)) {
    console.error(`  ✗ agenthood dependency is a local path (${pkgSpec}); generated data must come from a published package`);
    process.exit(1);
  }
  const pkgSkillsDir = join(PROJECT_ROOT, "node_modules", "agenthood", "skills");
  let failed = false;
  for (const member of MEMBERS) {
    const local = join(pkgSkillsDir, skillDir(member), "SKILL.md");
    if (!existsSync(local)) {
      console.error(`  ✗ ${member}: missing from installed agenthood package`);
      failed = true;
      continue;
    }
    const expected = stripFrontmatter(readFileSync(local, "utf8"));
    const quoted = JSON.stringify(expected).slice(1, -1).slice(0, 120);
    const out = readFileSync(OUTPUT_FILE, "utf8");
    if (!out.includes(quoted)) {
      console.error(`  ✗ ${member}: ${OUTPUT_FILE} does not match the installed agenthood v${INSTALLED_VERSION} source — regenerate with npm run sync-skills`);
      failed = true;
    }
  }
  if (failed) {
    console.error("\nsync-skills --verify: drift detected between generated data and the published agenthood package.");
    process.exit(1);
  }
  console.log(`  ✓ sync-skills --verify: generated data matches agenthood v${INSTALLED_VERSION}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--verify")) {
    verifySkills().catch((err) => {
      console.error("sync-skills --verify failed:", err.message);
      process.exit(1);
    });
  } else {
    runSkills().catch((err) => {
      console.error("sync-skills failed:", err.message);
      process.exit(1);
    });
  }
}
