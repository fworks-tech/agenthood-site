"use client";

interface AgentRow {
  id: string;
  name: string;
  status: string;
  lastActive: string;
  tasksCompleted: number;
}

interface AgentStatusTableProps {
  agents: AgentRow[];
}

const STATUS_COLORS: Record<string, string> = {
  online: "bg-emerald-500",
  error: "bg-red-500",
  idle: "bg-zinc-500",
};

export default function AgentStatusTable({ agents }: AgentStatusTableProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        No status data available.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Agent</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Status</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Last Active</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
              <td className="px-4 py-2.5 text-zinc-200">{agent.name}</td>
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[agent.status] || "bg-zinc-500"}`} />
                  <span className="text-zinc-400 capitalize">{agent.status}</span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-zinc-500">{agent.lastActive}</td>
              <td className="px-4 py-2.5 text-zinc-500">{agent.tasksCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
