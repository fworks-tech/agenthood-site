import { Redis } from "@upstash/redis";
import { agents } from "@/app/(main)/studio/_data/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  let kvStatus: string;
  let kvItem: unknown = null;
  try {
    const redis = Redis.fromEnv();
    kvItem = await redis.get("item");
    kvStatus = "connected";
  } catch {
    kvStatus = "unavailable";
  }

  const agentStatuses = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.enabled ? "online" : "idle",
    lastActive: timeStr,
    tasksCompleted: 0,
  }));

  const data = {
    agentsOnline: agents.filter((a) => a.enabled).length,
    lastRun: timeStr,
    errors24h: 0,
    workflowsPending: 0,
    agentStatuses,
    kv: { status: kvStatus, item: kvItem },
    activity: [],
  };

  return Response.json(data);
}
