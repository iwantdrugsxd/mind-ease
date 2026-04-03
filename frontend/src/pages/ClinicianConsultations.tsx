import React from 'react';
import ConsultationQueue from '../components/clinician/ConsultationQueue';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import { ConsultationListRow, fetchClinicianConsultations } from '../utils/clinicianApi';
import { useNavigate } from 'react-router-dom';
import { subscribeConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../hooks/useIntervalWhenVisible';

const ClinicianConsultations: React.FC = () => {
  const [rows, setRows] = React.useState<ConsultationListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{ status?: string; priority?: string }>({});
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClinicianConsultations({
        status: filter.status as any,
        priority: filter.priority as any,
      });
      setRows(data);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Could not load consultation cases.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => subscribeConsultationRefresh('clinician', () => void load()), [load]);

  useRefreshOnWindowFocus(() => void load(), { debounceMs: 1000 });
  useIntervalWhenVisible(() => void load(), 45_000);

  return (
    <div className="space-y-4">
      <ClinicianPageIntro
        eyebrow="Consultations"
        title="Consultation cases"
        description="Your prioritized queue of assigned patients needing consultation. Filter by status or priority."
        actions={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                className="px-2 py-1 rounded-md text-xs border border-slate-300 hover:bg-slate-50"
                onClick={() => setFilter({ status: 'awaiting_patient' })}
              >
                Awaiting patient
              </button>
              <button
                className="px-2 py-1 rounded-md text-xs border border-slate-300 hover:bg-slate-50"
                onClick={() => setFilter({ priority: 'urgent' })}
              >
                Urgent
              </button>
              <button
                className="px-2 py-1 rounded-md text-xs border border-slate-300 hover:bg-slate-50"
                onClick={() => setFilter({})}
              >
                All
              </button>
            </div>
            <select
              className="px-2 py-2 border border-slate-300 rounded-md text-sm min-w-[160px]"
              value={filter.status || ''}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
            >
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="awaiting_clinician">Awaiting clinician</option>
              <option value="awaiting_patient">Awaiting patient</option>
              <option value="scheduled">Scheduled</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              className="px-2 py-2 border border-slate-300 rounded-md text-sm min-w-[160px]"
              value={filter.priority || ''}
              onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value || undefined }))}
            >
              <option value="">All priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        }
      />
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <ConsultationQueue
        cases={rows}
        loading={loading}
        onOpenPatient={(row) => navigate(`/clinician/patients/${row.patient}`, { state: { consultationCaseId: row.id } })}
        onOpenChat={(row) => navigate(`/clinician/patients/${row.patient}`, { state: { consultationCaseId: row.id, focusChat: true } })}
      />
    </div>
  );
};

export default ClinicianConsultations;
