import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchClinicianStatus, getPostClinicianLoginPath } from '../utils/clinicianApi';
import { Eye, EyeOff, Shield } from 'lucide-react';
import ClinicianAuthShell from '../components/clinician/ClinicianAuthShell';
import { clinInput, clinLabel, clinBtnPrimary, clinBtnSecondary, clinPanelMuted } from '../components/clinician/clinicianUiClasses';

/**
 * Clinician sign-in (Firebase). Separate from patient `/login`.
 */
const ClinicianLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign in';
      setError(typeof msg === 'string' ? msg : 'Failed to sign in');
      setLoading(false);
      return;
    }
    try {
      const status = await fetchClinicianStatus();
      navigate(getPostClinicianLoginPath(status, { from }), { replace: true });
    } catch {
      setError('You are signed in, but clinician status could not be loaded. Try again or open the pending page.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClinicianAuthShell
      title="Sign in to clinician workspace"
      subtitle={
        <>
          For verified care providers. Access is assignment-scoped.
          <span className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
            <span>Patients use a separate sign-in.</span>
          </span>
        </>
      }
      footer={
        <p className="text-sm text-slate-600">
          New to MindEase as a provider?{' '}
          <Link to="/clinician/register" className="font-semibold text-primary-700 hover:text-primary-800 transition-colors">
            Submit an application
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900 font-medium">
            {error}
          </div>
        ) : null}
        <div>
          <label htmlFor="clin-email" className={clinLabel}>
            Work email
          </label>
          <input
            id="clin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={clinInput}
          />
        </div>
        <div>
          <label htmlFor="clin-password" className={clinLabel}>
            Password
          </label>
          <div className="relative">
            <input
              id="clin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${clinInput} pr-11`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className={`${clinPanelMuted} px-4 py-3 text-xs text-slate-600 leading-relaxed border-slate-200/80`}>
          If you haven’t completed clinician registration yet, you’ll be guided to apply. Once a profile exists,
          the clinician console is available immediately.
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <Link to="/login" className={`${clinBtnSecondary} w-full sm:w-auto justify-center`}>
            Patient sign in
          </Link>
          <button type="submit" disabled={loading} className={`${clinBtnPrimary} w-full sm:w-auto`}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </ClinicianAuthShell>
  );
};

export default ClinicianLogin;
