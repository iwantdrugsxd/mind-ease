import React from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export interface PatientScorecardPayload {
  scorecard_version?: number;
  overall_risk_level?: string;
  last_screening_at?: string | null;
  latest_phq9?: {
    score: number;
    severity_label?: string;
    severity_code?: string;
    risk_level?: string;
    created_at?: string;
  } | null;
  latest_gad7?: {
    score: number;
    severity_label?: string;
    severity_code?: string;
    risk_level?: string;
    created_at?: string;
  } | null;
  screening_status?: {
    screening_count?: number;
    has_any_screening?: boolean;
    most_recent_instrument?: string | null;
    days_since_last_screening?: number | null;
  };
  trend_summary?: {
    direction?: string;
    has_enough_data?: boolean;
    delta_phq9?: number | null;
    delta_gad7?: number | null;
    phq9_trend_direction?: string | null;
    gad7_trend_direction?: string | null;
  };
  reassessment_summary?: {
    reassessment_due?: boolean;
    reassessment_recommended_soon?: boolean;
    reassessment_priority?: string;
    days_since_last_assessment?: number | null;
    reason?: string;
    urgency_tier?: string;
  };
  next_best_action?: {
    action_type?: string;
    title?: string;
    description?: string;
    target_route?: string;
    urgency?: string;
    reason?: string;
  };
  engagement_summary?: {
    has_started_selfcare?: boolean;
    has_recent_mood_tracking?: boolean;
    engagement_level?: string;
    completed_exercises?: number;
    recent_activity_count?: number;
    streak_days?: number;
  };
  flags?: {
    requires_attention?: boolean;
    high_risk_no_followup?: boolean;
    is_drifting?: boolean;
    candidate_for_clinician_review?: boolean;
    clinician_followup_recommended?: boolean;
  };
  mood_summary?: {
    trend_direction?: string;
    has_enough_data?: boolean;
  };
  continuity_summary?: {
    engagement_decay?: boolean;
    selfcare_reentry_suggested?: boolean;
    mood_declining?: boolean;
  };
}

type Variant = 'dashboard' | 'compact' | 'inline';

interface PatientScorecardProps {
  data: PatientScorecardPayload | null;
  variant?: Variant;
  showSupportFooter?: boolean;
}

function riskStyles(risk: string) {
  switch (risk) {
    case 'critical':
      return {
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        accent: 'from-rose-600 via-rose-500 to-orange-400',
        panel: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white',
        progress: 'bg-rose-500',
      };
    case 'high':
      return {
        badge: 'border-orange-200 bg-orange-50 text-orange-700',
        accent: 'from-orange-500 via-amber-400 to-yellow-300',
        panel: 'border-orange-100 bg-gradient-to-br from-orange-50 to-white',
        progress: 'bg-orange-500',
      };
    case 'medium':
      return {
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        accent: 'from-amber-500 via-yellow-400 to-lime-300',
        panel: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white',
        progress: 'bg-amber-500',
      };
    case 'low':
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        accent: 'from-emerald-500 via-teal-400 to-cyan-300',
        panel: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',
        progress: 'bg-emerald-500',
      };
    default:
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-600',
        accent: 'from-slate-500 via-slate-400 to-slate-300',
        panel: 'border-slate-100 bg-gradient-to-br from-slate-50 to-white',
        progress: 'bg-slate-400',
      };
  }
}

function TrendIcon({ direction }: { direction?: string | null }) {
  if (direction === 'improving') return <TrendingDown className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (direction === 'worsening') return <TrendingUp className="h-4 w-4 text-amber-600" aria-hidden />;
  return <Minus className="h-4 w-4 text-slate-400" aria-hidden />;
}

function titleize(value?: string | null) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

