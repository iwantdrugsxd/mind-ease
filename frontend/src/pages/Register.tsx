import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { getAuth } from 'firebase/auth';
import ScreeningQuestionPanel from '../components/ScreeningQuestionPanel';
import { gad7Questions, phq9Questions } from '../data/screeningQuestions';

type StepKey = 'account' | 'profile' | 'baseline' | 'consent' | 'assessment' | 'advanced' | 'complete';

const steps: StepKey[] = ['account', 'profile', 'baseline', 'consent', 'assessment', 'advanced', 'complete'];

const Register: React.FC = () => {
  const { register: registerAccount, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<StepKey>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Onboarding assessment: choice screen, then PHQ-9 → GAD-7 wizard (same UX as /screening). */
  const [assessmentFlow, setAssessmentFlow] = useState<'choose' | 'phq9' | 'gad7'>('choose');
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const assessmentAnswersRef = useRef<Record<string, number>>({});
  const prevStepRef = useRef<StepKey | null>(null);

  useEffect(() => {
    assessmentAnswersRef.current = assessmentAnswers;
  }, [assessmentAnswers]);

  // Draft state persisted to survive refresh
  const [draft, setDraft] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('onboarding_draft');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem('onboarding_draft', JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    if (currentStep === 'assessment' && prevStepRef.current !== 'assessment') {
      setAssessmentFlow('choose');
      setAssessmentQuestionIndex(0);
      setAssessmentAnswers({});
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  const waitForAuthToken = useCallback(async () => {
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(true);
        if (token) {
          localStorage.setItem('authToken', token);
        }
      }
    } catch {
      // Request interceptor also fetches live token; this just reduces first-call race further.
    }
  }, []);

  const fetchOnboardingSummaryWithBootstrapRetry = useCallback(async (): Promise<any> => {
    await waitForAuthToken();
    try {
      return await api.get('/screening/onboarding/me/');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await waitForAuthToken();
        return await api.get('/screening/onboarding/me/');
      }
      throw err;
    }
  }, [waitForAuthToken]);

  useEffect(() => {
    // If user is already authenticated, bootstrap summary to resume state
    const bootstrap = async () => {
      if (!user) return;
      try {
        const res = await fetchOnboardingSummaryWithBootstrapRetry();
        const summary: any = res.data;
        setDraft((d: any) => ({ ...d, summary }));
        // Compute next step based on status flags
        const s = summary?.status || {};
        if (!s.account_step_completed) setCurrentStep('account');
        else if (!s.profile_step_completed) setCurrentStep('profile');
        else if (!s.baseline_step_completed) setCurrentStep('baseline');
        else if (!s.consent_step_completed) setCurrentStep('consent');
        else if (!s.assessment_completed) setCurrentStep('assessment');
        else if (!s.onboarding_completed_at && !s.advanced_step_completed) setCurrentStep('advanced');
        else setCurrentStep('complete');
      } catch (e) {
        // ignore
      }
    };
    bootstrap();
  }, [user, fetchOnboardingSummaryWithBootstrapRetry]);

  const goNext = (key?: StepKey) => {
    if (key) { setCurrentStep(key); return; }
    const idx = steps.indexOf(currentStep);
    setCurrentStep(steps[Math.min(idx + 1, steps.length - 1)]);
  };
  const goBack = () => {
    const idx = steps.indexOf(currentStep);
    setCurrentStep(steps[Math.max(idx - 1, 0)]);
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { email, password, name } = draft.account || {};
      const confirmPassword = draft.account?.confirmPassword;
      if (!email || !password || !name || !confirmPassword) {
        setError('Please fill name, email, password, and confirm password');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      await registerAccount(email, password, name);
      // After auth, backend summary call will mark account step complete
      await fetchOnboardingSummaryWithBootstrapRetry();
      goNext('profile');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('Account created, but secure session bootstrap took too long. Please try once more.');
      } else {
        setError(err?.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = draft.profile || {};
      const res = await api.patch('/screening/onboarding/profile/', payload);
      setDraft((d: any) => ({ ...d, summary: res.data }));
      goNext('baseline');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const saveBaseline = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = draft.baseline || {};
      const res = await api.patch('/screening/onboarding/baseline/', payload);
      setDraft((d: any) => ({ ...d, summary: res.data }));
      goNext('consent');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save baseline');
    } finally {
      setLoading(false);
    }
  };

  const saveConsent = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = draft.consent || {};
      if (!payload.data_usage_consent_given || !payload.emergency_disclaimer_acknowledged) {
        setError('Please provide required consents');
        setLoading(false);
        return;
      }
      const res = await api.patch('/screening/onboarding/consent/', payload);
      setDraft((d: any) => ({ ...d, summary: res.data }));
      goNext('assessment');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save consent');
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentChoice = async (choice: 'yes' | 'no') => {
    setLoading(true);
    setError(null);
    try {
      const offered = choice === 'yes';
      await api.post('/screening/onboarding/assessment/offer/', { offered });
      if (choice === 'no') {
        goNext('advanced');
      } else {
        setAssessmentFlow('phq9');
        setAssessmentQuestionIndex(0);
        setAssessmentAnswers({});
      }
    } catch (err: any) {
      setError('Failed to record assessment choice');
    } finally {
      setLoading(false);
    }
  };

  const assessmentAnswer = (key: string, value: number) => {
    setAssessmentAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const assessmentWizardNext = () => {
    if (assessmentFlow === 'phq9') {
      if (assessmentQuestionIndex < phq9Questions.length - 1) {
        setAssessmentQuestionIndex(assessmentQuestionIndex + 1);
      } else {
        setAssessmentFlow('gad7');
        setAssessmentQuestionIndex(0);
      }
      return;
    }
    if (assessmentFlow === 'gad7') {
      if (assessmentQuestionIndex < gad7Questions.length - 1) {
        setAssessmentQuestionIndex(assessmentQuestionIndex + 1);
      } else {
        const a = assessmentAnswersRef.current;
        const phqAnswers = phq9Questions.map((q) => a[q.key] ?? 0);
        const gadAnswers = gad7Questions.map((q) => a[q.key] ?? 0);
        void submitAssessments(phqAnswers, gadAnswers);
      }
    }
  };

  const assessmentWizardPrev = () => {
    if (assessmentFlow === 'phq9') {
      if (assessmentQuestionIndex > 0) {
        setAssessmentQuestionIndex(assessmentQuestionIndex - 1);
      } else {
        setAssessmentFlow('choose');
      }
      return;
    }
    if (assessmentFlow === 'gad7') {
      if (assessmentQuestionIndex > 0) {
        setAssessmentQuestionIndex(assessmentQuestionIndex - 1);
      } else {
        setAssessmentFlow('phq9');
        setAssessmentQuestionIndex(phq9Questions.length - 1);
      }
    }
  };

  const submitAssessments = async (phqAnswers: number[], gadAnswers: number[]) => {
    setLoading(true);
    setError(null);
    try {
      const phqBody = {
        q1_interest: phqAnswers[0], q2_depressed: phqAnswers[1], q3_sleep: phqAnswers[2],
        q4_energy: phqAnswers[3], q5_appetite: phqAnswers[4], q6_self_esteem: phqAnswers[5],
        q7_concentration: phqAnswers[6], q8_psychomotor: phqAnswers[7], q9_suicidal: phqAnswers[8],
      };
      await api.post('/screening/onboarding/assessment/phq9/', phqBody);
      const gadBody = {
        q1_nervous: gadAnswers[0], q2_worry: gadAnswers[1], q3_worry_control: gadAnswers[2],
        q4_trouble_relaxing: gadAnswers[3], q5_restless: gadAnswers[4], q6_irritable: gadAnswers[5], q7_afraid: gadAnswers[6],
      };
      const res = await api.post('/screening/onboarding/assessment/gad7/', gadBody);
      setDraft((d: any) => ({ ...d, summary: res.data, assessment_choice: 'yes' }));
      goNext('advanced');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit assessment');
    } finally {
      setLoading(false);
    }
  };

  const saveAdvanced = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = draft.advanced || {};
      const res = await api.patch('/screening/onboarding/advanced/', {
        preferred_time_of_day: payload.preferred_time_of_day || 'unspecified',
        emergency_contact: payload.emergency_contact || '',
        emergency_phone: payload.emergency_phone || '',
      });
      setDraft((d: any) => ({ ...d, summary: res.data }));
      await api.post('/screening/onboarding/complete/', {});
      try { localStorage.removeItem('onboarding_draft'); } catch {}
      goNext('complete');
    } catch (err: any) {
      setError('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const StepHeader = ({ title }: { title: string }) => (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <div className="mt-2 text-sm text-gray-500">Step {steps.indexOf(currentStep) + 1} of {steps.length}</div>
    </div>
  );

  const showAssessmentWizard = currentStep === 'assessment' && (assessmentFlow === 'phq9' || assessmentFlow === 'gad7');
  const showAssessmentChoice = currentStep === 'assessment' && assessmentFlow === 'choose';

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 px-2 sm:px-4">
      {showAssessmentChoice ? (
        <>
          {error && (
            <div className="max-w-4xl mx-auto mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <div className="mb-2 text-sm text-gray-500">Step {steps.indexOf(currentStep) + 1} of {steps.length}</div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
                Optional quick check
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
                Same questionnaires as the Screening page: PHQ-9 for depression and GAD-7 for anxiety. Together they take
                about 5–8 minutes. You can skip and complete them later from Screening.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-2 mb-8">
              <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow">
                <div className="text-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">PHQ-9</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                    Nine questions on mood and interest. You will answer using the same scale as Screening (how often over
                    the last 2 weeks).
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow">
                <div className="text-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">GAD-7</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                    Seven questions on worry and anxiety, right after PHQ-9, with the same response options.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2 mb-6">
              <button
                type="button"
                onClick={() => handleAssessmentChoice('yes')}
                disabled={loading}
                className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors touch-manipulation disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? '…' : 'Yes, begin questionnaires'}
              </button>
              <button
                type="button"
                onClick={() => handleAssessmentChoice('no')}
                disabled={loading}
                className="w-full sm:w-auto bg-gray-200 text-gray-800 px-6 sm:px-8 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors touch-manipulation disabled:opacity-50 text-sm sm:text-base"
              >
                Skip for now
              </button>
            </div>
            <div className="text-center">
              <button type="button" onClick={goBack} className="text-sm text-gray-600 hover:text-gray-800">
                ← Back to consent
              </button>
            </div>
          </div>
        </>
      ) : showAssessmentWizard ? (
        <>
          {error && (
            <div className="max-w-3xl mx-auto mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
          <ScreeningQuestionPanel
            testTitle={assessmentFlow === 'phq9' ? 'PHQ-9' : 'GAD-7'}
            questions={assessmentFlow === 'phq9' ? phq9Questions : gad7Questions}
            currentIndex={assessmentQuestionIndex}
            answers={assessmentAnswers}
            onAnswer={assessmentAnswer}
            onPrevious={assessmentWizardPrev}
            onNext={assessmentWizardNext}
            lastButtonLabel={assessmentFlow === 'gad7' ? 'Submit' : 'Next'}
          />
          {loading && (
            <p className="text-center text-sm text-gray-500 mt-2">Saving your responses…</p>
          )}
        </>
      ) : (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-4 sm:p-6">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {currentStep === 'account' && (
          <>
            <StepHeader title="Create your account" />
            <form onSubmit={handleAccountSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="register-name">
                  Name
                </label>
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="w-full border rounded px-3 py-2"
                  value={draft.account?.name || ''}
                  onChange={(e) => setDraft((d: any) => ({ ...d, account: { ...(d.account || {}), name: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="register-email">
                  Email
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="w-full border rounded px-3 py-2"
                  value={draft.account?.email || ''}
                  onChange={(e) => setDraft((d: any) => ({ ...d, account: { ...(d.account || {}), email: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="register-password">
                  Password
                </label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full border rounded px-3 py-2"
                  value={draft.account?.password || ''}
                  onChange={(e) => setDraft((d: any) => ({ ...d, account: { ...(d.account || {}), password: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1" htmlFor="register-confirm-password">
                  Confirm password
                </label>
                <input
                  id="register-confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full border rounded px-3 py-2"
                  value={draft.account?.confirmPassword || ''}
                  onChange={(e) => setDraft((d: any) => ({ ...d, account: { ...(d.account || {}), confirmPassword: e.target.value } }))}
                />
              </div>
              <div className="text-xs text-gray-500">
                Phone/OTP and Google sign-in are not yet available in this build.
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="submit" disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded">
                  {loading ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </form>
          </>
        )}

        {currentStep === 'profile' && (
          <>
            <StepHeader title="Tell us about you" />
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Preferred name</label>
                <input className="w-full border rounded px-3 py-2"
                  value={draft.profile?.preferred_name || ''}
                  onChange={(e) => setDraft((d: any) => ({ ...d, profile: { ...(d.profile || {}), preferred_name: e.target.value } }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Birth year</label>
                  <input type="number" className="w-full border rounded px-3 py-2"
                    value={draft.profile?.birth_year || ''}
                    onChange={(e) => setDraft((d: any) => ({ ...d, profile: { ...(d.profile || {}), birth_year: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Gender (optional)</label>
                  <select className="w-full border rounded px-3 py-2"
                    value={draft.profile?.gender || 'unspecified'}
                    onChange={(e) => setDraft((d: any) => ({ ...d, profile: { ...(d.profile || {}), gender: e.target.value } }))}
                  >
                    <option value="unspecified">Unspecified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="prefer_not_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Occupation (optional)</label>
                  <input className="w-full border rounded px-3 py-2"
                    value={draft.profile?.occupation || ''}
                    onChange={(e) => setDraft((d: any) => ({ ...d, profile: { ...(d.profile || {}), occupation: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">City (optional)</label>
                  <input className="w-full border rounded px-3 py-2"
                    value={draft.profile?.city || ''}
                    onChange={(e) => setDraft((d: any) => ({ ...d, profile: { ...(d.profile || {}), city: e.target.value } }))}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={goBack} className="px-4 py-2 border rounded">Back</button>
                <button onClick={saveProfile} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded">
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          </>
        )}

        {currentStep === 'baseline' && (
          <>
            <StepHeader title="Your current baseline" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['mood_baseline','sleep_quality_baseline','stress_level_baseline'].map((k) => (
                <div key={k}>
                  <label className="block text-sm text-gray-700 mb-1">{k.replace('_',' ').replace('baseline','').trim()}</label>
                  <select className="w-full border rounded px-3 py-2"
                    value={draft.baseline?.[k] || 3}
                    onChange={(e) => setDraft((d: any) => ({ ...d, baseline: { ...(d.baseline || {}), [k]: Number(e.target.value) } }))}
                  >
                    <option value={1}>Very Low (1)</option>
                    <option value={2}>Low (2)</option>
                    <option value={3}>Moderate (3)</option>
                    <option value={4}>High (4)</option>
                    <option value={5}>Very High (5)</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-700 mb-1">Main concerns (comma-separated)</label>
              <input className="w-full border rounded px-3 py-2"
                value={draft.baseline?.main_concerns_text || ''}
                onChange={(e) => setDraft((d: any) => ({ ...d, baseline: { ...(d.baseline || {}), main_concerns_text: e.target.value, main_concerns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } }))}
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm text-gray-700 mb-1">Goals (comma-separated, optional)</label>
              <input className="w-full border rounded px-3 py-2"
                value={draft.baseline?.goals_text || ''}
                onChange={(e) => setDraft((d: any) => ({ ...d, baseline: { ...(d.baseline || {}), goals_text: e.target.value, goals: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } }))}
              />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={goBack} className="px-4 py-2 border rounded">Back</button>
              <button onClick={saveBaseline} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded">
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </>
        )}

        {currentStep === 'consent' && (
          <>
            <StepHeader title="Consent and privacy" />
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox"
                  checked={!!draft.consent?.data_usage_consent_given}
                  onChange={(e) => setDraft((d: any) => ({ ...d, consent: { ...(d.consent || {}), data_usage_consent_given: e.target.checked, consent_version: 'v1' } }))}
                />
                <span>I consent to data usage as described.</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox"
                  checked={!!draft.consent?.emergency_disclaimer_acknowledged}
                  onChange={(e) => setDraft((d: any) => ({ ...d, consent: { ...(d.consent || {}), emergency_disclaimer_acknowledged: e.target.checked } }))}
                />
                <span>I understand this app is not a replacement for professional care.</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox"
                  checked={!!draft.consent?.clinician_access_opt_in}
                  onChange={(e) => setDraft((d: any) => ({ ...d, consent: { ...(d.consent || {}), clinician_access_opt_in: e.target.checked } }))}
                />
                <span>Optional: Allow clinician access to my data.</span>
              </label>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={goBack} className="px-4 py-2 border rounded">Back</button>
              <button onClick={saveConsent} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded">
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </>
        )}

        {currentStep === 'advanced' && (
          <>
            <StepHeader title="A few optional details" />
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Preferred time of day</label>
                <select className="w-full border rounded px-3 py-2"
                  value={draft.advanced?.preferred_time_of_day || 'unspecified'}
                  onChange={(e) => setDraft((d: any) => ({ ...d, advanced: { ...(d.advanced || {}), preferred_time_of_day: e.target.value } }))}
                >
                  <option value="unspecified">Unspecified</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Emergency contact (optional)</label>
                  <input className="w-full border rounded px-3 py-2"
                    value={draft.advanced?.emergency_contact || ''}
                    onChange={(e) => setDraft((d: any) => ({ ...d, advanced: { ...(d.advanced || {}), emergency_contact: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Emergency phone (optional)</label>
                  <input className="w-full border rounded px-3 py-2"
                    value={draft.advanced?.emergency_phone || ''}
                    onChange={(e) => setDraft((d: any) => ({ ...d, advanced: { ...(d.advanced || {}), emergency_phone: e.target.value } }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={goBack} className="px-4 py-2 border rounded">Back</button>
              <button onClick={saveAdvanced} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded">
                {loading ? 'Saving...' : 'Save & Finish'}
              </button>
            </div>
          </>
        )}

        {currentStep === 'complete' && (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
            <p className="text-gray-600 mb-6">Your onboarding is complete. You can now access your dashboard.</p>
            <a href="/dashboard" className="px-4 py-2 bg-primary-600 text-white rounded inline-block">Go to Dashboard</a>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default Register;
