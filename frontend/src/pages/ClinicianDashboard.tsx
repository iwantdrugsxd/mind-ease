import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchClinicianPatientSummaries,
  fetchClinicianProfile,
  sortPatientSummariesForPriority,
} from '../utils/clinicianApi';
import type { ClinicianPatientSummary } from '../utils/clinicianApi';
import type { ClinicianProfile } from '../utils/clinicianApi';
import ClinicianStatsCards from '../components/clinician/ClinicianStatsCards';
import ClinicianPatientTable, { PatientTableFilter } from '../components/clinician/ClinicianPatientTable';
import ClinicianAlertsPanel from '../components/clinician/ClinicianAlertsPanel';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import ClinicianFilterBar from '../components/clinician/ClinicianFilterBar';
import { clinPanel, clinPanelAccentTop, clinBtnSecondary, clinConsoleStack } from '../components/clinician/clinicianUiClasses';
import { UserCircle } from 'lucide-react';
import ConsultationQueue from '../components/clinician/ConsultationQueue';
import { ConsultationListRow, fetchClinicianConsultations, fetchClinicianConsultationSummary, ClinicianConsultationSummary } from '../utils/clinicianApi';
import { useNavigate } from 'react-router-dom';
import { subscribeConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../hooks/useAuthenticatedEventStream';

const ClinicianDashboard: React.FC = () => {
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [summaries, setSummaries] = useState<ClinicianPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PatientTableFilter>('all');
  const [queue, setQueue] = useState<ConsultationListRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState<ClinicianConsultationSummary | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, me] = await Promise.all([
        fetchClinicianPatientSummaries(),
        fetchClinicianProfile().catch(() => null),
      ]);
      setSummaries(sortPatientSummariesForPriority(rows));
      setProfile(me);
    } catch (e: any) {
      setError(e?.message || 'Could not load dashboard data.');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [rows, stats] = await Promise.all([
        fetchClinicianConsultations({}),
        fetchClinicianConsultationSummary().catch(() => null),
      ]);
      setQueue(rows);
      setSummaryStats(stats);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => subscribeConsultationRefresh('clinician', () => void loadQueue()), [loadQueue]);

  useRefreshOnWindowFocus(() => void loadQueue(), { debounceMs: 1000 });
  useIntervalWhenVisible(() => void loadQueue(), 50_000);
  useAuthenticatedEventStream('/clinician/me/consultation-events/', {
    onUpdate: () => void loadQueue(),
  });

  if (loading) {
    return <ClinicianLoadingState message="Loading assigned patients and signals…" showSkeleton />;
  }

  if (error) {
    return (
      <div className={`${clinPanel} overflow-hidden border-red-200/90 bg-red-50/50`}>
        <div className="h-1 w-full rounded-t-xl shrink-0 bg-gradient-to-r from-rose-900 via-rose-500 to-rose-900" aria-hidden />
        <div className="p-6">
          <p className="text-sm font-bold text-red-900">Unable to load dashboard</p>
          <p className="mt-2 text-sm text-red-800/90">{error}</p>
          <button type="button" onClick={() => void load()} className={`${clinBtnSecondary} mt-4`}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clinConsoleStack}>
      {profile ? (
        <div className={`${clinPanel} overflow-hidden`}>
          <div className={clinPanelAccentTop} />
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shrink-0 shadow-lg shadow-slate-900/20">
              <UserCircle className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Your profile</p>
              <p className="text-sm font-bold text-slate-900 mt-1 tracking-tight">
                {profile.specialization}
                {profile.organization ? <span className="text-slate-500 font-semibold"> · {profile.organization}</span> : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <ClinicianStatsCards summaries={summaries} />

      {/* Consultation queue */}
      {summaryStats ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Unread replies</p>
            <p className="text-xl font-bold text-slate-900">{summaryStats.unread_patient_replies}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Awaiting patient</p>
            <p className="text-xl font-bold text-slate-900">{summaryStats.awaiting_patient_cases}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Scheduled</p>
            <p className="text-xl font-bold text-slate-900">{summaryStats.scheduled_followups}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Urgent</p>
            <p className="text-xl font-bold text-slate-900">{summaryStats.urgent_cases}</p>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <ClinicianPageIntro
          eyebrow="Consultation queue"
          title="Patients who need your attention"
          description="Derived from scorecard-backed signals and recent alerts."
        />
        <ConsultationQueue
          cases={queue}
          loading={queueLoading}
          onOpenPatient={(row) => navigate(`/clinician/patients/${row.patient}`, { state: { consultationCaseId: row.id } })}
          onOpenChat={(row) => navigate(`/clinician/patients/${row.patient}`, { state: { consultationCaseId: row.id, focusChat: true } })}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <ClinicianPageIntro
            eyebrow="Roster"
            title="Assigned patients"
            description="Sorted by risk and follow-up priority. Open a record for assignment-scoped screening context."
            actions={
              <ClinicianFilterBar
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
              />
            }
          />
          <ClinicianPatientTable rows={summaries} search={search} filter={filter} />
        </div>
        <div className="xl:col-span-1 min-h-0">
          <ClinicianAlertsPanel summaries={summaries} layout="sidebar" />
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboard;
