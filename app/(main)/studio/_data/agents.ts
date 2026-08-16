import { agentRegistry } from "./registry.generated";

export interface AgentEntry {
  id: string;
  name: string;
  role: string;
  shortDescription: string;
  tagline: string;
  stage: string[];
  priority: number;
  category: string;
  preferredProvider: string;
  enabled: boolean;
  icon?: string;
}

interface SiteAgentConfig {
  role: string;
  category: string;
  preferredProvider: string;
  enabled?: boolean;
  icon?: string;
}

const SITE_CONFIG: Record<string, SiteAgentConfig> = {
  "the-scribe": { role: "Commits & Changelogs", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "✍️" },
  "the-architect": { role: "Spec-First Development", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🏗️" },
  "the-builder": { role: "Coding & Implementation", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🛠️" },
  "the-reviewer": { role: "Code Review", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "🔍" },
  "the-tester": { role: "TDD & Test Generation", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🧪" },
  "the-debugger": { role: "Root Cause Analysis", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🐛" },
  "the-auditor": { role: "Security & Dependencies", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "🔒" },
  "the-herald": { role: "Releases & Versioning", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "📦" },
  "the-inspector": { role: "Visual Reasoning", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "🔬" },
  "the-librarian": { role: "Documentation & ADRs", category: "knowledge", preferredProvider: "anthropic", enabled: true, icon: "📝" },
  "the-mailman": { role: "Delivery & Cross-Posting", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "📮" },
  "the-doorman": { role: "Validation & Enforcement", category: "validation", preferredProvider: "ollama", enabled: true, icon: "🚪" },
  "the-oracle": { role: "Research & Knowledge", category: "knowledge", preferredProvider: "anthropic", enabled: true, icon: "🔮" },
  "the-envoy": { role: "Communication & Handoffs", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "🌐" },
  "the-sentinel": { role: "Member File Validation", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "👁️" },
  "the-warden": { role: "Code Health Enforcement", category: "validation", preferredProvider: "anthropic", enabled: true, icon: "⚖️" },
  "the-steward": { role: "Context & Routing", category: "lifecycle", preferredProvider: "groq", enabled: true, icon: "🧭" },
  "the-strategist": { role: "Goal Refinement", category: "engineering", preferredProvider: "anthropic", enabled: true, icon: "🎯" },
  "the-operator": { role: "Deployment & Incidents", category: "lifecycle", preferredProvider: "anthropic", enabled: true, icon: "🩺" },
};

const SITE_ORDER = [
  "the-scribe", "the-architect", "the-builder", "the-reviewer", "the-tester",
  "the-debugger", "the-auditor", "the-herald", "the-inspector", "the-librarian",
  "the-mailman", "the-doorman", "the-oracle", "the-envoy", "the-sentinel",
  "the-warden", "the-steward", "the-strategist", "the-operator",
];

const registryById = new Map(agentRegistry.map((r) => [r.name, r]));

export const agents: AgentEntry[] = SITE_ORDER.map((id) => {
  const site = SITE_CONFIG[id];
  if (!site) {
    throw new Error(`Missing site config for agent "${id}"`);
  }
  const reg = registryById.get(id);
  return {
    id,
    name: reg?.displayName ?? id,
    role: site.role,
    shortDescription: reg?.role ?? "",
    tagline: reg?.tagline ?? "",
    stage: reg?.stage ?? [],
    priority: reg?.priority ?? 99,
    category: site.category,
    preferredProvider: site.preferredProvider,
    enabled: site.enabled ?? true,
    icon: site.icon,
  };
});

export function getAgentById(id: string): AgentEntry | undefined {
  return agents.find((a) => a.id === id);
}
