import React from 'react';
import {
  ConsultationThread,
  ConsultationThreadMessage,
  fetchPatientConsultationThread,
  sendPatientConsultationMessage,
  markPatientConsultationMessageRead,
} from '../../utils/clinicianApi';
import { emitConsultationRefresh } from '../../utils/consultationRefreshBus';

function shortTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function CareTeamChatPanel({
  caseId,
  onActivity,
  refreshIntervalMs = 35_000,
  externalRefreshKey,
}: {
  caseId: number;
  onActivity?: () => void | Promise<void>;
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
  const bumpPatientBus = React.useCallback(async () => {
    emitConsultationRefresh('patient');
    await onActivityRef.current?.();
  }, []);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const t = await fetchPatientConsultationThread(caseId);
      const nextMax = t?.messages?.length ? Math.max(...t.messages.map((m) => m.id)) : 0;
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
      setLastSyncAt(Date.now());
      if (!silent) setError(null);
    } catch (e: any) {
      if (!silent) {
        setError(e?.message || 'Unable to load messages.');
        setThread(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [caseId]);

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
    const markAllClinicianUnreadRead = async () => {
      if (!thread) return;
      const unread = thread.messages.filter(
        (m) => (m.sender_type === 'clinician' || m.sender_type === 'system') && !m.is_read
      );
      if (unread.length === 0) return;
      try {
        await Promise.all(unread.map((m) => markPatientConsultationMessageRead(thread.consultation_case, m.id)));
        await load({ silent: true });
        await bumpPatientBus();
      } catch {
        // ignore
      }
    };
    void markAllClinicianUnreadRead();
  }, [thread, load, bumpPatientBus]);

  const onSend = async () => {
    const content = message.trim();
    if (!content) return;
    setSending(true);
    try {
      const msg = await sendPatientConsultationMessage(caseId, content);
      setThread((t) => (t ? { ...t, messages: [...t.messages, msg as ConsultationThreadMessage] } : t));
      setMessage('');
      await load({ silent: true });
      await bumpPatientBus();
    } catch (e: any) {
      setError(e?.message || 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded" />
          <div className="h-4 bg-slate-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
  }

  if (!thread) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        This conversation is not available right now.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Conversation</p>
          <div className="mt-1 text-base font-semibold text-slate-900">Care team messages</div>
        </div>
        <div className="flex items-center gap-2">
          {newActivity ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
              New message
            </span>
          ) : null}
          {lastSyncAt ? (
            <span className="text-[10px] text-slate-400 tabular-nums">Updated {shortTime(lastSyncAt)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 max-h-[min(460px,58vh)] bg-[linear-gradient(180deg,rgba(248,250,252,0.55),rgba(255,255,255,0.95))]">
        {thread.messages.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            No messages yet. Your care team may reach out here.
          </div>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm transition-shadow duration-300 ${
                highlightIds.has(m.id) ? 'ring-2 ring-primary-400/80 ring-offset-1' : ''
              } ${
                m.sender_type === 'patient'
                  ? 'ml-auto bg-slate-900 text-white rounded-tr-md shadow-md shadow-slate-900/10'
                  : m.sender_type === 'clinician'
                  ? 'mr-auto border border-slate-200 bg-white text-slate-900 rounded-tl-md shadow-sm'
                  : 'mx-auto border border-emerald-100 bg-emerald-50/90 text-emerald-950 rounded-xl text-[13px]'
              }`}
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
                {m.sender_type === 'patient'
                  ? 'You'
                  : m.sender_type === 'clinician'
                    ? 'Care team'
                    : 'Update'}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div className="mt-1 text-[10px] opacity-75">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          Use this space for secure messages with your clinician or care team. For self-guided AI support, continue using Chatbot separately.
        </div>
        <div className="flex items-center gap-2">
          <textarea
            className="flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            rows={2}
            placeholder="Write a private message to your care team…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center justify-end">
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
