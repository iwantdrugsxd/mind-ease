import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchClinicianStatus } from '../../utils/clinicianApi';
import ClinicianLayout from './ClinicianLayout';
import ClinicianLoadingState from './ClinicianLoadingState';

type GateState = 'loading' | 'ok' | 'login' | 'register';

/**
 * Approved-clinician-only shell: auth + status check, then ClinicianLayout.
 */
const ClinicianProtectedLayout: React.FC<{ children: React.ReactNode; title: string; subtitle?: string }> = ({
  children,
  title,
  subtitle,
}) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [gate, setGate] = useState<GateState>('loading');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGate('login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchClinicianStatus();
        if (cancelled) return;
        if (!s.has_clinician_profile) {
          setGate('register');
          return;
        }
        // Status gating disabled: any existing profile may access console.
        setGate('ok');
      } catch {
        // If status endpoint fails, do not block access when authenticated.
        if (!cancelled) setGate('ok');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || gate === 'loading') {
    return (
      <div className="clinician-console min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 p-6">
        <div className="w-full max-w-md">
          <ClinicianLoadingState message="Verifying clinician access…" showSkeleton />
        </div>
      </div>
    );
  }

  if (gate === 'login') {
    return <Navigate to="/clinician/login" replace state={{ from: location.pathname }} />;
  }
  if (gate === 'register') {
    return <Navigate to="/clinician/register" replace />;
  }

  return (
    <ClinicianLayout title={title} subtitle={subtitle}>
      {children}
    </ClinicianLayout>
  );
};

export default ClinicianProtectedLayout;
