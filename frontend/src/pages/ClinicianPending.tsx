import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchClinicianProfile, fetchClinicianStatus } from '../utils/clinicianApi';
import type { ClinicianAuthStatus, ClinicianProfile } from '../utils/clinicianApi';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Shield } from 'lucide-react';
import ClinicianAuthShell from '../components/clinician/ClinicianAuthShell';
import { clinBtnPrimary, clinBtnSecondary, clinPanelMuted } from '../components/clinician/clinicianUiClasses';

/** Backend sets `is_approved` true for both pending and approved; use explicit status for this page. */
function isClinicianApproved(s: ClinicianAuthStatus): boolean {
  return (s.status || '').toLowerCase() === 'approved';
}

/**
 * Clinician approval gate: pending / rejected messaging; redirects when approved or no profile.
 */
const ClinicianPending: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ClinicianAuthStatus | null>(null);
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const s = await fetchClinicianStatus();
        if (cancelled) return;
        setStatus(s);
        if (s.has_clinician_profile && s.status === 'rejected') {
          try {
            const p = await fetchClinicianProfile();
            if (!cancelled) setProfile(p);
          } catch {
            /* optional */
          }
        } else {
          setProfile(null);
        }
      } catch {
        if (!cancelled) {
          setErr('We could not load your clinician status. Please try again shortly.');
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || (user && loading && !err)) {
    return (
      <div className="clinician-app min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-9 w-9 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin text-slate-600" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/clinician/login" replace state={{ from: '/clinician/pending' }} />;
  }

  if (err && !status) {
    return (
      <ClinicianAuthShell title="Connection issue" subtitle="We could not confirm your clinician status." maxWidth="sm">
        <div className="text-center space-y-4">
          <p className="text-sm text-red-800 font-medium">{err}</p>
          <button type="button" onClick={() => navigate(0)} className={`${clinBtnPrimary} w-full justify-center`}>
            Retry
          </button>
        </div>
      </ClinicianAuthShell>
    );
  }

  if (status && !status.has_clinician_profile) {
    return <Navigate to="/clinician/register" replace />;
  }

  if (status?.has_clinician_profile && isClinicianApproved(status)) {
    return <Navigate to="/clinician/dashboard" replace />;
  }

  if (status?.status === 'rejected') {
    return (
      <ClinicianAuthShell
        title="Application not approved"
        subtitle="Your clinician registration was not approved at this time. This decision is recorded securely."
        maxWidth="md"
      >
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-900">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
            Status: Not approved
          </span>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 flex gap-3">
          <AlertCircle className="h-6 w-6 text-rose-700 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-rose-950 leading-relaxed">
            <p>
              If you believe this is an error, contact your program administrator with your license number on file. You may
              sign out and return later if your status changes.
            </p>
            {profile?.review_notes ? (
              <div className="mt-4 rounded-lg border border-rose-200/80 bg-white/80 p-3 text-slate-800">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Reviewer note</span>
                <p className="mt-1">{profile.review_notes}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/clinician/login" className={`${clinBtnSecondary} flex-1 justify-center`}>
            Sign in again
          </Link>
          <Link to="/" className={`${clinBtnPrimary} flex-1 justify-center`}>
            Home
          </Link>
        </div>
      </ClinicianAuthShell>
    );
  }

  /* Under review — profile exists, not rejected, not yet approved */
  return (
    <ClinicianAuthShell
      title="Application under review"
      subtitle={
        <>
          Your credentials are in the verification queue. Typical turnaround depends on your organization—MindEase will not
          grant full operational flags until an administrator completes review.
          <span className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
            <span>Assignment-scoped access still follows platform policy and patient consent.</span>
          </span>
        </>
      }
      maxWidth="md"
    >
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-950">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Status: In review
        </span>
      </div>

      <div className={`${clinPanelMuted} p-5 space-y-4 text-left`}>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">What happens next</p>
        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong className="text-slate-900">Submission received</strong> — your profile and any documents are attached
              to this account.
            </span>
          </li>
          <li className="flex gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong className="text-slate-900">Administrator review</strong> — license and program fit are verified out of
              band.
            </span>
          </li>
          <li className="flex gap-3">
            <Shield className="h-5 w-5 text-primary-600 shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong className="text-slate-900">Approval unlocks</strong> — the clinical console reflects your approved
              scope and assignments.
            </span>
          </li>
        </ol>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          to="/clinician/dashboard"
          className={`${clinBtnPrimary} flex-1 justify-center gap-2`}
        >
          Open workspace
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link to="/clinician/login" className={`${clinBtnSecondary} flex-1 justify-center`}>
          Back to sign in
        </Link>
      </div>
      <p className="mt-5 text-center text-[11px] text-slate-500 leading-relaxed">
        If your program already marked you approved, refresh status by opening the workspace or signing in again.
      </p>
    </ClinicianAuthShell>
  );
};

export default ClinicianPending;
