import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  createClinicianDocumentJson,
  fetchClinicianStatus,
  getPostClinicianLoginPath,
  registerClinicianProfile,
} from '../utils/clinicianApi';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import ClinicianAuthShell from '../components/clinician/ClinicianAuthShell';
import { clinInput, clinLabel, clinBtnPrimary, clinBtnSecondary, clinPanelMuted } from '../components/clinician/clinicianUiClasses';

const TOTAL_STEPS = 5;

const STEP_LABELS = ['Account', 'Professional', 'Practice', 'Documents', 'Review'] as const;

const MODE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'video', label: 'Video' },
  { value: 'call', label: 'Phone call' },
  { value: 'chat', label: 'Chat' },
] as const;

/**
 * Multi-step clinician registration. Uses POST /clinician/auth/register/ + document endpoints.
 */
const ClinicianRegister: React.FC = () => {
  const { user, loading: authLoading, register: firebaseRegister } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountName, setAccountName] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [yearsExperience, setYearsExperience] = useState<string>('');
  const [organization, setOrganization] = useState('');
  const [bio, setBio] = useState('');

  const [maxPatientsPerDay, setMaxPatientsPerDay] = useState<string>('');
  const [modeEmail, setModeEmail] = useState(true);
  const [modeVideo, setModeVideo] = useState(false);
  const [modeCall, setModeCall] = useState(false);
  const [modeChat, setModeChat] = useState(false);

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseUrl, setLicenseUrl] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUrl, setIdUrl] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCheckingProfile(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchClinicianStatus();
        if (cancelled) return;
        if (s.has_clinician_profile) {
          navigate(getPostClinicianLoginPath(s), { replace: true });
          return;
        }
      } catch {
        /* allow form */
      } finally {
        if (!cancelled) setCheckingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.name && !firstName && !lastName) {
      const parts = user.name.trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
  }, [user, firstName, lastName]);

  const communicationModes = useMemo(() => {
    const m: string[] = [];
    if (modeEmail) m.push('email');
    if (modeVideo) m.push('video');
    if (modeCall) m.push('call');
    if (modeChat) m.push('chat');
    return m;
  }, [modeEmail, modeVideo, modeCall, modeChat]);

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!user) {
        if (!email.trim()) return 'Email is required.';
        if (password.length < 6) return 'Password must be at least 6 characters.';
        if (!accountName.trim()) return 'Full name is required.';
        return null;
      }
      return null;
    }
    if (s === 2) {
      if (!phone.trim()) return 'Phone number is required.';
      if (!licenseNumber.trim()) return 'License number is required.';
      if (!specialization.trim()) return 'Specialization is required.';
      return null;
    }
    if (s === 3) {
      if (communicationModes.length === 0) return 'Select at least one communication mode.';
      return null;
    }
    if (s === 4) {
      const licOk = licenseFile || licenseUrl.trim();
      const idOk = idFile || idUrl.trim();
      if (!licOk && !idOk) {
        return null;
      }
      if (!licOk) return 'Provide a license certificate file or URL (or skip both document pairs).';
      if (!idOk) return 'Provide an ID proof file or URL (or clear license fields to skip documents).';
      return null;
    }
    return null;
  };

  const goNext = async () => {
    setError('');
    const v = validateStep(step);
    if (v) {
      setError(v);
      return;
    }
    if (step === 1 && !user) {
      setSubmitting(true);
      try {
        await firebaseRegister(email, password, accountName);
        setStep(2);
      } catch (e: any) {
        setError(e?.message || 'Could not create account.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep((x) => Math.min(TOTAL_STEPS, x + 1));
  };

  const goBack = () => {
    setError('');
    setStep((x) => Math.max(1, x - 1));
  };

  const handleFinalSubmit = async () => {
    setError('');
    const v4 = validateStep(4);
    const v3 = validateStep(3);
    const v2 = validateStep(2);
    if (v4) {
      setError(v4);
      setStep(4);
      return;
    }
    if (v3) {
      setError(v3);
      setStep(3);
      return;
    }
    if (v2) {
      setError(v2);
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      const yoe = yearsExperience.trim() === '' ? null : parseInt(yearsExperience, 10);
      const maxPd = maxPatientsPerDay.trim() === '' ? null : parseInt(maxPatientsPerDay, 10);

      await registerClinicianProfile({
        license_number: licenseNumber.trim(),
        specialization: specialization.trim(),
        phone_number: phone.trim(),
        qualification: qualification.trim() || undefined,
        years_of_experience: Number.isNaN(yoe as number) ? null : yoe,
        organization: organization.trim() || undefined,
        max_patients_per_day: Number.isNaN(maxPd as number) ? null : maxPd,
        communication_modes: communicationModes,
        bio: bio.trim() || undefined,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });

      const licOk = licenseFile || licenseUrl.trim();
      const idOk = idFile || idUrl.trim();
      let documentUploadError: string | undefined;
      if (licOk && idOk) {
        try {
          await createClinicianDocumentJson({
            document_type: 'license_certificate',
            file: licenseFile || undefined,
            file_url: licenseUrl.trim() || undefined,
          });
          await createClinicianDocumentJson({
            document_type: 'id_proof',
            file: idFile || undefined,
            file_url: idUrl.trim() || undefined,
          });
        } catch (docErr: any) {
          documentUploadError =
            typeof docErr?.message === 'string'
              ? docErr.message
              : 'Documents could not be uploaded. Your clinician profile was still created.';
        }
      }

      const authStatus = await fetchClinicianStatus();
      navigate(getPostClinicianLoginPath(authStatus), {
        replace: true,
        state: documentUploadError ? { documentUploadError } : undefined,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.license_number?.[0] ||
        e?.message ||
        'Registration failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || checkingProfile) {
    return (
      <div className="clinician-app min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="h-9 w-9 rounded-full border-2 border-slate-200 border-t-primary-600 animate-spin" aria-hidden />
      </div>
    );
  }

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <ClinicianAuthShell
      maxWidth="lg"
      title="Clinician application"
      subtitle="Professional details for your clinician profile. This flow is separate from patient registration."
      footer={
        <p className="text-sm text-slate-600">
          Already submitted?{' '}
          <Link to="/clinician/login" className="font-semibold text-primary-700 hover:text-primary-800">
            Clinician sign in
          </Link>
        </p>
      }
    >
      <div className="mb-8">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          <span>
            Step {step} of {TOTAL_STEPS}
          </span>
          <span>{Math.round(progressPct)}% complete</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden ring-1 ring-slate-200/80">
          <div
            className="h-full bg-gradient-to-r from-slate-800 to-primary-700 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 justify-between">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div
                key={label}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : done
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-400 bg-slate-50'
                }`}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : <span className="tabular-nums w-4 text-center">{n}</span>}
                <span className="hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900 font-medium">
          {error}
        </div>
      ) : null}

      {step === 1 && (
        <div className={`${clinPanelMuted} p-5 sm:p-6 space-y-4 clinician-auth-enter`}>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Identity & account</h2>
          {!user ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Create credentials used only for clinician tools. This account is not linked to patient sign-in.
              </p>
              <div>
                <label className={clinLabel}>Full name</label>
                <input className={clinInput} required value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </div>
              <div>
                <label className={clinLabel}>Email</label>
                <input className={clinInput} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className={clinLabel}>Password</label>
                <input
                  className={clinInput}
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Signed in as <span className="font-semibold text-slate-900">{user.email}</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={clinLabel}>First name</label>
                  <input className={clinInput} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className={clinLabel}>Last name</label>
                  <input className={clinInput} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className={`${clinPanelMuted} p-5 sm:p-6 space-y-4 clinician-auth-enter`}>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Professional credentials</h2>
          <div>
            <label className={clinLabel}>Professional phone</label>
            <input className={clinInput} required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={clinLabel}>License number</label>
            <input className={clinInput} required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <label className={clinLabel}>Specialization</label>
            <input className={clinInput} required value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
          </div>
          <div>
            <label className={clinLabel}>Qualification / credentials</label>
            <input className={clinInput} value={qualification} onChange={(e) => setQualification(e.target.value)} />
          </div>
          <div>
            <label className={clinLabel}>Years of experience</label>
            <input
              className={clinInput}
              type="number"
              min={0}
              max={80}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
            />
          </div>
          <div>
            <label className={clinLabel}>Organization / practice (optional)</label>
            <input className={clinInput} value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
          <div>
            <label className={clinLabel}>Professional bio (optional)</label>
            <textarea className={`${clinInput} min-h-[100px] resize-y`} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={`${clinPanelMuted} p-5 sm:p-6 space-y-4 clinician-auth-enter`}>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Practice preferences</h2>
          <div>
            <label className={clinLabel}>Max patients per day (optional)</label>
            <input
              className={clinInput}
              type="number"
              min={1}
              max={500}
              value={maxPatientsPerDay}
              onChange={(e) => setMaxPatientsPerDay(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className={clinLabel}>Communication modes</legend>
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              {MODE_OPTIONS.map((opt, idx) => {
                const checked = [modeEmail, modeVideo, modeCall, modeChat][idx];
                const setters = [setModeEmail, setModeVideo, setModeCall, setModeChat];
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer py-1 rounded-lg hover:bg-white/80 px-2 -mx-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      checked={checked}
                      onChange={(e) => setters[idx](e.target.checked)}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}

      {step === 4 && (
        <div className={`${clinPanelMuted} p-5 sm:p-6 space-y-5 clinician-auth-enter`}>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Verification documents</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Upload license certificate and government ID, or provide secure links. Both must be complete if you start
            either—or skip both if your program accepts later submission.
          </p>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">License certificate</h3>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
              onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
            />
            <p className={clinLabel}>Or URL</p>
            <input className={clinInput} placeholder="https://…" value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} />
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">ID proof</h3>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
            <p className={clinLabel}>Or URL</p>
            <input className={clinInput} placeholder="https://…" value={idUrl} onChange={(e) => setIdUrl(e.target.value)} />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className={`${clinPanelMuted} p-5 sm:p-6 space-y-4 clinician-auth-enter`}>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Review & submit</h2>
          <ul className="text-sm text-slate-700 space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <li>
              License <span className="font-semibold text-slate-900">{licenseNumber}</span> — {specialization}
            </li>
            <li>Phone {phone || '—'}</li>
            <li>Communication: {communicationModes.join(', ') || '—'}</li>
            <li>
              Documents: {licenseFile || licenseUrl ? 'License provided' : 'License skipped'};{' '}
              {idFile || idUrl ? 'ID provided' : 'ID skipped'}
            </li>
          </ul>
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 leading-relaxed">
            After submitting, you’ll be taken directly to the clinician dashboard. You can update details or add documents later.
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-between gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || submitting}
          className={`${clinBtnSecondary} disabled:opacity-40 disabled:hover:translate-y-0`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => void goNext()}
            disabled={submitting}
            className={`${clinBtnPrimary} disabled:opacity-50`}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleFinalSubmit()}
            disabled={submitting}
            className={`${clinBtnPrimary} disabled:opacity-50`}
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        )}
      </div>
    </ClinicianAuthShell>
  );
};

export default ClinicianRegister;
