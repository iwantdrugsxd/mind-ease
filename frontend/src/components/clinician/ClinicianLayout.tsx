import React from 'react';
import ClinicianSidebar from './ClinicianSidebar';
import ClinicianHeader from './ClinicianHeader';
import ClinicianMobileNav from './ClinicianMobileNav';
import { fetchClinicianConsultationSummary } from '../../utils/clinicianApi';
import { subscribeConsultationRefresh } from '../../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../../hooks/useAuthenticatedEventStream';

interface ClinicianLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const ClinicianLayout: React.FC<ClinicianLayoutProps> = ({ children, title, subtitle }) => {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<{ actionable: number; unread: number }>({
    actionable: 0,
    unread: 0,
  });

  const loadSummary = React.useCallback(async () => {
    try {
      const data = await fetchClinicianConsultationSummary();
      setSummary({
        actionable: data.total_actionable_cases || 0,
        unread: data.unread_patient_replies || 0,
      });
    } catch {
      setSummary({ actionable: 0, unread: 0 });
    }
  }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  React.useEffect(() => subscribeConsultationRefresh('clinician', () => void loadSummary()), [loadSummary]);
  useRefreshOnWindowFocus(() => void loadSummary(), { debounceMs: 1000 });
  useIntervalWhenVisible(() => void loadSummary(), 50_000);
  useAuthenticatedEventStream('/clinician/me/consultation-events/', {
    onUpdate: () => void loadSummary(),
  });

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
        <div className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          <div className="clinician-console-content max-w-[1600px] mx-auto w-full">{children}</div>
        </div>
      </div>
      <ClinicianMobileNav actionableCount={summary.actionable} unreadCount={summary.unread} />
    </div>
  );
};

export default ClinicianLayout;
