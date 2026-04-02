import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import ClinicianEmptyState from '../components/clinician/ClinicianEmptyState';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import { clinPanel, clinTableHead, clinTableRow, clinBtnSecondary, clinConsoleStack } from '../components/clinician/clinicianUiClasses';
import { Calendar } from 'lucide-react';

interface AppointmentRow {
  id: number;
  patient?: number;
  patient_name?: string;
  scheduled_date?: string;
  status?: string;
  appointment_type?: string;
}

function statusBadge(status: string | undefined) {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel')) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (s.includes('complet')) return 'bg-emerald-50 text-emerald-900 border-emerald-200/80';
  if (s.includes('schedul') || s.includes('book')) return 'bg-sky-50 text-sky-900 border-sky-200/80';
  return 'bg-amber-50 text-amber-900 border-amber-200/80';
}

const ClinicianAppointments: React.FC = () => {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ results?: AppointmentRow[] }>('/clinician/appointments/');
      setRows(res.data.results || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load appointments.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ClinicianLoadingState message="Loading schedule…" />;
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

  if (rows.length === 0) {
    return (
      <div className={`${clinConsoleStack} max-w-4xl`}>
        <ClinicianPageIntro
          eyebrow="Schedule"
          title="Appointments"
          description="Visits tied to your clinician account, with quick links into patient records."
        />
        <ClinicianEmptyState
          icon={<Calendar className="h-6 w-6" aria-hidden />}
          title="No appointments"
          description="When visits are scheduled in MindEase, they will appear here with patient links and status."
        />
      </div>
    );
  }

  return (
    <div className={`${clinConsoleStack} max-w-4xl`}>
      <ClinicianPageIntro
        eyebrow="Schedule"
        title="Appointments"
        description="Upcoming and recent visits. Date and time use your browser locale."
      />
      <div className={`${clinPanel} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={clinTableHead}>
                <th className="px-4 py-3.5">Patient</th>
                <th className="px-4 py-3.5">When</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} className={clinTableRow}>
                  <td className="px-4 py-3.5">
                    {a.patient ? (
                      <Link
                        to={`/clinician/patients/${a.patient}`}
                        className="font-semibold text-primary-700 hover:text-primary-800 hover:underline transition-colors"
                      >
                        {a.patient_name || `Patient #${a.patient}`}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-800 whitespace-nowrap">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Scheduled</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {a.scheduled_date ? new Date(a.scheduled_date).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 capitalize text-slate-700 font-medium">
                    {a.appointment_type?.replace(/_/g, ' ') || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide border ${statusBadge(a.status)}`}
                    >
                      {a.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClinicianAppointments;