function relativeScreeningTime(days?: number | null) {
  if (days == null) return 'No screening saved yet';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function scoreBarPercent(score?: number | null, max = 27) {
  if (score == null) return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}

const PatientScorecard: React.FC<PatientScorecardProps> = ({
  data,
  variant = 'dashboard',
  showSupportFooter = true,
}) => {
  if (!data) return null;

  const risk = data.overall_risk_level || 'unknown';
  const styles = riskStyles(risk);
  const compact = variant !== 'dashboard';
  const screening = data.screening_status;
  const trend = data.trend_summary;
  const reassessment = data.reassessment_summary;
  const nextBest = data.next_best_action;
  const engagement = data.engagement_summary;
  const flags = data.flags;

  const phqScore = data.latest_phq9?.score ?? null;
  const gadScore = data.latest_gad7?.score ?? null;
  const primaryMetric = data.latest_phq9 ? 'PHQ-9' : data.latest_gad7 ? 'GAD-7' : 'No screening';
  const primaryScore = data.latest_phq9?.score ?? data.latest_gad7?.score ?? 0;
  const primarySeverity =
    data.latest_phq9?.severity_label ||
    data.latest_gad7?.severity_label ||
    'No saved result yet';

  return (
    <section
      className={
        compact
          ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
          : 'overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_18px_40px_-28px_rgba(15,23,42,0.24)]'
      }
      aria-label="Mental health scorecard"
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${styles.accent}`} />
      <div className={compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6 lg:p-7'}>
        <div className={`grid gap-4 ${compact ? 'lg:grid-cols-[1.15fr_0.85fr]' : 'xl:grid-cols-[1.2fr_0.8fr]'}`}>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${styles.panel}`}>
                <ClipboardList className="h-6 w-6 text-slate-700" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Mental health snapshot</p>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                    Overall: {titleize(risk)}
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {screening?.has_any_screening ? `${primaryMetric} indicates ${primarySeverity.toLowerCase()}` : 'No screening history yet'}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  This is a live summary of your latest questionnaires, trend signals, and follow-up timing. It is designed to help you understand what changed and what to do next.
                </p>
              </div>
            </div>

            <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
              <SignalCard
                label="Primary score"
                value={screening?.has_any_screening ? String(primaryScore) : '—'}
                note={primaryMetric}
                emphasis={styles.panel}
              />
              <SignalCard
                label="Last screening"
                value={relativeScreeningTime(screening?.days_since_last_screening)}
                note={screening?.most_recent_instrument ? screening.most_recent_instrument.toUpperCase() : 'Assessment recency'}
              />
              <SignalCard
                label="Trend"
                value={trend?.has_enough_data ? titleize(trend?.direction) : 'Not enough data'}
                note={
                  trend?.has_enough_data
                    ? `PHQ ${trend?.delta_phq9 ?? '—'} · GAD ${trend?.delta_gad7 ?? '—'}`
                    : 'Complete another screening to unlock trend'
                }
              />
              <SignalCard
                label="Reassessment"
                value={
                  reassessment?.reassessment_due
                    ? 'Due now'
                    : reassessment?.reassessment_recommended_soon
                    ? 'Soon'
                    : 'Not due'
                }
                note={titleize(reassessment?.urgency_tier || 'not_due')}
              />
            </div>

            <div className={`grid gap-4 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.1fr_0.9fr]'}`}>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Latest screening results</p>
                    <h4 className="mt-1 text-lg font-bold text-slate-950">Instrument scores</h4>
                  </div>
                  <div className="text-xs text-slate-500">
                    {screening?.screening_count ? `${screening.screening_count} total check-ins` : 'New'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ScoreLane
                    instrument="PHQ-9"
                    score={phqScore}
                    maxScore={27}
                    severity={data.latest_phq9?.severity_label}
                    riskLevel={data.latest_phq9?.risk_level}
                    percent={scoreBarPercent(phqScore, 27)}
                  />
                  <ScoreLane
                    instrument="GAD-7"
                    score={gadScore}
                    maxScore={21}
                    severity={data.latest_gad7?.severity_label}
                    riskLevel={data.latest_gad7?.risk_level}
                    percent={scoreBarPercent(gadScore, 21)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" aria-hidden />
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Trajectory</p>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <div className="rounded-full bg-slate-100 p-2">
                    <TrendIcon direction={trend?.direction} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-950">
                      {trend?.has_enough_data ? titleize(trend?.direction) : 'Trend not available yet'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {trend?.has_enough_data
                        ? 'Your latest saved questionnaires are being compared against prior results to estimate direction over time.'
                        : 'You need at least two saved screenings to unlock visual trend tracking.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <MiniStatus
                    label="Mood tracking"
                    value={
                      data.mood_summary?.has_enough_data
                        ? titleize(data.mood_summary.trend_direction)
                        : 'Not enough data'
                    }
                  />
                  <MiniStatus
                    label="Engagement"
                    value={titleize(engagement?.engagement_level || 'unknown')}
                  />
                  <MiniStatus
                    label="Self-care continuity"
                    value={flags?.is_drifting ? 'Needs re-entry' : 'Stable'}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-[24px] border p-5 ${styles.panel}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Suggested next step</p>
              <h4 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {nextBest?.title || 'Continue checking in'}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {nextBest?.description || 'Your results are available. Use them to guide your next support action in the app.'}
              </p>

              <div className="mt-4 space-y-3">
                <ActionSignal
                  label="Risk"
                  value={titleize(risk)}
                  tone={styles.badge}
                />
                <ActionSignal
                  label="Reassessment priority"
                  value={titleize(reassessment?.reassessment_priority || 'none')}
                  tone="border-slate-200 bg-white text-slate-700"
                />
                <ActionSignal
                  label="Clinician follow-up"
                  value={flags?.clinician_followup_recommended ? 'Recommended' : 'Not flagged'}
                  tone={
                    flags?.clinician_followup_recommended
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }
                />
              </div>

              {nextBest?.target_route && (
                <a
                  href={nextBest.target_route}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-500" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Follow-up status</p>
              </div>
              <div className="mt-3 space-y-3">
                <TimelineRow
                  title="Last saved questionnaire"
                  body={relativeScreeningTime(screening?.days_since_last_screening)}
                />
                <TimelineRow
                  title="Next reassessment"
                  body={
                    reassessment?.reassessment_due
                      ? 'Recommended now'
                      : reassessment?.reassessment_recommended_soon
                      ? 'Recommended soon'
                      : 'No immediate reassessment pressure'
                  }
                />
                <TimelineRow
                  title="Support readiness"
                  body={
                    flags?.high_risk_no_followup
                      ? 'Extra support may help right now'
                      : flags?.candidate_for_clinician_review
                      ? 'Clinician review candidate'
                      : 'No urgent operational signal'
                  }
                />
              </div>
            </div>

            {showSupportFooter && (flags?.requires_attention || flags?.high_risk_no_followup) ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden />
                  <p className="text-sm leading-relaxed text-amber-900">
                    If you feel unsafe or in crisis, contact local emergency services or a crisis line immediately. This app supports follow-up, but it does not replace emergency care.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

function SignalCard({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 px-4 py-4 ${emphasis || 'bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function ScoreLane({
  instrument,
  score,
  maxScore,
  severity,
  riskLevel,
  percent,
}: {
  instrument: string;
  score?: number | null;
  maxScore: number;
  severity?: string;
  riskLevel?: string;
  percent: number;
}) {
  const risk = riskLevel || 'unknown';
  const styles = riskStyles(risk);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{instrument}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{score ?? '—'}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.badge}`}>
          {severity || 'No result'}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>0</span>
          <span>{maxScore}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${styles.progress}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {score != null ? `${percent}% of the ${instrument} scale` : 'Complete this screening to see the result here.'}
      </p>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function ActionSignal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${tone}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function TimelineRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-900">{body}</p>
    </div>
  );
}

export default PatientScorecard;
