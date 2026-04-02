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

  const load = React.useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft);
    if (!soft) {
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
        setCases([]);
        setNotifications([]);
        setError(e?.message || 'Unable to load care team messages.');
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

  return (
    <div className="space-y-6">
      {notifications.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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
              <div key={notification.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{notification.body}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
                {!notification.is_read ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await markPatientCareNotificationRead(notification.id);
                      void load({ soft: true });
                    }}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Inbox</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Active conversations</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {cases.length} total
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Open a thread to read messages, reply, and review follow-up steps from your care team.
            </p>
          </div>
          <CareTeamInbox
            cases={cases}
            loading={loading}
            selectedCaseId={selected?.id || null}
            onSelect={(row) => setSelected(row)}
          />
        </div>

        <div>
          {selected ? (
            <CareTeamChatPanel
              caseId={selected.id}
              onActivity={onThreadActivity}
              refreshIntervalMs={35_000}
              externalRefreshKey={liveThread.lastEventAt}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
              Select a conversation to view private messages from your care team.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CareTeam;
