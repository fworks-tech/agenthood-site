export interface AgentEntry {
  id: string;
  name: string;
  role: string;
  shortDescription: string;
  category: string;
  preferredProvider: string;
  enabled: boolean;
  icon?: string;
}

export const agents: AgentEntry[] = [
  { id: "the-scribe", name: "The Scribe", role: "Commits & Changelogs", shortDescription: "Writes commit messages, PR descriptions, and changelogs", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "✍️" },
  { id: "the-architect", name: "The Architect", role: "Spec-First Development", shortDescription: "Drives spec-first development, task decomposition, and architecture decisions", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🏗️" },
  { id: "the-reviewer", name: "The Reviewer", role: "Code Review", shortDescription: "Conducts five-axis code review: correctness, security, performance, maintainability, test coverage", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "🔍" },
  { id: "the-tester", name: "The Tester", role: "TDD & Test Generation", shortDescription: "Writes tests before implementation, maintains coverage targets, validates acceptance criteria", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🧪" },
  { id: "the-debugger", name: "The Debugger", role: "Root Cause Analysis", shortDescription: "Five-step debugging protocol: reproduce, isolate, hypothesize, test, fix", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🐛" },
  { id: "the-auditor", name: "The Auditor", role: "Security & Dependencies", shortDescription: "OWASP Top 10 security review, dependency audit, secrets scanning", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "🔒" },
  { id: "the-herald", name: "The Herald", role: "Releases & Versioning", shortDescription: "Manages semver determination, changelog generation, and release publishing", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "📦" },
  { id: "the-librarian", name: "The Librarian", role: "Documentation & ADRs", shortDescription: "Keeps documentation synchronized with code changes", category: "knowledge", preferredProvider: "anthropic", enabled: true, icon: "📝" },
  { id: "the-doorman", name: "The Doorman", role: "Validation & Enforcement", shortDescription: "Validates commit messages against conventional commit rules. Gatekeeps every commit", category: "validation", preferredProvider: "ollama", enabled: true, icon: "🚪" },
  { id: "the-oracle", name: "The Oracle", role: "Research & Knowledge", shortDescription: "Cross-session institutional memory. Retrieves past decisions, patterns, and context", category: "knowledge", preferredProvider: "anthropic", enabled: true, icon: "🔮" },
  { id: "the-envoy", name: "The Envoy", role: "Communication & Handoffs", shortDescription: "Cross-runtime translator. Adapts skills for non-Anthropic providers", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "🌐" },
  { id: "the-sentinel", name: "The Sentinel", role: "Member File Validation", shortDescription: "Guards quality standards: validates member schema, ADR presence, CI gate integrity", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "👁️" },
  { id: "the-warden", name: "The Warden", role: "File Size Enforcement", shortDescription: "Enforces project conventions: file naming, directory structure, import rules", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "⚖️" },
  { id: "the-steward", name: "The Steward", role: "Context & Routing", shortDescription: "Monitors context window capacity, routes tasks to the minimal required member set", category: "lifecycle", preferredProvider: "groq", enabled: true, icon: "🧭" },
  { id: "the-strategist", name: "The Strategist", role: "Goal Refinement", shortDescription: "Translates ambiguous goals into structured problem statements, success criteria, and ranked priorities", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🎯" },
  { id: "the-operator", name: "The Operator", role: "Deployment & Incidents", shortDescription: "Manages runtime health, deployment, incidents, rollback, and monitoring", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "🩺" },
];

export function getAgentById(id: string): AgentEntry | undefined {
  return agents.find((a) => a.id === id);
}
