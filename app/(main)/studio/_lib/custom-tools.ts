import type { ToolSchema } from "agenthood/dist/llm";
import { STORAGE_KEYS } from "./constants";

export interface CustomToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  executionType: "webhook" | "sandbox";
  webhookUrl?: string;
  code?: string;
}

const NAME_PATTERN = /^custom_[a-z][a-z0-9_]*$/;
const RESERVED_NAMES = new Set(["web_fetch", "code_execution"]);
const MAX_TOOLS = 50;
const MAX_NAME_LENGTH = 64;

export function isValidCustomToolName(name: string): boolean {
  return NAME_PATTERN.test(name) && name.length <= MAX_NAME_LENGTH && !RESERVED_NAMES.has(name);
}

function loadCustomTools(): CustomToolDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOOLS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCustomToolDefinition);
  } catch {
    return [];
  }
}

function saveCustomTools(tools: CustomToolDefinition[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.CUSTOM_TOOLS, JSON.stringify(tools));
}

function isValidCustomToolDefinition(def: unknown): def is CustomToolDefinition {
  if (typeof def !== "object" || def === null) return false;
  const d = def as Record<string, unknown>;
  return (
    typeof d.name === "string" &&
    isValidCustomToolName(d.name) &&
    typeof d.description === "string" &&
    typeof d.inputSchema === "object" &&
    d.inputSchema !== null &&
    typeof d.executionType === "string" &&
    (d.executionType === "webhook" || d.executionType === "sandbox")
  );
}

let schemasCache: { key: string; schemas: ToolSchema[] } | null = null;

function getCacheKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS.CUSTOM_TOOLS) ?? "";
}

export function getCustomTools(): CustomToolDefinition[] {
  return loadCustomTools();
}

export function getCustomToolSchemas(): ToolSchema[] {
  const key = getCacheKey();
  if (schemasCache && schemasCache.key === key) return schemasCache.schemas;
  const schemas = loadCustomTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  schemasCache = { key, schemas };
  return schemas;
}

export function registerCustomTool(def: CustomToolDefinition): { ok: true } | { ok: false; error: string } {
  if (!isValidCustomToolName(def.name)) {
    return { ok: false, error: `Invalid tool name "${def.name}". Must match custom_[a-z][a-z0-9_]{1,62}` };
  }
  const tools = loadCustomTools();
  if (tools.length >= MAX_TOOLS) {
    return { ok: false, error: `Maximum ${MAX_TOOLS} custom tools allowed` };
  }
  if (tools.some((t) => t.name === def.name)) {
    return { ok: false, error: `Tool "${def.name}" already exists` };
  }
  tools.push(def);
  saveCustomTools(tools);
  return { ok: true };
}

export function unregisterCustomTool(name: string): void {
  const tools = loadCustomTools().filter((t) => t.name !== name);
  saveCustomTools(tools);
}

export function getCustomTool(name: string): CustomToolDefinition | undefined {
  return loadCustomTools().find((t) => t.name === name);
}
