'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TurnstileStatus } from '../../../components/Turnstile';
import type { LogLevel, LogCategory } from '../_lib/log-types';
import { TURNSTILE_REQUIRED } from '../_lib/env';

interface UseCaptchaOptions {
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
}

interface UseCaptchaReturn {
  token: string | null;
  tokenRef: React.RefObject<string | null>;
  verified: boolean;
  error: string | null;
  refreshKey: number;
  isRequired: boolean;
  onStatus: (status: TurnstileStatus) => void;
  onError: (msg: string) => void;
  retry: () => void;
  refreshAndWait: () => Promise<boolean>;
  setToken: (t: string | null) => void;
}

export function useCaptcha(options: UseCaptchaOptions): UseCaptchaReturn {
  const { addLog } = options;
  const [token, setToken] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (token) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setError(null);
      setVerified(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [token]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const onStatus = useCallback(
    (status: TurnstileStatus) => {
      switch (status) {
        case 'script-loading':
          addLog('debug', 'CAPTCHA script loading', { category: 'captcha' });
          break;
        case 'script-loaded':
          addLog('debug', 'CAPTCHA script loaded', { category: 'captcha' });
          break;
        case 'widget-rendered':
          addLog('debug', 'CAPTCHA widget rendered', { category: 'captcha' });
          break;
        case 'retrying':
          addLog('warn', 'CAPTCHA verification failed. Retrying...', { category: 'captcha' });
          break;
        case 'token-received':
          addLog('info', 'CAPTCHA ready', { category: 'captcha' });
          break;
        case 'token-expired':
          addLog('warn', 'CAPTCHA token expired. Re-verifying...', { category: 'captcha' });
          // Keep the last token and the verified latch: the Turnstile widget
          // renews via its expired-callback and delivers a fresh token, so the
          // interactive widget stays hidden after the first check. Re-showing it
          // on every token cycle is what made the checkbox pop back unchecked.
          break;
      }
    },
    [addLog],
  );

  const retry = useCallback(() => {
    setError(null);
    setToken(null);
    setRefreshKey((k) => k + 1);
    addLog('info', 'CAPTCHA retry requested', { category: 'captcha' });
  }, [addLog]);

  const onError = useCallback(
    (msg: string) => {
      setError(msg);
      addLog('error', msg, { category: 'captcha' });
    },
    [addLog],
  );

  const refreshAndWait = useCallback(async (): Promise<boolean> => {
    const staleToken = tokenRef.current;
    const hasFreshToken = (): boolean =>
      !!tokenRef.current && tokenRef.current !== staleToken;

    if (staleToken) {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        if (hasFreshToken()) return true;
        await new Promise((r) => setTimeout(r, 50));
      }
      setRefreshKey((k) => k + 1);
      const clearDeadline = Date.now() + 3000;
      while (tokenRef.current === staleToken && Date.now() < clearDeadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const newDeadline = Date.now() + 10000;
      while (!hasFreshToken() && Date.now() < newDeadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return hasFreshToken();
    }
    setRefreshKey((k) => k + 1);
    const deadline = Date.now() + 10000;
    while (!tokenRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return !!tokenRef.current;
  }, []);

  return {
    token,
    tokenRef,
    verified,
    error,
    refreshKey,
    isRequired: TURNSTILE_REQUIRED,
    onStatus,
    onError,
    retry,
    refreshAndWait,
    setToken,
  };
}
