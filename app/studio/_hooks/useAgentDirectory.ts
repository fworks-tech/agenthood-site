"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentEntry } from "../_data/agents";

export function useAgentDirectory() {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/agents")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load agents");
        return res.json();
      })
      .then((data) => {
        setAgents(data.agents);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return { agents, isLoading, error };
}
