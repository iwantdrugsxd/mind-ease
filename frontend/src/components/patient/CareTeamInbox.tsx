import React from 'react';
import { PatientConsultationListRow } from '../../utils/clinicianApi';

function toPatientStatus(status: string): string {
  switch (status) {
    case 'open': return 'Support available';
    case 'in_progress': return 'In review';
    case 'awaiting_clinician': return 'In review';
    case 'awaiting_patient': return 'Reply requested';
    case 'scheduled': return 'Follow-up scheduled';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return 'Update';
  }
}

function formatFollowUp(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return null;
  }
}

export default function CareTeamInbox({
  cases,
  loading,
  selectedCaseId,
  onSelect,
}: {
  cases: PatientConsultationListRow[];
  loading?: boolean;
  selectedCaseId?: number | null;
  onSelect: (row: PatientConsultationListRow) => void;
}) {
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
  if (!cases.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        You don't have any active messages from your care team at the moment.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm overflow-hidden">
      {cases.map((c) => {
        const isActive = selectedCaseId === c.id;
        const unread = c.unread_for_patient || 0;
        const updated = c.last_activity_at ? new Date(c.last_activity_at).toLocaleString() : '';
        const preview =
          (c.care_preview || c.last_message_preview || '').trim() ||
          'Your care team may share updates or ask you to reply here.';
        const followUpAt = formatFollowUp(c.next_appointment_at);
        return (
          <button
            key={c.id}
            className={`w-full text-left px-4 py-4 transition-colors ${
              isActive ? 'bg-slate-50/90' : 'hover:bg-slate-50/60'
            }`}
            onClick={() => onSelect(c)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{toPatientStatus(c.status)}</div>
                  {c.next_appointment_at ? (
                    <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                      Scheduled
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">{preview}</div>
                {followUpAt ? (
                  <div className="text-[11px] text-slate-500 mt-2">
                    Follow-up: {followUpAt}
                  </div>
                ) : null}
              </div>
              <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
                {unread > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-bold">
                    {unread}
                  </span>
                ) : null}
                {c.thread_id ? (
                  c.last_message_at ? (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">Updated {updated}</span>
                  ) : null
                ) : (
                  <span className="text-[11px] text-slate-500">No messages yet</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
