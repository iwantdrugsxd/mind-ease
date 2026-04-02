import React from 'react';

const styles: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200/90 ring-1 ring-rose-100',
  high: 'bg-orange-50 text-orange-950 border-orange-200/90 ring-1 ring-orange-100',
  medium: 'bg-amber-50 text-amber-950 border-amber-200/90 ring-1 ring-amber-100',
  low: 'bg-emerald-50 text-emerald-900 border-emerald-200/90 ring-1 ring-emerald-100',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200/90',
};

export const ClinicianRiskBadge: React.FC<{ level: string; className?: string }> = ({ level, className = '' }) => {
  const key = (level || 'unknown').toLowerCase();
  const cls = styles[key] || styles.unknown;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide border capitalize shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${cls} ${className}`}
    >
      {key}
    </span>
  );
};

export default ClinicianRiskBadge;
