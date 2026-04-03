import React from 'react';
import { Link } from 'react-router-dom';
import type { ClinicianPatientSummary } from '../../utils/clinicianApi';
import ClinicianRiskBadge from './ClinicianRiskBadge';
import ClinicianEmptyState from './ClinicianEmptyState';
import { clinPanel, clinTableHead, clinTableRow, clinBtnPrimary } from './clinicianUiClasses';
import { MessageCircle, Users } from 'lucide-react';

export type PatientTableFilter = 'all' | 'high' | 'reassessment' | 'followup';

interface ClinicianPatientTableProps {
  rows: ClinicianPatientSummary[];
  search: string;
  filter: PatientTableFilter;
}

function displayName(row: ClinicianPatientSummary): string {
  if (row.consented_for_clinician_access && row.preferred_name?.trim()) {
    return row.preferred_name.trim();
  }
  return `—`;
}

function formatWhen(iso: string | null | undefined, days: number | null | undefined): string {
  if (days != null && days >= 0) {
    return days === 0 ? 'Today' : `${days}d ago`;
  }
  if (iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }
  return '—';
}

const ClinicianPatientTable: React.FC<ClinicianPatientTableProps> = ({ rows, search, filter }) => {
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filter === 'high' && !['high', 'critical'].includes(r.overall_risk_level)) return false;
    if (filter === 'reassessment' && !r.reassessment_due) return false;
    if (filter === 'followup' && !r.candidate_for_clinician_review && !r.high_risk_no_followup) return false;
    if (!q) return true;
    const idMatch = String(r.patient_id).includes(q);
    const nameMatch = (r.preferred_name || '').toLowerCase().includes(q);
    return idMatch || nameMatch;
  });

  if (filtered.length === 0) {
    return (
      <ClinicianEmptyState
        icon={<Users className="h-6 w-6 text-slate-500" aria-hidden />}
        title={rows.length === 0 ? 'No assigned patients' : 'No matches'}
        description={
          rows.length === 0
            ? 'When patients are assigned to you in MindEase, they will appear in this roster with screening and risk context.'
            : 'Try adjusting search or filters to see more of your roster.'
        }
      />
    );
  }

  return (
    <div className={`${clinPanel} overflow-hidden`}>
      <div className="lg:hidden divide-y divide-slate-100">
        {filtered.map((row) => (
          <div key={row.patient_id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">Patient ID {row.patient_id}</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{displayName(row)}</div>
              </div>
              <ClinicianRiskBadge level={row.overall_risk_level} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">PHQ-9</div>
                <div className="mt-1 font-semibold text-slate-900">{row.latest_phq9 != null ? row.latest_phq9.score : '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Last screen</div>
                <div className="mt-1 font-semibold text-slate-900">{formatWhen(row.last_screening_at, row.days_since_last_screening ?? null)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Next step</div>
              <div className="mt-1 text-slate-700">{row.next_best_action?.title || '—'}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to={`/clinician/patients/${row.patient_id}`}
                className={`${clinBtnPrimary} !py-2 !px-3 !text-sm justify-center`}
              >
                Record
              </Link>
              <Link
                to={`/clinician/patients/${row.patient_id}`}
                state={{ focusChat: true }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Open chat
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className={clinTableHead}>
              <th className="px-4 py-3 whitespace-nowrap">Patient ID</th>
              <th className="px-4 py-3 whitespace-nowrap">Name</th>
              <th className="px-4 py-3 whitespace-nowrap">Risk</th>
              <th className="px-4 py-3 whitespace-nowrap">PHQ-9</th>
              <th className="px-4 py-3 whitespace-nowrap">Trend</th>
              <th className="px-4 py-3 whitespace-nowrap">Last screen</th>
              <th className="px-4 py-3 whitespace-nowrap">Next step</th>
              <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <tr key={row.patient_id} className={clinTableRow}>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{row.patient_id}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{displayName(row)}</td>
                <td className="px-4 py-3">
                  <ClinicianRiskBadge level={row.overall_risk_level} />
                </td>
                <td className="px-4 py-3 text-slate-700 tabular-nums font-medium">
                  {row.latest_phq9 != null ? row.latest_phq9.score : '—'}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600 text-xs">{row.trend_direction || '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                  {formatWhen(row.last_screening_at, row.days_since_last_screening ?? null)}
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate text-xs" title={row.next_best_action?.title}>
                  {row.next_best_action?.title || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/clinician/patients/${row.patient_id}`}
                      className={`${clinBtnPrimary} !py-1.5 !px-3 !text-xs`}
                    >
                      Record
                    </Link>
                    <Link
                      to={`/clinician/patients/${row.patient_id}`}
                      state={{ focusChat: true }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      Open chat
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClinicianPatientTable;
