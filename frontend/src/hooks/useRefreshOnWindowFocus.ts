import { useEffect, useRef } from 'react';

/**
 * Debounced refresh when the tab gains focus or becomes visible again.
 */
export function useRefreshOnWindowFocus(
  onRefresh: () => void,
  options?: { debounceMs?: number; enabled?: boolean }
): void {
  const { debounceMs = 900, enabled = true } = options || {};
  const timerRef = useRef<number | undefined>(undefined);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        cb.current();
      }, debounceMs);
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
      window.clearTimeout(timerRef.current);
    };
  }, [debounceMs, enabled]);
}
