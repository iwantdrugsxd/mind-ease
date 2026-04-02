import React from 'react';
import { clinPanel, clinPanelAccentTop } from './clinicianUiClasses';

interface ClinicianLoadingStateProps {
  message: string;
  /** Show subtle skeleton bars */
  showSkeleton?: boolean;
}

const ClinicianLoadingState: React.FC<ClinicianLoadingStateProps> = ({ message, showSkeleton }) => {
  return (
    <div className={`${clinPanel} overflow-hidden`}>
      <div className={clinPanelAccentTop} />
      <div className="p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div
            className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin mb-5"
            aria-hidden
          />
          <p className="text-sm font-semibold text-slate-800">{message}</p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">Secured clinician session</p>
        </div>
        {showSkeleton ? (
          <div className="mt-8 space-y-3 max-w-md mx-auto w-full clinician-skeleton-pulse" aria-hidden>
            <div className="h-2.5 rounded-full bg-slate-200/80 w-full" />
            <div className="h-2.5 rounded-full bg-slate-200/60 w-4/5 mx-auto" />
            <div className="h-2.5 rounded-full bg-slate-200/50 w-3/5 mx-auto" />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ClinicianLoadingState;
