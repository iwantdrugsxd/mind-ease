import React from 'react';
import {
  ConsultationThread,
  ConsultationThreadMessage,
  fetchConsultationThread,
  sendConsultationMessage,
  markConsultationMessageRead,
} from '../../utils/clinicianApi';
import { emitConsultationRefresh } from '../../utils/consultationRefreshBus';

function shortTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ConsultationChatPanel({
  caseId,
  onThreadChange,
  onActivity,
  refreshIntervalMs,
  externalRefreshKey,
}: {
  caseId: number;
  onThreadChange?: (thread: ConsultationThread | null) => void;
  onActivity?: () => void | Promise<void>;
  /** Polling when document visible (e.g. 45000). Uses silent reload to avoid UI flicker. */
  refreshIntervalMs?: number;
  externalRefreshKey?: number | null;
}) {
  const [thread, setThread] = React.useState<ConsultationThread | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<number | null>(null);
  const [newActivity, setNewActivity] = React.useState(false);
  const [highlightIds, setHighlightIds] = React.useState<Set<number>>(() => new Set());
  const maxMsgIdRef = React.useRef(0);
  const chipTimerRef = React.useRef<number | undefined>(undefined);
  const highlightTimerRef = React.useRef<number | undefined>(undefined);

  const onActivityRef = React.useRef(onActivity);
  onActivityRef.current = onActivity;
  const onThreadChangeRef = React.useRef(onThreadChange);
  onThreadChangeRef.current = onThreadChange;
  const bumpClinicianBus = React.useCallback(async () => {
    emitConsultationRefresh('clinician');
    await onActivityRef.current?.();
  }, []);

  const load = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const t = await fetchConsultationThread(caseId);
        const nextMax =
          t?.messages?.length ? Math.max(...t.messages.map((m) => m.id)) : 0;
        if (silent && t && nextMax > maxMsgIdRef.current) {
          const newIds = t.messages.filter((m) => m.id > maxMsgIdRef.current).map((m) => m.id);
          setNewActivity(true);
          window.clearTimeout(chipTimerRef.current);
          chipTimerRef.current = window.setTimeout(() => setNewActivity(false), 4500);
          if (newIds.length) {
            setHighlightIds(new Set(newIds));
            window.clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = window.setTimeout(() => setHighlightIds(new Set()), 6000);
          }
        }
        maxMsgIdRef.current = Math.max(maxMsgIdRef.current, nextMax);
        setThread(t);
        onThreadChangeRef.current?.(t);
        setLastSyncAt(Date.now());
        if (!silent) setError(null);
      } catch (e: any) {
        if (!silent) {
          setError(e?.message || 'Failed to load thread');
          setThread(null);
          onThreadChangeRef.current?.(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [caseId]
  );

  React.useEffect(() => {
    maxMsgIdRef.current = 0;
    void load({ silent: false });
  }, [caseId, load]);

  React.useEffect(() => {
    if (!externalRefreshKey) return;
    void load({ silent: true });
  }, [externalRefreshKey, load]);

  React.useEffect(() => {
    return () => {
      window.clearTimeout(chipTimerRef.current);
      window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < 15000) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load({ silent: true });
    }, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [caseId, refreshIntervalMs, load]);

  React.useEffect(() => {
    const syncReadState = async () => {
      if (!thread) return;
      const unreadPatientMessages = thread.messages.filter(
        (m) => m.sender_type === 'patient' && !m.is_read
      );
      if (unreadPatientMessages.length === 0) return;
      try {
        await Promise.all(
          unreadPatientMessages.map((m) =>
            markConsultationMessageRead(thread.consultation_case, m.id)
          )
        );
        await load({ silent: true });
        await bumpClinicianBus();
      } catch {
        // keep thread visible even if read sync fails
      }
    };
    void syncReadState();
  }, [thread, load, bumpClinicianBus]);

  const onSend = async () => {
    const content = message.trim();
    if (!content) return;
    setSending(true);
    try {
      const msg = await sendConsultationMessage(caseId, content);
      setThread((t) =>
        t
          ? {
              ...t,
              messages: [...t.messages, msg as ConsultationThreadMessage],
            }
          : t
      );
      setMessage('');
      await load({ silent: true });
      await bumpClinicianBus();
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded" />
          <div className="h-4 bg-slate-200 rounded w-5/6" />
          <div className="h-4 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No consultation thread is available for this case.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">
          Messages ·{' '}
          <span className="font-medium text-slate-900">{thread.messages.length} total</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {newActivity ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
              New activity
            </span>
          ) : null}
          {lastSyncAt ? (
            <span className="text-[10px] text-slate-400 tabular-nums">Synced {shortTime(lastSyncAt)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[min(420px,55vh)]">
        {thread.messages.length === 0 ? (
          <div className="text-sm text-slate-600">No messages yet.</div>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm transition-shadow duration-300 ${
                highlightIds.has(m.id) ? 'ring-2 ring-primary-400/80 ring-offset-1' : ''
              } ${
                m.sender_type === 'clinician'
                  ? 'ml-auto bg-slate-900 text-white rounded-tr-sm'
                  : m.sender_type === 'patient'
                  ? 'mr-auto bg-slate-100 text-slate-900 rounded-tl-sm'
                  : 'mx-auto bg-emerald-50/90 border border-emerald-100 text-emerald-950 rounded-md text-[13px]'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div className="mt-1 text-[10px] opacity-75">
                {new Date(m.created_at).toLocaleString()}
                {m.sender_type === 'patient' && !m.is_read ? ' · unread' : ''}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <textarea
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            rows={2}
            placeholder="Write a message to the patient…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !message.trim()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-slate-800"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
