import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Home, Menu, X } from 'lucide-react';

interface ClinicianHeaderProps {
  title: string;
  subtitle?: string;
  mobileNavOpen?: boolean;
  onMenuToggle?: () => void;
}

const ClinicianHeader: React.FC<ClinicianHeaderProps> = ({ title, subtitle, mobileNavOpen = false, onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/clinician/login');
    } catch {
      navigate('/clinician/login');
    }
  };

  return (
    <header className="h-[3.5rem] lg:h-[3.75rem] shrink-0 border-b border-slate-200/90 bg-white/90 backdrop-blur-lg flex items-stretch shadow-[inset_0_-1px_0_rgba(15,23,42,0.04)]">
      <div className="flex-1 flex items-center justify-between px-4 lg:px-8 gap-4 min-w-0">
        <div className="min-w-0 flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex lg:hidden items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="hidden sm:block h-8 w-1 rounded-full bg-gradient-to-b from-primary-500 to-slate-800 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h1>
            {subtitle ? (
              <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5 truncate font-medium">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
            title="Patient app home"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            Site home
          </Link>
          <span className="hidden md:inline max-w-[220px] truncate text-xs font-medium text-slate-500 px-2 py-1 rounded-md bg-slate-100/80 border border-slate-200/60">
            {user?.email || user?.name}
          </span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/15 hover:bg-slate-800 transition-all duration-200 hover:-translate-y-px active:translate-y-0"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default ClinicianHeader;
