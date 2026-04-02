import React from 'react';

type Status =
  | 'open'
  | 'in_progress'
  | 'awaiting_clinician'
  | 'awaiting_patient'
  | 'scheduled'
  | 'resolved'
  | 'closed';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export default function ConsultationStatusBadge({
  status,
  priority,
}: {
  status: Status;
  priority: Priority;
}) {
  const statusClass = {
    open: 'bg-sky-100 text-sky-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    awaiting_clinician: 'bg-violet-100 text-violet-900',
    awaiting_patient: 'bg-amber-100 text-amber-900',
    scheduled: 'bg-teal-100 text-teal-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    closed: 'bg-slate-200 text-slate-800',
  }[status];

  const prClass = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  }[priority];

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}>
        {label(status)}
      </span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prClass}`}>
        {priority.toUpperCase()}
      </span>
    </div>
  );
}

function label(s: Status): string {
  switch (s) {
    case 'open': return 'Open';
    case 'in_progress': return 'In progress';
    case 'awaiting_clinician': return 'Awaiting clinician';
    case 'awaiting_patient': return 'Awaiting patient';
    case 'scheduled': return 'Scheduled';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return s;
  }
}
