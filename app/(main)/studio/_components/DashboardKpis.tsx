"use client";

interface DashboardKpisProps {
  agentsOnline: number | string;
  lastRun: string;
  errors24h: number;
  workflowsPending: number;
}

export default function DashboardKpis({ agentsOnline, lastRun, errors24h, workflowsPending }: DashboardKpisProps) {
  const kpis = [
    { label: "Agents Online", value: agentsOnline, color: "text-emerald-400" },
    { label: "Last Run", value: lastRun, color: "text-zinc-100" },
    { label: "Errors (24h)", value: errors24h, color: errors24h > 0 ? "text-red-400" : "text-zinc-100" },
    { label: "Workflows", value: workflowsPending, color: "text-zinc-100" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">{kpi.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}
