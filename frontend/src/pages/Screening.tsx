import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
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
      <div className="space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)]">
            <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
            <div className="p-4 sm:p-6 md:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Screening complete</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-950 mb-3 sm:mb-4">
                  {currentTest?.toUpperCase()} Screening Results
                </h2>
                <div
                  className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${getRiskColor(
                    result.riskLevel
                  )}`}
                >
                  {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Risk
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-slate-950 mb-2">{result.totalScore}</div>
                  <div className="text-base sm:text-lg text-slate-600">
                    Total Score (Severity: {result.severity.replace('_', ' ')})
                  </div>
                </div>

                {result.requiresAttention && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-medium text-red-800">Attention Required</h3>
                        <p className="text-xs sm:text-sm text-red-700 mt-1">
                          Your screening results indicate that you may benefit from professional support. Please consider
                          reaching out to a mental health professional or your healthcare provider.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-slate-900 mb-2">Recommendations</h3>
                  <ul className="text-xs sm:text-sm text-slate-700 space-y-1">
                    {result.riskLevel === 'critical' && <li>• Consider immediate professional help or crisis intervention</li>}
                    {result.riskLevel === 'high' && <li>• Schedule an appointment with a mental health professional</li>}
                    {result.riskLevel === 'medium' && <li>• Consider self-care strategies and regular monitoring</li>}
                    <li>• Continue regular mental health check-ins</li>
                    <li>• Practice stress management techniques</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={resetScreening}
                    className="flex-1 bg-slate-950 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors touch-manipulation text-sm sm:text-base"
                  >
                    Take Another Screening
                  </button>
                  <button
                    type="button"
                    onClick={() => (window.location.href = '/selfcare')}
                    className="flex-1 bg-slate-100 text-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors touch-manipulation text-sm sm:text-base"
                  >
                    Explore Self-Care
                  </button>
                </div>
              </div>
            </div>
          </div>

          {postSubmitScorecard && (
            <PatientScorecard data={postSubmitScorecard} variant="compact" showSupportFooter />
          )}
        </div>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Depression screening
                </div>
                <h3 className="mt-4 text-xl sm:text-2xl font-bold text-slate-950 mb-3 sm:mb-4">PHQ-9</h3>
                <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 leading-relaxed">
                  A 9-question screening tool for depression. Takes about 3-5 minutes to complete.
                </p>
                <ul className="mb-6 space-y-2 text-sm text-slate-600">
                  <li>• Tracks mood, energy, and day-to-day functioning</li>
                  <li>• Helpful for regular check-ins over time</li>
                  <li>• Can trigger more personalized support if needed</li>
                </ul>
                <button
                  type="button"
                  onClick={() => setCurrentTest('phq9')}
                  className="w-full bg-slate-950 text-white px-6 sm:px-8 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start PHQ-9 Screening
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Anxiety screening
                </div>
                <h3 className="mt-4 text-xl sm:text-2xl font-bold text-slate-950 mb-3 sm:mb-4">GAD-7</h3>
                <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 leading-relaxed">
                  A 7-question screening tool for anxiety disorders. Takes about 2-3 minutes to complete.
                </p>
                <ul className="mb-6 space-y-2 text-sm text-slate-600">
                  <li>• Reviews worry, restlessness, and physical tension</li>
                  <li>• Useful for tracking anxiety severity over time</li>
                  <li>• Helps tailor follow-up guidance inside the app</li>
                </ul>
                <button
                  type="button"
                  onClick={() => setCurrentTest('gad7')}
                  className="w-full bg-slate-950 text-white px-6 sm:px-8 py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start GAD-7 Screening
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
