import React from 'react';
import { clinPanel, clinPanelAccentTop } from './clinicianUiClasses';

interface ClinicianEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const ClinicianEmptyState: React.FC<ClinicianEmptyStateProps> = ({ title, description, icon, action }) => {
  return (
    <div className={`${clinPanel} overflow-hidden text-center`}>
      <div className={clinPanelAccentTop} />
      <div className="p-10 sm:p-12">
        {icon ? (
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-slate-600 ring-1 ring-slate-200/80 shadow-sm">
            {icon}
          </div>
        ) : null}
        <p className="text-base font-bold text-slate-900 tracking-tight">{title}</p>
        {description ? (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-md mx-auto font-medium">{description}</p>
        ) : null}
        {action ? <div className="mt-7 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
};

export default ClinicianEmptyState;
