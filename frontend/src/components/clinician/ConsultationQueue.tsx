import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, MessageCircle } from 'lucide-react';
import ConsultationStatusBadge from './ConsultationStatusBadge';
import { ConsultationListRow } from '../../utils/clinicianApi';
import ClinicianRiskBadge from './ClinicianRiskBadge';

export default function ConsultationQueue({
  cases,
  loading,
  onOpenPatient,
  onOpenChat,
}: {
  cases: ConsultationListRow[];
  loading?: boolean;
  onOpenPatient: (row: ConsultationListRow) => void;
  onOpenChat?: (row: ConsultationListRow) => void;
}) {
  const navigate = useNavigate();

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

  if (!cases || cases.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-slate-500" />
        <span>No consultation cases currently need attention.</span>
      </div>
    );
  }

  const rows = sortByPriorityAndRecency(cases);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr className="text-left">
            <th className="px-4 py-2 font-semibold">Patient</th>
            <th className="px-4 py-2 font-semibold">Risk</th>
            <th className="px-4 py-2 font-semibold">PHQ-9</th>
            <th className="px-4 py-2 font-semibold">GAD-7</th>
            <th className="px-4 py-2 font-semibold">Reason</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2 font-semibold">Unread</th>
            <th className="px-4 py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ps = row.patient_summary;
            const phq = ps?.latest_phq9?.score ?? null;
            const gad = ps?.latest_gad7?.score ?? null;
            const unread = row.unread_for_clinician || 0;
            return (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{row.patient_name || `Patient #${row.patient}`}</div>
                  <div className="text-xs text-slate-500">ID: {row.patient}</div>
                </td>
                <td className="px-4 py-2">
                  <ClinicianRiskBadge level={ps?.overall_risk_level || 'unknown'} />
                </td>
                <td className="px-4 py-2">{phq ?? '—'}</td>
                <td className="px-4 py-2">{gad ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="text-slate-700 line-clamp-2 max-w-xs">{row.trigger_reason || '—'}</div>
                  {ps?.last_screening_at && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      Last screening: {new Date(ps.last_screening_at).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <ConsultationStatusBadge status={row.status} priority={row.priority} />
                </td>
                <td className="px-4 py-2">
                  {unread > 0 ? (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                      {unread}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">0</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenPatient(row)}
                      className="px-2 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Open
                    </button>
                    {row.thread_id ? (
                      <button
                        onClick={() => (onOpenChat ? onOpenChat(row) : navigate(`/clinician/patients/${row.patient}`))}
                        title="Open chat"
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Open chat
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">No thread</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function sortByPriorityAndRecency(rows: ConsultationListRow[]): ConsultationListRow[] {
  const rank: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
  return [...rows].sort((a, b) => {
    const pr = (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0);
    if (pr !== 0) return pr;
    const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    return tb - ta;
  });
}
