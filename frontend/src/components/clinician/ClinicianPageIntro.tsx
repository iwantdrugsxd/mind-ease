import React from 'react';
import { clinEyebrow, clinSectionDesc, clinSectionTitle } from './clinicianUiClasses';

interface ClinicianPageIntroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-aligned actions (filters, buttons) */
  actions?: React.ReactNode;
}

/**
 * Consistent in-page title block below the global clinician header.
 */
const ClinicianPageIntro: React.FC<ClinicianPageIntroProps> = ({ eyebrow, title, description, actions }) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-1 clinician-internal-intro">
      <div className="min-w-0">
        {eyebrow ? <p className={clinEyebrow}>{eyebrow}</p> : null}
        <h2 className={`${clinSectionTitle} ${eyebrow ? 'mt-2' : ''}`}>{title}</h2>
        {description ? <p className={clinSectionDesc}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end">{actions}</div> : null}
    </div>
  );
};

export default ClinicianPageIntro;
