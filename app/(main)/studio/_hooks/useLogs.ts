'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { LogCategory, LogEntry, LogLevel } from '../_lib/log-types';
import { isLogCategory } from '../_lib/log-types';
import type { LogCategoryFilter } from '../_components/LiveLogs';
import type { StreamLogEvent } from '../_lib/stream';
import { appendLog, createLogEntry, hasNewError, loadLogs } from '../_lib/log-store';
import { STORAGE_KEYS } from '../_lib/constants';

function loadLogsViewState(): { debug: boolean; category: LogCategoryFilter } {
  if (typeof window === 'undefined') return { debug: false, category: 'all' };
  try {
    const category = sessionStorage.getItem(STORAGE_KEYS.LOGS_CATEGORY);
    return {
      debug: sessionStorage.getItem(STORAGE_KEYS.LOGS_DEBUG) === '1',
      category: category && isLogCategory(category) ? (category as LogCategoryFilter) : 'all',
    };
  } catch {
    return { debug: false, category: 'all' };
  }
}

export interface UseLogsReturn {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
  handleNetworkLog: (log: StreamLogEvent) => void;
  logsOpen: boolean;
  setLogsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  debugVisible: boolean;
  setDebugVisible: React.Dispatch<React.SetStateAction<boolean>>;
  logCategoryFilter: LogCategoryFilter;
  setLogCategoryFilter: React.Dispatch<React.SetStateAction<LogCategoryFilter>>;
  liveLogsHeight: number;
  setLiveLogsHeight: React.Dispatch<React.SetStateAction<number>>;
}

export function useLogs(): UseLogsReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(true);
  const [debugVisible, setDebugVisible] = useState(false);
  const [logCategoryFilter, setLogCategoryFilter] = useState<LogCategoryFilter>('all');
  const [liveLogsHeight, setLiveLogsHeight] = useState(120);

  useEffect(() => {
    const saved = loadLogs();
    if (saved.length > 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setLogs(saved);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  useEffect(() => {
    const state = loadLogsViewState();
    /* eslint-disable react-hooks/set-state-in-effect */
    setDebugVisible(state.debug);
    setLogCategoryFilter(state.category);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEYS.LOGS_DEBUG, debugVisible ? '1' : '0');
  }, [debugVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEYS.LOGS_CATEGORY, logCategoryFilter);
  }, [logCategoryFilter]);

  const prevLogCountRef = useRef(0);
  useEffect(() => {
    const prevCount = prevLogCountRef.current;
    prevLogCountRef.current = logs.length;
    if (!logsOpen && hasNewError(logs, prevCount)) {
      setLogsOpen(true);
    }
  }, [logs, logsOpen]);

  const addLog = useCallback(
    (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => {
      setLogs((prev) => appendLog(prev, createLogEntry(level, opts?.category ?? 'system', message, opts?.detail)));
    },
    [],
  );

  const handleNetworkLog = useCallback(
    (log: StreamLogEvent) => {
      const detail = typeof log.correlationId === 'string' ? log.correlationId : undefined;
      const parts: string[] = [log.event];
      if (typeof log.primary === 'string') parts.push(`primary=${log.primary}`);
      if (typeof log.status === 'number') parts.push(`status=${log.status}`);
      if (typeof log.durationMs === 'number') parts.push(`${log.durationMs}ms`);
      addLog(log.level as LogLevel, parts.join(' · '), { category: 'network', detail });
    },
    [addLog],
  );

  return {
    logs,
    addLog,
    handleNetworkLog,
    logsOpen,
    setLogsOpen,
    debugVisible,
    setDebugVisible,
    logCategoryFilter,
    setLogCategoryFilter,
    liveLogsHeight,
    setLiveLogsHeight,
  };
}
