import React from 'react';
import ClinicianSidebar from './ClinicianSidebar';
import ClinicianHeader from './ClinicianHeader';

interface ClinicianLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const ClinicianLayout: React.FC<ClinicianLayoutProps> = ({ children, title, subtitle }) => {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="clinician-console min-h-screen flex w-full bg-slate-200/40">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}
      <ClinicianSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 clinician-console-main">
        <ClinicianHeader
          title={title}
          subtitle={subtitle}
          mobileNavOpen={mobileNavOpen}
          onMenuToggle={() => setMobileNavOpen((open) => !open)}
        />
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="clinician-console-content max-w-[1600px] mx-auto w-full">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default ClinicianLayout;
