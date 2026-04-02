import { useEffect, useRef } from 'react';

/**
 * Runs callback on a fixed interval only while the document is visible.
 */
export function useIntervalWhenVisible(callback: () => void, intervalMs: number | null, enabled = true): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs == null || intervalMs < 15_000) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      saved.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
