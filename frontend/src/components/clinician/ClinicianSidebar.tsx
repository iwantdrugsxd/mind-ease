import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Bell, Calendar, FileText, Stethoscope, ExternalLink, ClipboardList, MessageCircle, GitBranchPlus } from 'lucide-react';
import { fetchClinicianConsultationSummary, ClinicianConsultationSummary } from '../../utils/clinicianApi';
import { subscribeConsultationRefresh } from '../../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../../hooks/useAuthenticatedEventStream';

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; end?: boolean }> = ({
  to,
  icon,
  label,
  end,
}) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `group flex items-center gap-3 pl-2.5 pr-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-l-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        isActive
          ? 'border-l-primary-500 bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'border-l-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
      }`
    }
  >
    <span className="shrink-0 opacity-90 group-hover:opacity-100 transition-opacity duration-200">{icon}</span>
    {label}
  </NavLink>
);

const ClinicianSidebar: React.FC = () => {
  const [summary, setSummary] = React.useState<ClinicianConsultationSummary | null>(null);

  const loadSummary = React.useCallback(async () => {
    try {
      const s = await fetchClinicianConsultationSummary();
      setSummary(s);
    } catch {
      setSummary(null);
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
    <aside className="w-56 lg:w-60 shrink-0 bg-slate-950 text-slate-100 min-h-screen flex flex-col border-r border-slate-800/90 shadow-[6px_0_32px_-8px_rgba(0,0,0,0.35)]">
      <div className="p-4 border-b border-slate-800/90">
        <Link
          to="/clinicians"
          className="flex items-center gap-3 rounded-xl p-2 -m-1 hover:bg-white/[0.06] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-950/40">
            <Stethoscope className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="text-sm font-bold text-white leading-tight tracking-tight">MindEase</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Console</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Clinician navigation">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Workspace</p>
        <NavItem to="/clinician/dashboard" end icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
        <div className="relative">
          <NavItem to="/clinician/consultations" icon={<ClipboardList className="h-4 w-4" />} label="Consultations" />
          {summary && (summary.total_actionable_cases > 0) ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-500 text-white text-[10px] font-bold">
              {summary.total_actionable_cases}
            </span>
          ) : null}
        </div>
        <div className="relative">
          <NavItem to="/clinician/messages" icon={<MessageCircle className="h-4 w-4" />} label="Messages" />
          {summary && summary.unread_patient_replies > 0 ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-500 text-white text-[10px] font-bold">
              {summary.unread_patient_replies}
            </span>
          ) : null}
        </div>
        <NavItem to="/clinician/patients" icon={<Users className="h-4 w-4" />} label="Patients" />
        <NavItem to="/clinician/alerts" icon={<Bell className="h-4 w-4" />} label="Alerts" />
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Operations</p>
        <NavItem to="/clinician/assignments" icon={<GitBranchPlus className="h-4 w-4" />} label="Assignments" />
        <NavItem to="/clinician/appointments" icon={<Calendar className="h-4 w-4" />} label="Appointments" />
        <NavItem to="/clinician/notes" icon={<FileText className="h-4 w-4" />} label="Notes" />
      </nav>
      <div className="p-3 border-t border-slate-800/90 space-y-2">
        <Link
          to="/clinicians"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Provider overview
        </Link>
        <p className="px-3 text-[10px] text-slate-600 leading-relaxed border-t border-slate-800/80 pt-2">
          Assignment-scoped · HIPAA-minded workflows
        </p>
      </div>
    </aside>
  );
};

export default ClinicianSidebar;
