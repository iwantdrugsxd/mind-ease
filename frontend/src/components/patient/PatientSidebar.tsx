import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, ClipboardList, Heart, MessageCircle, LogOut, Heart as Brand } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPatientCareTeamSummary, PatientCareTeamSummary } from '../../utils/clinicianApi';
import { subscribeConsultationRefresh } from '../../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../../hooks/useRefreshOnWindowFocus';
import { useIntervalWhenVisible } from '../../hooks/useIntervalWhenVisible';
import { useAuthenticatedEventStream } from '../../hooks/useAuthenticatedEventStream';

const navItemBase =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const navItemInactive = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
const navItemActive = 'bg-slate-900 text-white';

export default function PatientSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [careSummary, setCareSummary] = React.useState<PatientCareTeamSummary | null>(null);

  const loadCareSummary = React.useCallback(async () => {
    try {
      const s = await fetchPatientCareTeamSummary();
      setCareSummary(s);
    } catch {
      setCareSummary(null);
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

  const onLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch {
      // best-effort, AuthContext clears state even on failure
      navigate('/');
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${navItemBase} ${isActive ? navItemActive : navItemInactive}`;
  const careBadgeCount = Math.max(
    careSummary?.unread_clinician_messages || 0,
    careSummary?.unread_notifications || 0
  );
  const handleNav = () => onClose?.();

  return (
    <aside
      className={[
        'z-40 flex h-full flex-col border-r border-slate-200 bg-white/92 backdrop-blur-sm transition-transform duration-300 ease-out',
        'fixed inset-y-0 left-0 w-72 shadow-2xl lg:static lg:w-64 lg:translate-x-0 lg:shadow-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
    >
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-sm">
            <Brand className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">MindEase</div>
            {user?.name ? (
              <div className="text-[11px] text-slate-500 leading-tight truncate max-w-[9rem]">
                {user.name}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavLink to="/dashboard" className={linkClass} end onClick={handleNav}>
          <LayoutGrid className="h-4 w-4" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/screening" className={linkClass} onClick={handleNav}>
          <ClipboardList className="h-4 w-4" />
          <span>Screening</span>
        </NavLink>
        <NavLink to="/selfcare" className={linkClass} onClick={handleNav}>
          <Heart className="h-4 w-4" />
          <span>Self-Care</span>
        </NavLink>
        <NavLink to="/chatbot" className={linkClass} onClick={handleNav}>
          <MessageCircle className="h-4 w-4" />
          <span>Chat</span>
        </NavLink>
        <p className="px-3 text-[10px] text-slate-400 leading-snug -mt-1 mb-1">AI-guided support</p>
        <div className="relative">
          <NavLink to="/care-team" className={linkClass} onClick={handleNav}>
            <MessageCircle className="h-4 w-4" />
            <span>Care Team</span>
          </NavLink>
          {careSummary && careBadgeCount > 0 ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-bold">
              {careBadgeCount}
            </span>
          ) : null}
        </div>
      </nav>
      <div className="mt-auto p-3 border-t border-slate-200">
        <button
          onClick={() => void onLogout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
