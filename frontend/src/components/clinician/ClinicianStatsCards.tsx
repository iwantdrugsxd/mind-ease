import React, { useMemo } from 'react';
import { Users, AlertTriangle, Bell, ClipboardList } from 'lucide-react';
import type { ClinicianPatientSummary } from '../../utils/clinicianApi';
import { clinPanel } from './clinicianUiClasses';

interface ClinicianStatsCardsProps {
  summaries: ClinicianPatientSummary[];
}

function isHighRisk(level: string): boolean {
  return level === 'high' || level === 'critical';
}

const ClinicianStatsCards: React.FC<ClinicianStatsCardsProps> = ({ summaries }) => {
  const stats = useMemo(() => {
    const total = summaries.length;
    const highRisk = summaries.filter((s) => isHighRisk(s.overall_risk_level)).length;
    const alertsOpen = summaries.reduce((acc, s) => acc + (s.high_risk_alerts || 0), 0);
    const reassessmentDue = summaries.filter((s) => s.reassessment_due).length;
    return { total, highRisk, alertsOpen, reassessmentDue };
  }, [summaries]);

  const cards = [
    { label: 'Assigned patients', value: stats.total, icon: Users, tone: 'slate' as const },
    { label: 'High / critical risk', value: stats.highRisk, icon: AlertTriangle, tone: 'orange' as const },
    { label: 'Open screening alerts', value: stats.alertsOpen, icon: Bell, tone: 'amber' as const },
    { label: 'Reassessment due', value: stats.reassessmentDue, icon: ClipboardList, tone: 'sky' as const },
  ];

  const toneIcon: Record<(typeof cards)[number]['tone'], string> = {
    slate: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80',
    orange: 'bg-orange-50 text-orange-800 ring-1 ring-orange-100',
    amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-100',
    sky: 'bg-sky-50 text-sky-900 ring-1 ring-sky-100',
  };

  return (
    <div className="clinician-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className={`${clinPanel} min-h-[96px] p-3 sm:p-4 flex gap-3 items-start transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 clinician-stat-card`}
        >
          <div className={`rounded-lg p-2 ${toneIcon[tone]}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClinicianStatsCards;
