"use client";

interface ActivityEvent {
  id: string;
  time: string;
  type: string;
  agent: string;
  action: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-zinc-800/30 transition-colors">
          <span className="mt-0.5 text-xs text-zinc-600 shrink-0">{event.time}</span>
          <span className={`text-xs font-medium shrink-0 ${
            event.type === "error" ? "text-red-400" :
            event.type === "warning" ? "text-amber-400" :
            "text-emerald-400"
          }`}>
            {event.type.toUpperCase()}
          </span>
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-200">{event.agent}</span>
            {" "}{event.action}
          </p>
        </div>
      ))}
    </div>
  );
}
