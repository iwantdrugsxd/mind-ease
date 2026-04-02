import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { clinPanelAccentTop } from './clinicianUiClasses';

interface ClinicianAuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxW: Record<NonNullable<ClinicianAuthShellProps['maxWidth']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Shared frame for clinician login, registration, and status pages (internal app — not marketing landing).
 */
const ClinicianAuthShell: React.FC<ClinicianAuthShellProps> = ({
  children,
  title,
  subtitle,
  footer,
  maxWidth = 'md',
}) => {
  return (
    <div className="clinician-internal-auth clinician-app min-h-screen flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-cyan-50/35" aria-hidden />
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl clinician-auth-blob" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-slate-300/15 blur-3xl clinician-auth-blob-delay" aria-hidden />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent"
        aria-hidden
      />

      <div className={`relative flex-1 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 clinician-auth-enter`}>
        <div className={`${maxW[maxWidth]} mx-auto w-full`}>
          <div className="text-center mb-8">
            <Link
              to="/clinicians"
              className="inline-flex items-center gap-3 text-slate-800 hover:text-slate-950 transition-colors group"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/25 ring-1 ring-white/10 group-hover:scale-[1.02] transition-transform duration-300">
                <Stethoscope className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">MindEase</span>
                <span className="block text-lg font-bold text-slate-900 leading-tight tracking-tight">Clinician workspace</span>
              </span>
            </Link>
            <h1 className="mt-9 text-2xl sm:text-[1.75rem] font-bold text-slate-900 tracking-tight leading-snug">{title}</h1>
            {subtitle ? <div className="mt-3 text-sm text-slate-600 leading-relaxed max-w-md mx-auto">{subtitle}</div> : null}
            {footer ? <div className="mt-5">{footer}</div> : null}
          </div>

          <div className="clin-auth-card rounded-2xl border border-slate-200/70 bg-white/92 overflow-hidden shadow-[0_24px_56px_-24px_rgba(15,23,42,0.2)] backdrop-blur-md">
            <div className={clinPanelAccentTop} />
            <div className="p-6 sm:p-8">{children}</div>
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-500 leading-relaxed">
            <Link to="/" className="font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Patient app home
            </Link>
            <span className="mx-2 text-slate-300">·</span>
            <Link to="/clinicians" className="font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Provider overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicianAuthShell;
