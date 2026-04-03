import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircle, X } from 'lucide-react';
import PatientSidebar from './PatientSidebar';
import { fetchPatientCareTeamSummary } from '../../utils/clinicianApi';
import { subscribeConsultationRefresh } from '../../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../../hooks/useAuthenticatedEventStream';

export default function PatientAppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const title = routeTitle(location.pathname);
  const [careBadgeCount, setCareBadgeCount] = React.useState(0);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const loadCareSummary = React.useCallback(async () => {
    try {
      const summary = await fetchPatientCareTeamSummary();
      setCareBadgeCount(Math.max(summary.unread_clinician_messages || 0, summary.unread_notifications || 0));
    } catch {
      setCareBadgeCount(0);
    }
  }, []);

  React.useEffect(() => {
    void loadCareSummary();
  }, [loadCareSummary]);

  React.useEffect(() => subscribeConsultationRefresh('patient', () => void loadCareSummary()), [loadCareSummary]);
  useRefreshOnWindowFocus(() => void loadCareSummary(), { debounceMs: 1000 });
  useIntervalWhenVisible(() => void loadCareSummary(), 55_000);
  useAuthenticatedEventStream('/clinician/patient/me/care-team-events/', {
    onUpdate: () => void loadCareSummary(),
  });

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}
      <PatientSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 lg:pl-0">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex lg:hidden items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm"
                aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <h1 className="truncate text-base sm:text-lg lg:text-xl font-semibold text-slate-900">{title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/care-team"
                className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
                {careBadgeCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[10px] font-bold text-white">
                    {careBadgeCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 animate-[fadeIn_200ms_ease-out]">
          {children}
        </div>
      </div>
    </div>
  );
}

function routeTitle(path: string): string {
  if (path.startsWith('/dashboard')) return 'Your dashboard';
  if (path.startsWith('/screening')) return 'Screening';
  if (path.startsWith('/selfcare') || path.startsWith('/self-care')) return 'Self-Care';
  if (path.startsWith('/chatbot')) return 'Support chatbot';
  return 'MindEase';
}
