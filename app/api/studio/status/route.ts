import { agents } from "@/app/(main)/studio/_data/agents";

export const dynamic = "force-static";

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

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
    activity: [],
  };

  return Response.json(data);
}
