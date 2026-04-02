import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ClinicianPatientSummary } from '../../utils/clinicianApi';
import { sortPatientSummariesForPriority } from '../../utils/clinicianApi';
import ClinicianRiskBadge from './ClinicianRiskBadge';
import { clinPanel, clinPanelHeader } from './clinicianUiClasses';

interface ClinicianAlertsPanelProps {
  summaries: ClinicianPatientSummary[];
  /** Full triage page vs compact dashboard column */
  layout?: 'sidebar' | 'page';
}

function displayName(row: ClinicianPatientSummary): string {
  if (row.consented_for_clinician_access && row.preferred_name?.trim()) {
    return row.preferred_name.trim();
  }
  return `Patient #${row.patient_id}`;
}

function flagsFor(row: ClinicianPatientSummary): string[] {
  const f: string[] = [];
  if (row.high_risk_no_followup) f.push('High risk · follow-up gap');
  if (row.reassessment_due) f.push('Reassessment due');
  if (row.candidate_for_clinician_review) f.push('Review recommended');
  if (row.trend_direction === 'worsening') f.push('Worsening trend');
  if (f.length === 0 && ['high', 'critical'].includes(row.overall_risk_level)) {
    f.push('Elevated risk level');
  }
  return f;
}

function partitionTriage(sorted: ClinicianPatientSummary[]) {
  const seen = new Set<number>();
  const take = (pred: (s: ClinicianPatientSummary) => boolean) => {
    const out: ClinicianPatientSummary[] = [];
    for (const s of sorted) {
      if (seen.has(s.patient_id)) continue;
      if (pred(s)) {
        seen.add(s.patient_id);
        out.push(s);
      }
    }
    return out;
  };
  const urgent = take(
    (s) =>
      s.high_risk_no_followup ||
      s.overall_risk_level === 'critical' ||
      s.overall_risk_level === 'high'
  );
  const schedule = take((s) => s.reassessment_due);
  const review = take((s) => s.candidate_for_clinician_review);
  const trends = take((s) => s.trend_direction === 'worsening');
  return { urgent, schedule, review, trends };
}

const AlertRow: React.FC<{ row: ClinicianPatientSummary; dense?: boolean }> = ({ row, dense }) => {
  const flags = flagsFor(row);
  return (
    <li
      className={`clinician-alert-row px-4 py-3 border-b border-slate-100/90 last:border-0 hover:bg-slate-50/90 ${
        dense ? 'py-2.5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/clinician/patients/${row.patient_id}`}
            className="text-sm font-semibold text-slate-900 hover:text-primary-700 truncate block transition-colors"
          >
            {displayName(row)}
          </Link>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {flags.map((label) => (
              <span
                key={label}
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <ClinicianRiskBadge level={row.overall_risk_level} className="shrink-0" />
      </div>
    </li>
  );
};

const ClinicianAlertsPanel: React.FC<ClinicianAlertsPanelProps> = ({ summaries, layout = 'sidebar' }) => {
  const sorted = useMemo(() => {
    return sortPatientSummariesForPriority(
      summaries.filter(
        (s) =>
          s.high_risk_no_followup ||
          s.reassessment_due ||
          s.candidate_for_clinician_review ||
          s.trend_direction === 'worsening' ||
          s.flags?.high_risk_no_followup ||
          s.flags?.requires_attention
      )
    );
  }, [summaries]);

  if (sorted.length === 0) {
    return (
      <div className={clinPanel}>
        <div className={clinPanelHeader}>
          <h2 className="text-sm font-bold text-slate-900">Priority queue</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Derived from assigned patient summaries</p>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-slate-700">Queue clear</p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            No elevated flags on your current assignment list. Re-check after new screenings or assignments.
          </p>
        </div>
      </div>
    );
  }

  if (layout === 'page') {
    const { urgent, schedule, review, trends } = partitionTriage(sorted);
    const sections: { id: string; title: string; subtitle: string; items: ClinicianPatientSummary[]; bar: string }[] = [
      {
        id: 'urgent',
        title: 'Urgent attention',
        subtitle: 'High risk or follow-up gaps',
        items: urgent,
        bar: 'bg-rose-500',
      },
      {
        id: 'schedule',
        title: 'Reassessment & scheduling',
        subtitle: 'Intervals due or overdue',
        items: schedule,
        bar: 'bg-amber-500',
      },
      {
        id: 'review',
        title: 'Clinical review',
        subtitle: 'Suggested clinician review',
        items: review,
        bar: 'bg-sky-600',
      },
      {
        id: 'trends',
        title: 'Trend signals',
        subtitle: 'Worsening screening trajectory',
        items: trends,
        bar: 'bg-slate-500',
      },
    ];

    return (
      <div className="space-y-6">
        {sections.map((sec) =>
          sec.items.length === 0 ? null : (
            <section key={sec.id} className={clinPanel}>
              <div className={`h-1 w-full ${sec.bar} rounded-t-xl`} aria-hidden />
              <div className="px-4 py-3 border-b border-slate-100/90 bg-slate-50/80">
                <h2 className="text-sm font-bold text-slate-900">{sec.title}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{sec.subtitle}</p>
                <p className="text-[11px] text-slate-400 mt-1">{sec.items.length} in this tier</p>
              </div>
              <ul className="divide-y divide-slate-100/80">
                {sec.items.map((row) => (
                  <AlertRow key={row.patient_id} row={row} />
                ))}
              </ul>
            </section>
          )
        )}
      </div>
    );
  }

  /* sidebar */
  return (
    <div className={clinPanel}>
      <div className={clinPanelHeader}>
        <h2 className="text-sm font-bold text-slate-900">Priority follow-ups</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">Derived from assigned patient summaries</p>
      </div>
      <ul className="max-h-[min(420px,50vh)] overflow-y-auto">
        {sorted.slice(0, 12).map((row) => (
          <AlertRow key={row.patient_id} row={row} dense />
        ))}
      </ul>
    </div>
  );
};

export default ClinicianAlertsPanel;
