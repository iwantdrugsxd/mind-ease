import React from 'react';
import { API_BASE_URL, getApiAuthToken } from '../utils/api';

type StreamEvent = {
  event: string;
  data: any;
};

type Options = {
  enabled?: boolean;
  reconnectMs?: number;
  onUpdate?: (payload: any) => void;
  onEvent?: (event: StreamEvent) => void;
};

function parseSseChunk(chunk: string): StreamEvent | null {
  const lines = chunk.split('\n');
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

export function useAuthenticatedEventStream(path: string | null, options?: Options) {
  const {
    enabled = true,
    reconnectMs = 3000,
    onUpdate,
    onEvent,
  } = options || {};
  const [connected, setConnected] = React.useState(false);
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null);
  const onUpdateRef = React.useRef(onUpdate);
  const onEventRef = React.useRef(onEvent);
  onUpdateRef.current = onUpdate;
  onEventRef.current = onEvent;

  React.useEffect(() => {
    if (!path || !enabled) {
      setConnected(false);
      return;
    }

    let disposed = false;
    let reconnectTimer: number | null = null;
    let controller: AbortController | null = null;

    const scheduleReconnect = (delay = reconnectMs) => {
      if (disposed || reconnectTimer != null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const handleParsedEvent = (parsed: StreamEvent) => {
      setLastEventAt(Date.now());
      if (parsed.event === 'ready') {
        setConnected(true);
      }
      onEventRef.current?.(parsed);
      if (parsed.event === 'update') {
        onUpdateRef.current?.(parsed.data);
      }
    };

    const connect = async () => {
      if (disposed || !path) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        scheduleReconnect(Math.max(reconnectMs, 5000));
        return;
      }

      controller = new AbortController();
      setConnected(false);
      try {
        const token = await getApiAuthToken();
        const response = await fetch(`${API_BASE_URL}${path}`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`Stream failed with status ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const rawEvent = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (rawEvent) {
              const parsed = parseSseChunk(rawEvent);
              if (parsed) handleParsedEvent(parsed);
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } catch {
        // Silent fallback: polling remains active as backup.
      } finally {
        controller = null;
        setConnected(false);
        if (!disposed) scheduleReconnect();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!controller) void connect();
      } else if (controller) {
        controller.abort();
        controller = null;
      }
    };

    void connect();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      setConnected(false);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (controller) controller.abort();
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
    };
  }, [enabled, path, reconnectMs]);

  return { connected, lastEventAt };
}
