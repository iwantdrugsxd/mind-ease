import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, ArrowRight, ClipboardList, Shield, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import ScreeningQuestionPanel from '../components/ScreeningQuestionPanel';
import PatientScorecard, { PatientScorecardPayload } from '../components/PatientScorecard';
import { phq9Questions, gad7Questions } from '../data/screeningQuestions';

type ScreeningResult = {
  testType: 'phq9' | 'gad7';
  totalScore: number;
  severity: string;
  riskLevel: string;
  requiresAttention: boolean;
  answers: Record<string, number>;
};

const Screening: React.FC = () => {
  const { user } = useAuth();
  const [currentTest, setCurrentTest] = useState<'phq9' | 'gad7' | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [landingScorecard, setLandingScorecard] = useState<PatientScorecardPayload | null>(null);
  const [postSubmitScorecard, setPostSubmitScorecard] = useState<PatientScorecardPayload | null>(null);

  const questions = currentTest === 'phq9' ? phq9Questions : gad7Questions;
  const testTitle = currentTest === 'phq9' ? 'PHQ-9' : 'GAD-7';

  useEffect(() => {
    if (!user || currentTest || result) return;
    let cancelled = false;
    (async () => {
      try {
        const sc = await api.get<PatientScorecardPayload>('/screening/scorecard/me/');
        if (!cancelled) setLandingScorecard(sc.data);
      } catch {
        if (!cancelled) setLandingScorecard(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currentTest, result]);

  const handleAnswer = (questionKey: string, value: number) => {
    setSubmitError(null);
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: value,
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitScreening();
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const submitScreening = async () => {
    setIsSubmitting(true);
    setPostSubmitScorecard(null);
    setSubmitError(null);
    try {
      try {
        try {
          await api.post('/screening/patients/', {});
        } catch {
          /* ignore */
        }

        const screeningData: any = { ...answers };
        let savedResult: any;

        if (currentTest === 'phq9') {
          savedResult = await api.post('/screening/phq9-screenings/', screeningData);
        } else {
          savedResult = await api.post('/screening/gad7-screenings/', screeningData);
        }

        setResult({
          testType: currentTest!,
          totalScore: Number(savedResult.data?.total_score ?? 0),
          severity: String(savedResult.data?.severity_level ?? 'unknown'),
          riskLevel: String(savedResult.data?.risk_level ?? 'unknown'),
          requiresAttention: Boolean(savedResult.data?.requires_immediate_attention),
          answers,
        });

        try {
          const sc = await api.get<PatientScorecardPayload>('/screening/scorecard/me/');
          setPostSubmitScorecard(sc.data);
        } catch {
          setPostSubmitScorecard(null);
        }
      } catch (apiError: any) {
        console.error('Error saving screening to backend:', apiError);
        setSubmitError(
          apiError?.message || 'We could not save your screening result. Please try again.'
        );
      }
    } catch (error) {
      console.error('Error submitting screening:', error);
      setSubmitError('We could not submit your screening. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetScreening = () => {
    setCurrentTest(null);
    setCurrentQuestion(0);
    setAnswers({});
    setResult(null);
    setPostSubmitScorecard(null);
    setSubmitError(null);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to access screening</h2>
          <p className="text-gray-600">You need to be logged in to complete mental health screenings.</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
          <div className="p-4 sm:p-6 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Screening complete</p>
                    <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                      {currentTest?.toUpperCase()} result
                    </h2>
                    <div
                      className={`mt-3 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${getRiskColor(
                        result.riskLevel
                      )}`}
                    >
                      {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} risk
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ResultStatCard label="Score" value={String(result.totalScore)} note={currentTest?.toUpperCase() || 'Assessment'} />
                  <ResultStatCard label="Severity" value={titleCase(result.severity)} note="Current level" />
                </div>

                {result.requiresAttention ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      <div>
                        <p className="text-sm font-semibold text-red-900">Professional support may help</p>
                        <p className="mt-1 text-sm text-red-800">
                          If you feel unsafe, contact local emergency services or crisis support immediately.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Next step</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {result.riskLevel === 'critical'
                    ? 'Review support options'
                    : result.riskLevel === 'high'
                    ? 'Continue with care'
                    : 'Keep momentum'}
                </h3>
                <div className="mt-4 space-y-3">
                  <Link
                    to="/selfcare"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-px"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-slate-500" />
                      Explore self-care
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    to="/care-team"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-px"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" />
                      Open Care Team
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <button
                    type="button"
                    onClick={resetScreening}
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-900"
                  >
                    Take another screening
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {postSubmitScorecard && (
          <PatientScorecard data={postSubmitScorecard} variant="compact" showSupportFooter={false} />
        )}
      </div>
    );
  }

  if (!currentTest) {
    return (
      <div className="space-y-6">
          {landingScorecard?.screening_status?.has_any_screening && (
            <div className="max-w-3xl">
              <PatientScorecard data={landingScorecard} variant="inline" showSupportFooter={false} />
            </div>
          )}

          {submitError && (
            <div className="max-w-3xl bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              {submitError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Depression
                </div>
                <h3 className="mt-4 text-xl sm:text-2xl font-bold text-slate-950 mb-3">PHQ-9</h3>
                <div className="mb-5 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold">9 questions</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold">3-5 min</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentTest('phq9')}
                  className="w-full bg-slate-950 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start PHQ-9
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Anxiety
                </div>
                <h3 className="mt-4 text-xl sm:text-2xl font-bold text-slate-950 mb-3">GAD-7</h3>
                <div className="mb-5 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold">7 questions</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold">2-3 min</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentTest('gad7')}
                  className="w-full bg-slate-950 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start GAD-7
                </button>
              </div>
            </div>
          </div>
      </div>
    );
  }

  const phq9SuicidalConcern =
    currentTest === 'phq9' &&
    currentQuestion === phq9Questions.length - 1 &&
    answers.q9_suicidal !== undefined &&
    answers.q9_suicidal >= 2;

  const priorElevatedRisk =
    landingScorecard?.overall_risk_level === 'high' || landingScorecard?.overall_risk_level === 'critical';

  return (
    <div className="space-y-4">
      {submitError && (
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {submitError}
        </div>
      )}
      {priorElevatedRisk && (
        <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Your saved results previously indicated elevated distress. Answer at your own pace—you can pause and return
          later. If you need immediate help, contact local emergency services or a crisis line.
        </div>
      )}
      <p className="max-w-3xl mx-auto mb-3 text-center text-xs text-slate-500">
        You can leave and come back anytime; your progress on this session is not saved until you submit.
      </p>
      {phq9SuicidalConcern && (
        <div className="max-w-3xl mx-auto rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          If you are thinking about hurting yourself or feel unsafe, please reach out now to local emergency services or
          a crisis helpline. This questionnaire is not monitored in real time.
        </div>
      )}
      <ScreeningQuestionPanel
        testTitle={testTitle}
        questions={questions}
        currentIndex={currentQuestion}
        answers={answers}
        onAnswer={handleAnswer}
        onPrevious={prevQuestion}
        onNext={nextQuestion}
        lastButtonLabel={isSubmitting ? 'Submitting...' : 'Submit'}
        isBusy={isSubmitting}
      />
    </div>
  );
};

export default Screening;

function ResultStatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
