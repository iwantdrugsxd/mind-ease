import React, { useCallback, useEffect, useState } from 'react';
import { fetchClinicianPatientSummaries, sortPatientSummariesForPriority, fetchClinicianEscalations, updateClinicianEscalationAction } from '../utils/clinicianApi';
import type { ClinicianPatientSummary, CareEscalationEvent } from '../utils/clinicianApi';
import ClinicianAlertsPanel from '../components/clinician/ClinicianAlertsPanel';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import { clinPanel, clinBtnSecondary, clinConsoleStack } from '../components/clinician/clinicianUiClasses';
import { Link } from 'react-router-dom';

const ClinicianAlertsPage: React.FC = () => {
  const [summaries, setSummaries] = useState<ClinicianPatientSummary[]>([]);
  const [escalations, setEscalations] = useState<CareEscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, escalationRows] = await Promise.all([
        fetchClinicianPatientSummaries(),
        fetchClinicianEscalations().catch(() => []),
      ]);
      setSummaries(sortPatientSummariesForPriority(rows));
      setEscalations(escalationRows);
    } catch (e: any) {
      setError(e?.message || 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ClinicianLoadingState message="Building triage queue…" showSkeleton />;
  }

  if (error) {
    return (
      <div className={`${clinPanel} border-red-200/90 bg-red-50/50 p-6 max-w-lg`}>
        <p className="text-sm font-semibold text-red-900">{error}</p>
        <button type="button" className={`${clinBtnSecondary} mt-4`} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${clinConsoleStack} max-w-3xl`}>
      <ClinicianPageIntro
        eyebrow="Triage"
        title="Operational queue"
        description="Escalations are derived from overdue replies, clinician response delays, and outbound delivery failures on active consultations."
      />
      {escalations.length > 0 ? (
        <div className={`${clinPanel} p-5 space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Escalations</h2>
            <span className="text-xs text-slate-500">{escalations.length} open</span>
          </div>
          <div className="space-y-2">
            {escalations.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      event.severity === 'urgent' ? 'bg-rose-100 text-rose-700' :
                      event.severity === 'high' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {event.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{event.summary}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {event.patient_name || `Patient #${event.patient}`} · triggered {new Date(event.triggered_at).toLocaleString()}
                    {event.due_at ? ` · due ${new Date(event.due_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <Link
                  to={`/clinician/patients/${event.patient}`}
                  state={{ consultationCaseId: event.consultation_case }}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open case
                </Link>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actingId === event.id}
                    onClick={async () => {
                      setActingId(event.id);
                      try {
                        await updateClinicianEscalationAction(event.id, 'acknowledge');
                        await load();
                      } finally {
                        setActingId(null);
                      }
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={actingId === event.id}
                    onClick={async () => {
                      setActingId(event.id);
                      try {
                        await updateClinicianEscalationAction(event.id, 'resolve');
                        await load();
                      } finally {
                        setActingId(null);
                      }
                    }}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ClinicianAlertsPanel summaries={summaries} layout="page" />
    </div>
  );
};

export default ClinicianAlertsPage;
