import React from 'react';
import {
  PatientConsultationListRow,
  fetchPatientConsultations,
  CareNotification,
  fetchPatientCareNotifications,
  markPatientCareNotificationRead,
} from '../utils/clinicianApi';
import CareTeamInbox from '../components/patient/CareTeamInbox';
import CareTeamChatPanel from '../components/patient/CareTeamChatPanel';
import { mergeByIdPreserveOrder } from '../utils/consultationMerge';
import { subscribeConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../hooks/useAuthenticatedEventStream';

function sortCases(rows: PatientConsultationListRow[]): PatientConsultationListRow[] {
  const rank = (s: string) =>
    ({
      awaiting_patient: 0,
      awaiting_clinician: 1,
      in_progress: 2,
      open: 3,
      scheduled: 4,
      resolved: 5,
      closed: 6,
    } as Record<string, number>)[s] ?? 99;
  return [...rows].sort((a, b) => {
    const rd = rank(a.status) - rank(b.status);
    if (rd !== 0) return rd;
    const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    return tb - ta;
  });
}

const CareTeam: React.FC = () => {
  const [cases, setCases] = React.useState<PatientConsultationListRow[]>([]);
  const casesRef = React.useRef<PatientConsultationListRow[]>([]);
  casesRef.current = cases;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<PatientConsultationListRow | null>(null);
  const [notifications, setNotifications] = React.useState<CareNotification[]>([]);
  const [mobileThreadOpen, setMobileThreadOpen] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<'inbox' | 'updates'>('inbox');
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('patient:care-team:view');
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        cases?: PatientConsultationListRow[];
        notifications?: CareNotification[];
        selectedCaseId?: number | null;
      };
      if (Array.isArray(parsed.cases)) setCases(parsed.cases);
      if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications);
      if (parsed.selectedCaseId && Array.isArray(parsed.cases)) {
        const selectedCase = parsed.cases.find((row) => row.id === parsed.selectedCaseId) || null;
        setSelected(selectedCase);
      }
    } catch {
      // Ignore hydration failures.
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        'patient:care-team:view',
        JSON.stringify({
          cases,
          notifications,
          selectedCaseId: selected?.id || null,
        })
      );
    } catch {
      // Ignore persistence failures.
    }
  }, [hydrated, cases, notifications, selected]);

  const load = React.useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft);
    const isInitial = casesRef.current.length === 0;
    if (!soft && isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const [rows, careNotifications] = await Promise.all([
        fetchPatientConsultations(),
        fetchPatientCareNotifications().catch(() => []),
      ]);
      const sorted = sortCases(rows);
      const prev = casesRef.current;
      const next = soft && prev.length ? mergeByIdPreserveOrder(prev, sorted) : sorted;
      setCases(next);
      setNotifications(careNotifications as CareNotification[]);
      setSelected((prevSel) => {
        if (prevSel && next.some((r) => r.id === prevSel.id)) return prevSel;
        return next[0] || null;
      });
    } catch (e: any) {
      if (!soft) {
        if (casesRef.current.length === 0) {
          setCases([]);
          setNotifications([]);
          setError(e?.message || 'Unable to load care team messages.');
        }
      }
    } finally {
      if (!soft) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load({ soft: false });
  }, [load]);

  React.useEffect(() => subscribeConsultationRefresh('patient', () => void load({ soft: true })), [load]);

  useAuthenticatedEventStream('/clinician/patient/me/care-team-events/', {
    onUpdate: () => void load({ soft: true }),
  });

  const liveThread = useAuthenticatedEventStream(
    selected?.id ? `/clinician/patient/me/consultations/${selected.id}/thread-events/` : null,
    {
      enabled: Boolean(selected?.id),
      onUpdate: () => void load({ soft: true }),
    }
  );

  useRefreshOnWindowFocus(() => void load({ soft: true }), { debounceMs: 1000 });

  useIntervalWhenVisible(() => void load({ soft: true }), 45_000);

  const onThreadActivity = React.useCallback(() => void load({ soft: true }), [load]);
  const onSelectCase = React.useCallback((row: PatientConsultationListRow) => {
    setSelected(row);
    setMobileThreadOpen(true);
  }, []);

  const coldStart = loading && !hydrated && cases.length === 0 && notifications.length === 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Care Team</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Private messages</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{cases.length} threads</div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{notifications.filter((n) => !n.is_read).length} new</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <CompactCount label="Unread" value={String(cases.reduce((sum, row) => sum + (row.unread_for_patient || 0), 0))} />
          <CompactCount label="Reply" value={String(cases.filter((row) => row.status === 'awaiting_patient').length)} />
          <CompactCount label="Scheduled" value={String(cases.filter((row) => row.next_appointment_at).length)} />
        </div>
        <div className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('inbox')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${mobileTab === 'inbox' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('updates')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${mobileTab === 'updates' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            Updates
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className={`space-y-4 ${mobileThreadOpen ? 'hidden xl:block' : ''} ${mobileTab === 'updates' ? 'hidden xl:block' : ''}`}>
          <CareTeamInbox
            cases={cases}
            loading={coldStart}
            selectedCaseId={selected?.id || null}
            onSelect={onSelectCase}
          />
        </div>

        {notifications.length > 0 ? (
          <div className={`space-y-3 xl:hidden ${mobileThreadOpen || mobileTab === 'inbox' ? 'hidden' : ''}`}>
            {notifications.slice(0, 6).map((notification) => (
              <NotificationCard key={notification.id} notification={notification} onRead={async () => {
                await markPatientCareNotificationRead(notification.id);
                void load({ soft: true });
              }} />
            ))}
          </div>
        ) : null}

        <div className={`${!mobileThreadOpen ? 'hidden xl:block' : ''}`}>
          {selected ? (
            <div className="space-y-3">
              <div className="flex xl:hidden">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  Back to inbox
                </button>
              </div>
              <CareTeamChatPanel
                caseId={selected.id}
                onActivity={onThreadActivity}
                refreshIntervalMs={35_000}
                externalRefreshKey={liveThread.lastEventAt}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
              Select a conversation to view private messages from your care team.
            </div>
          )}
        </div>
      </section>

      {notifications.length > 0 ? (
        <section className="hidden xl:block rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent updates</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Care-team notifications</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {notifications.length} recent
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {notifications.slice(0, 3).map((notification) => (
              <NotificationCard key={notification.id} notification={notification} onRead={async () => {
                await markPatientCareNotificationRead(notification.id);
                void load({ soft: true });
              }} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default CareTeam;

function CompactCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function NotificationCard({
  notification,
  onRead,
}: {
  notification: CareNotification;
  onRead: () => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{notification.body}</p>
        <p className="mt-2 text-[11px] text-slate-400">{new Date(notification.created_at).toLocaleString()}</p>
      </div>
      {!notification.is_read ? (
        <button
          type="button"
          onClick={() => void onRead()}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
        >
          Read
        </button>
      ) : null}
    </div>
  );
}
