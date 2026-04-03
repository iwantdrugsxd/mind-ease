import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowRight } from 'lucide-react';
import {
  ConsultationCaseDetail,
  ConsultationListRow,
  fetchClinicianConsultations,
  fetchConsultationCaseDetail,
} from '../utils/clinicianApi';
import ConsultationChatPanel from '../components/clinician/ConsultationChatPanel';
import ConsultationStatusBadge from '../components/clinician/ConsultationStatusBadge';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import { mergeByIdPreserveOrder } from '../utils/consultationMerge';
import { subscribeConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../hooks/useAuthenticatedEventStream';

function sortInbox(rows: ConsultationListRow[]): ConsultationListRow[] {
  const statusRank: Record<string, number> = {
    awaiting_clinician: 0,
    in_progress: 1,
    open: 2,
    awaiting_patient: 3,
    scheduled: 4,
    resolved: 5,
    closed: 6,
  };
  return [...rows].sort((a, b) => {
    const ua = Number(a.unread_for_clinician || 0);
    const ub = Number(b.unread_for_clinician || 0);
    if (ub !== ua) return ub - ua;
    const sa = statusRank[a.status] ?? 99;
    const sb = statusRank[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

const ClinicianMessages: React.FC = () => {
  const [rows, setRows] = React.useState<ConsultationListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [selectedCase, setSelectedCase] = React.useState<ConsultationCaseDetail | null>(null);
  const [mode, setMode] = React.useState<'all' | 'unread' | 'needs_reply'>('all');
  const [listUpdatedAt, setListUpdatedAt] = React.useState<number | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = React.useState(false);
  const navigate = useNavigate();
  const selectedIdRef = React.useRef<number | null>(null);
  selectedIdRef.current = selectedId;

  const loadRows = React.useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft);
    if (!soft) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchClinicianConsultations();
      const inboxRows = sortInbox(data.filter((row) => row.thread_id));
      setRows((prev) => (soft && prev.length ? mergeByIdPreserveOrder(prev, inboxRows) : inboxRows));
      setSelectedId((prev) => (prev && inboxRows.some((r) => r.id === prev) ? prev : inboxRows[0]?.id ?? null));
      setListUpdatedAt(Date.now());
    } catch (e: any) {
      if (!soft) {
        setRows([]);
        setError(e?.message || 'Could not load messages.');
      }
    } finally {
      if (!soft) setLoading(false);
    }
  }, []);

  const refreshSelectedCase = React.useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) {
      setSelectedCase(null);
      return;
    }
    try {
      const detail = await fetchConsultationCaseDetail(id);
      setSelectedCase(detail);
    } catch {
      setSelectedCase(null);
    }
  }, []);

  const onChatActivity = React.useCallback(async () => {
    await loadRows({ soft: true });
    await refreshSelectedCase();
  }, [loadRows, refreshSelectedCase]);

  React.useEffect(() => {
    void loadRows({ soft: false });
  }, [loadRows]);

  React.useEffect(() => subscribeConsultationRefresh('clinician', () => void loadRows({ soft: true })), [loadRows]);

  const handleRealtimeUpdate = React.useCallback(() => {
    void loadRows({ soft: true });
    void refreshSelectedCase();
  }, [loadRows, refreshSelectedCase]);

  const liveSummary = useAuthenticatedEventStream('/clinician/me/consultation-events/', {
    onUpdate: handleRealtimeUpdate,
  });

  const liveThread = useAuthenticatedEventStream(
    selectedId ? `/clinician/consultations/${selectedId}/thread-events/` : null,
    {
      enabled: Boolean(selectedId),
      onUpdate: handleRealtimeUpdate,
    }
  );

  useRefreshOnWindowFocus(() => {
    void loadRows({ soft: true });
    void refreshSelectedCase();
  }, { debounceMs: 1000 });

  useIntervalWhenVisible(() => {
    void loadRows({ soft: true });
    void refreshSelectedCase();
  }, 40_000);

  React.useEffect(() => {
    void refreshSelectedCase();
  }, [selectedId, refreshSelectedCase]);

  const visibleRows = rows.filter((row) => {
    if (mode === 'unread') return Number(row.unread_for_clinician || 0) > 0;
    if (mode === 'needs_reply') {
      return row.status === 'awaiting_clinician' || Number(row.unread_for_clinician || 0) > 0;
    }
    return true;
  });

  const updatedLabel = listUpdatedAt
    ? new Date(listUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-4">
      <ClinicianPageIntro
        eyebrow="Inbox"
        title="Messages"
        description="Threads stay in sync while you work. Unread and in-progress cases surface first—open a row for the full thread or jump to the care workspace."
        actions={
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            {updatedLabel ? (
              <span className="text-[10px] text-slate-500 tabular-nums order-last sm:order-first">List updated {updatedLabel}</span>
            ) : null}
            {(liveSummary.connected || liveThread.connected) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            ) : null}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${mode === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}
                onClick={() => setMode('all')}
              >
                All threads
              </button>
              <button
                type="button"
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${mode === 'unread' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}
                onClick={() => setMode('unread')}
              >
                Unread
              </button>
              <button
                type="button"
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${mode === 'needs_reply' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}
                onClick={() => setMode('needs_reply')}
              >
                Needs your reply
              </button>
            </div>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <div className={`rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden ${mobileThreadOpen ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading inbox…</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">No message threads match this view.</div>
          ) : (
            visibleRows.map((row) => {
              const isActive = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(row.id);
                    setMobileThreadOpen(true);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 ${isActive ? 'bg-slate-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.patient_name || `Patient #${row.patient}`}</p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {row.last_message_preview || row.trigger_reason || 'Open thread'}
                      </p>
                      <div className="mt-2">
                        <ConsultationStatusBadge status={row.status} priority={row.priority} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {Number(row.unread_for_clinician || 0) > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-bold">
                          {row.unread_for_clinician}
                        </span>
                      ) : null}
                      <p className="text-[11px] text-slate-500 mt-2">
                        {row.last_message_at ? new Date(row.last_message_at).toLocaleString() : 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className={`space-y-4 ${!mobileThreadOpen ? 'hidden lg:block' : ''}`}>
          {!selectedCase ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
              Select a thread to continue a patient conversation.
            </div>
          ) : (
            <>
              <div className="flex lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  Back to inbox
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedCase.patient_name || `Patient #${selectedCase.patient}`}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Current status: <span className="font-medium text-slate-700">{selectedCase.status.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/clinician/patients/${selectedCase.patient}`, {
                        state: { consultationCaseId: selectedCase.id, focusChat: true },
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                  >
                    Open workspace
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="h-4 w-4 text-primary-600" aria-hidden />
                  <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
                </div>
                <ConsultationChatPanel
                  caseId={selectedCase.id}
                  refreshIntervalMs={40_000}
                  externalRefreshKey={liveThread.lastEventAt}
                  onThreadChange={(thread) => {
                    setSelectedCase((current) => (current ? { ...current, thread: thread || null } : current));
                  }}
                  onActivity={onChatActivity}
                />
                <div className="mt-3 text-xs text-slate-500">
                  Need deeper context? Open the patient workspace for notes, appointments, and full care actions.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicianMessages;
