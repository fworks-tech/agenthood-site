"use client";

import { useState, useEffect } from "react";
import StudioShell from "../_components/StudioShell";
import DashboardKpis from "../_components/DashboardKpis";
import AgentStatusTable from "../_components/AgentStatusTable";
import ActivityFeed from "../_components/ActivityFeed";
import { useAgentDirectory } from "../_hooks/useAgentDirectory";

interface DashboardData {
  agentsOnline: number;
  lastRun: string;
  errors24h: number;
  workflowsPending: number;
  agentStatuses: {
    id: string;
    name: string;
    status: string;
    lastActive: string;
    tasksCompleted: number;
  }[];
  activity: {
    id: string;
    time: string;
    type: string;
    agent: string;
    action: string;
  }[];
}

export default function DashboardPage() {
  const { agents, isLoading: agentsLoading } = useAgentDirectory();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/studio/status")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <StudioShell
      agents={agents}
      selectedAgent={null}
      onSelectAgent={() => {}}
      isLoading={agentsLoading}
    >
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h1 className="text-lg font-semibold text-zinc-100 mb-6">Dashboard</h1>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-900" />
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-lg bg-zinc-900" />
            <div className="h-32 animate-pulse rounded-lg bg-zinc-900" />
          </div>
        ) : (
          <div className="space-y-6">
            <DashboardKpis
              agentsOnline={data?.agentsOnline ?? "—"}
              lastRun={data?.lastRun ?? "—"}
              errors24h={data?.errors24h ?? 0}
              workflowsPending={data?.workflowsPending ?? 0}
            />

            <div>
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Agent Status</h2>
              <AgentStatusTable agents={data?.agentStatuses ?? []} />
            </div>

            <div>
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Recent Activity</h2>
              <ActivityFeed events={data?.activity ?? []} />
            </div>
          </div>
        )}
      </div>
    </StudioShell>
  );
}
