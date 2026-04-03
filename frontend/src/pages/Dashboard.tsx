import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Activity,
  User,
  ArrowRight,
  Shield,
  HeartHandshake,
  SmilePlus,
} from 'lucide-react';
import api from '../utils/api';
import { fetchPatientCareTeamSummary } from '../utils/clinicianApi';
import { subscribeConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useAuthenticatedEventStream } from '../hooks/useAuthenticatedEventStream';

interface DashboardStats {
  totalScreenings: number;
  highRiskAlerts: number;
  completedExercises: number;
  moodTrend: number;
  lastScreening: string;
  riskLevel: string;
  moodTrendDirection?: string;
}

interface OrchestrationState {
  patient?: {
    id: number;
    firebase_uid: string;
    email: string;
    first_name: string;
    last_name: string;
    created_at: string;
    updated_at: string;
    emergency_contact?: string;
    emergency_phone?: string;
  };
  onboarding_complete: boolean;
  resume_step: string;
  next_route: string;
  onboarding?: any;
  latest_assessment?: {
    has_assessment: boolean;
    risk_level: string | null;
    severity_level: string | null;
    total_score: number | null;
    created_at: string | null;
  };
  recommendation?: {
    next_action: string;
    message: string;
    emphasize_professional_support: boolean;
    clinician_priority: boolean;
    pathway_hint: string;
    emphasize_consistency?: boolean;
    emphasize_reassessment?: boolean;
  };
  activity?: {
    last_activity_at?: string | null;
    days_since_last_activity?: number | null;
    recent_activity_count?: number;
    weekly_activity_count?: number;
    engagement_level?: string;
    streak_days?: number;
    no_recent_activity?: boolean;
    is_drifting?: boolean;
    has_started_selfcare?: boolean;
    has_recent_mood_tracking?: boolean;
  };
  mood_trend?: {
    has_enough_data: boolean;
    trend_direction: string;
    trend_score: number;
    recent_avg_mood: number | null;
    prior_avg_mood: number | null;
    entry_count_30d: number;
  };
  consent?: { clinician_access_opt_in?: boolean };
  next_actions?: {
    suggested_next_screening_at?: string | null;
    take_screening_now?: boolean;
    open_selfcare_now?: boolean;
  };
  reassessment?: {
    reassessment_due?: boolean;
    reassessment_recommended_soon?: boolean;
    reassessment_priority?: string;
    days_since_last_assessment?: number | null;
    recommended_reassessment_type?: string;
    reason?: string;
  };
  next_best_action?: {
    action_type?: string;
    title?: string;
    description?: string;
    target_route?: string;
    urgency?: string;
    reason?: string;
  };
  readiness?: {
    candidate_for_guided_plan?: boolean;
    candidate_for_clinician_review?: boolean;
    high_engagement_user?: boolean;
    high_risk_no_followup?: boolean;
    needs_reengagement?: boolean;
  };
  recent_activity?: Array<{ type: string; label: string; timestamp: string | null }>;
  dashboard_stats?: {
    total_screenings: number;
    high_risk_alerts: number;
    completed_exercises: number;
    last_screening: string | null;
    risk_level: string;
    mood_trend_score?: number;
    mood_trend_direction?: string;
  };
  lifestyle_insights?: {
    version?: number;
    top_signal?: {
      key: string;
      title: string;
      severity: string;
      summary: string;
      recommendation: string;
    } | null;
    signals?: Array<{
      key: string;
      title: string;
      severity: string;
      summary: string;
      recommendation: string;
    }>;
    recommendation_hints?: {
      prefer_short_form?: boolean;
      prefer_sleep_support?: boolean;
      prefer_mood_tracking?: boolean;
      prefer_low_friction_selfcare?: boolean;
    };
    supportive_copy?: string;
  };
}

interface PatientCard {
  id: number;
  firebase_uid: string;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

const panel =
  'rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm';
const panelMuted = 'rounded-2xl border border-slate-200/80 bg-slate-50/90 shadow-sm';
const sectionLabel = 'text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500';
const textMuted = 'text-sm text-slate-600';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalScreenings: 0,
    highRiskAlerts: 0,
    completedExercises: 0,
    moodTrend: 0,
    lastScreening: '',
    riskLevel: 'low',
    moodTrendDirection: 'unknown',
  });
  const [patientCard, setPatientCard] = useState<PatientCard | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationState | null>(null);
  const [careTeamSummary, setCareTeamSummary] = useState<{
    activeCount: number;
    unreadCount: number;
    replyRequestedCount: number;
    scheduledFollowups: number;
    unreadNotifications: number;
    latestNotificationTitle: string;
  }>({
    activeCount: 0,
    unreadCount: 0,
    replyRequestedCount: 0,
    scheduledFollowups: 0,
    unreadNotifications: 0,
    latestNotificationTitle: '',
  });
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodNotes, setMoodNotes] = useState('');
  const [moodSaving, setMoodSaving] = useState(false);
  const [moodFeedback, setMoodFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const refreshCareTeamSummary = useCallback(async () => {
    try {
      const summary = await fetchPatientCareTeamSummary();
      setCareTeamSummary({
        activeCount: summary.active_conversations,
        unreadCount: summary.unread_clinician_messages,
        replyRequestedCount: summary.reply_requested_count,
        scheduledFollowups: summary.scheduled_followups,
        unreadNotifications: summary.unread_notifications,
        latestNotificationTitle: summary.latest_notification_title,
      });
    } catch {
      setCareTeamSummary({
        activeCount: 0,
        unreadCount: 0,
        replyRequestedCount: 0,
        scheduledFollowups: 0,
        unreadNotifications: 0,
        latestNotificationTitle: '',
      });
    }
  }, []);

  useEffect(() => {
    return subscribeConsultationRefresh('patient', () => void refreshCareTeamSummary());
  }, [refreshCareTeamSummary]);

  useRefreshOnWindowFocus(() => void refreshCareTeamSummary(), { debounceMs: 1200 });
  useAuthenticatedEventStream('/clinician/patient/me/care-team-events/', {
    onUpdate: () => void refreshCareTeamSummary(),
  });

  const loadDashboardData = useCallback(async () => {
    try {
      let stateData: OrchestrationState | null = null;
      try {
        const stateRes = await api.get<OrchestrationState>('/screening/onboarding/state/');
        stateData = stateRes.data;
        setOrchestration(stateData);
        if (stateData?.patient) {
          setPatientCard({
            id: stateData.patient.id,
            firebase_uid: stateData.patient.firebase_uid,
            created_at: stateData.patient.created_at,
            updated_at: stateData.patient.updated_at,
            user: {
              email: stateData.patient.email,
              first_name: stateData.patient.first_name,
              last_name: stateData.patient.last_name,
            },
          });
        }
      } catch {
        setOrchestration(null);
      }
      await refreshCareTeamSummary();
      const ds = (stateData as any)?.dashboard_stats;
      const risk = stateData?.latest_assessment?.risk_level || ds?.risk_level || 'low';
      setStats({
        totalScreenings: Number(ds?.total_screenings || 0),
        highRiskAlerts: Number(ds?.high_risk_alerts || 0),
        completedExercises: Number(ds?.completed_exercises || 0),
        moodTrend: Math.round(Number(ds?.mood_trend_score || 0) * 20),
        lastScreening: ds?.last_screening ? new Date(ds.last_screening).toLocaleDateString() : '',
        riskLevel: risk,
        moodTrendDirection: String(ds?.mood_trend_direction || 'unknown'),
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshCareTeamSummary]);

  useEffect(() => {
    void loadDashboardData();
  }, [user, loadDashboardData]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Please log in to access dashboard</h2>
          <p className="text-slate-600">You need to be logged in to view your personal dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto" />
          <p className="mt-4 text-slate-600">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const displayName =
    patientCard?.user?.first_name?.trim() ||
    user.name ||
    'there';
  const careAttention =
    careTeamSummary.unreadCount +
    careTeamSummary.replyRequestedCount +
    careTeamSummary.unreadNotifications;
  const primaryActionHref = orchestration?.next_best_action?.target_route || '/screening';
  const primaryActionLabel = orchestration?.next_best_action?.title || 'Take a screening';
  const reassessmentState = orchestration?.reassessment?.reassessment_due
    ? 'Due now'
    : orchestration?.reassessment?.reassessment_recommended_soon
      ? 'Recommended soon'
      : 'On track';
  const engagementState = capitalize(orchestration?.activity?.engagement_level || 'low');
  const lastActiveLabel = orchestration?.activity?.last_activity_at
    ? new Date(orchestration.activity.last_activity_at).toLocaleDateString()
    : 'No recent activity';
  const nextScreeningLabel = orchestration?.next_actions?.suggested_next_screening_at
    ? new Date(orchestration.next_actions.suggested_next_screening_at).toLocaleDateString()
    : 'Recommended now';
  const careStatusLabel =
    careAttention > 0
      ? `${careAttention} item${careAttention === 1 ? '' : 's'} need attention`
      : 'No pending outreach';
  const recentTimeline = orchestration?.recent_activity || [];
  const currentMoodLabel =
    orchestration?.mood_trend?.recent_avg_mood != null
      ? `${orchestration.mood_trend.recent_avg_mood.toFixed(1)}/5 recent average`
      : 'No mood check saved recently';
  const topLifestyleSignal = orchestration?.lifestyle_insights?.top_signal;

  const submitMoodCheck = async () => {
    if (selectedMood == null) {
      setMoodFeedback({ tone: 'error', message: 'Choose how you are feeling before saving today’s check-in.' });
      return;
    }
    setMoodSaving(true);
    setMoodFeedback(null);
    try {
      await api.post('/selfcare/mood-entries/', {
        mood_level: selectedMood,
        notes: moodNotes,
        energy_level: 3,
        sleep_quality: 3,
        stress_level: selectedMood <= 2 ? 4 : selectedMood >= 4 ? 2 : 3,
      });
      setMoodFeedback({ tone: 'success', message: 'Mood check saved. Your recommendations and continuity signals are updating.' });
      setMoodNotes('');
      setSelectedMood(null);
      await loadDashboardData();
    } catch (error: any) {
      setMoodFeedback({
        tone: 'error',
        message:
          error?.response?.data?.error ||
          error?.response?.data?.detail ||
          error?.message ||
          'Could not save your mood check right now.',
      });
    } finally {
      setMoodSaving(false);
    }
  };

  return (
    <div className="space-y-5 lg:space-y-7">
      <section className={`${panel} overflow-hidden`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20 ring-1 ring-slate-800/10">
                  <User className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className={sectionLabel}>Patient Workspace</p>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                    Welcome back, {displayName}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill label={`Risk: ${labelForRisk(stats.riskLevel)}`} tone={riskTone(stats.riskLevel)} />
                    <StatusPill label={`Engagement: ${engagementState}`} tone="neutral" />
                    <StatusPill
                      label={careTeamSummary.activeCount > 0 ? 'Care team active' : 'Care team quiet'}
                      tone={careAttention > 0 ? 'primary' : 'neutral'}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Risk"
                  value={labelForRisk(stats.riskLevel)}
                  caption={orchestration?.latest_assessment?.severity_level?.replace(/_/g, ' ') || 'Assessment-driven'}
                  tone={riskTone(stats.riskLevel)}
                  icon={<Shield className="h-4 w-4" />}
                />
                <MetricTile
                  label="Care"
                  value={careTeamSummary.activeCount ? `${careTeamSummary.activeCount}` : 'Quiet'}
                  caption={careStatusLabel}
                  tone={careAttention > 0 ? 'primary' : 'neutral'}
                  icon={<HeartHandshake className="h-4 w-4" />}
                />
                <MetricTile
                  label="Engagement"
                  value={engagementState}
                  caption={`Streak ${orchestration?.activity?.streak_days || 0} day${(orchestration?.activity?.streak_days || 0) === 1 ? '' : 's'}`}
                  tone="neutral"
                  icon={<Activity className="h-4 w-4" />}
                />
                <MetricTile
                  label="Reassessment"
                  value={reassessmentState}
                  caption={`Next screening ${nextScreeningLabel}`}
                  tone={orchestration?.reassessment?.reassessment_due ? 'warning' : 'neutral'}
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ActionRow
                  href={primaryActionHref}
                  title={primaryActionLabel}
                  description="Recommended now"
                  tone="primary"
                />
                <ActionRow
                  href="/care-team"
                  title="Open Care Team"
                  description={careAttention > 0 ? `${careAttention} update${careAttention === 1 ? '' : 's'}` : 'Private messages'}
                  tone="care"
                />
                <ActionRow
                  href="/selfcare"
                  title="Continue self-care"
                  description="Short guided exercises"
                  tone="neutral"
                />
              </div>
            </div>

            <div className={`${panelMuted} p-4 sm:p-5`}>
              <div className="flex items-center justify-between gap-3">
                <p className={sectionLabel}>Today</p>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                  ID {patientCard?.id ?? '—'}
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <StateRow label="Current risk" value={labelForRisk(stats.riskLevel)} />
                <StateRow label="Last screening" value={stats.lastScreening || 'No screening yet'} />
                <StateRow label="Last active" value={lastActiveLabel} />
                <StateRow label="Care team" value={careTeamSummary.activeCount > 0 ? 'Follow-up active' : 'No active outreach'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniStat label="Unread" value={String(careTeamSummary.unreadCount)} />
                <MiniStat label="Reply" value={String(careTeamSummary.replyRequestedCount)} />
                <MiniStat label="Scheduled" value={String(careTeamSummary.scheduledFollowups)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <OnboardingCta orchestration={orchestration} />

      {(orchestration?.readiness?.high_risk_no_followup ||
        orchestration?.activity?.is_drifting ||
        orchestration?.recommendation?.emphasize_professional_support) && (
        <section className="grid gap-3">
          {orchestration?.readiness?.high_risk_no_followup ? (
            <SignalBanner
              tone="danger"
              title="Follow-up is recommended"
              body="Your recent elevated-risk results have not had enough follow-up activity yet. A reassessment and support-oriented next step are recommended."
            />
          ) : null}
          {orchestration?.activity?.is_drifting ? (
            <SignalBanner
              tone="warning"
              title="Your momentum has slowed"
              body="A short self-care session can help you rebuild consistency without taking much time."
            />
          ) : null}
          {orchestration?.recommendation?.emphasize_professional_support ? (
            <SignalBanner
              tone="danger"
              title="Professional support may help"
              body="If you feel unsafe, contact local emergency services or crisis support immediately. Care Team can also help you continue follow-up inside the app."
            />
          ) : null}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className={panel}>
            <div className="px-5 py-4 border-b border-slate-100">
              <p className={sectionLabel}>Action Board</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">What to do next</h3>
            </div>
            <div className="p-5 space-y-4">
              <ActionRow
                href={primaryActionHref}
                title={primaryActionLabel}
                description="Recommended next step"
                tone="primary"
              />
              <ActionRow
                href="/care-team"
                title="Open Care Team"
                description="Read updates and reply"
                tone="care"
              />
              <ActionRow
                href="/selfcare"
                title="Continue self-care"
                description="Resume guided exercises"
                tone="neutral"
              />
            </div>
          </div>

          <div className={panel}>
            <div className="px-5 py-4 border-b border-slate-100">
              <p className={sectionLabel}>Timeline</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Recent activity</h3>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                {recentTimeline.map((activity, idx) => (
                  <div key={`${activity.type}-${idx}`} className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{activity.label}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleDateString() : 'Recent activity'}
                      </p>
                    </div>
                  </div>
                ))}
                {recentTimeline.length === 0 && (
                  <p className={textMuted}>No recent activity yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={panel}>
            <div className="px-5 py-4 border-b border-slate-100">
              <p className={sectionLabel}>Signal</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">This week</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className={`rounded-2xl border px-4 py-4 ${toneMap[topLifestyleSignal?.severity === 'high' ? 'warning' : 'neutral']}`}>
                <p className="text-sm font-semibold text-slate-900">
                  {topLifestyleSignal?.title || 'Build more day-to-day signal'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {topLifestyleSignal?.summary ||
                    orchestration?.lifestyle_insights?.supportive_copy ||
                    'Small patterns like sleep, stress, and consistency often shape how recovery feels between formal screenings.'}
                </p>
              </div>
              <div className="grid gap-3">
                {(orchestration?.lifestyle_insights?.signals || []).slice(0, 2).map((signal) => (
                  <div key={signal.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${toneMap[signal.severity === 'high' ? 'warning' : 'neutral']}`}>
                        {signal.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{signal.recommendation}</p>
                  </div>
                ))}
                {(!orchestration?.lifestyle_insights?.signals || orchestration.lifestyle_insights.signals.length === 0) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-600">
                      Save a few mood check-ins and keep up short self-care sessions to unlock better day-to-day guidance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={panel}>
            <div className="px-5 py-4 border-b border-slate-100">
              <p className={sectionLabel}>Check-in</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Mood check</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{currentMoodLabel}</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: 1, label: 'Very low', emoji: '😟' },
                  { value: 2, label: 'Low', emoji: '😕' },
                  { value: 3, label: 'Okay', emoji: '😐' },
                  { value: 4, label: 'Good', emoji: '🙂' },
                  { value: 5, label: 'Strong', emoji: '😊' },
                ].map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => setSelectedMood(mood.value)}
                    className={`rounded-2xl border px-2 py-3 text-center transition ${
                      selectedMood === mood.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xl">{mood.emoji}</div>
                    <div className="mt-2 text-[11px] font-semibold">{mood.label}</div>
                  </button>
                ))}
              </div>
              <textarea
                value={moodNotes}
                onChange={(e) => setMoodNotes(e.target.value)}
                rows={3}
                placeholder="Optional note about today…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
              {moodFeedback ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    moodFeedback.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {moodFeedback.message}
                </div>
              ) : null}
              <button
                onClick={() => void submitMoodCheck()}
                disabled={moodSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-slate-900 disabled:opacity-60"
              >
                <SmilePlus className="h-4 w-4" />
                {moodSaving ? 'Saving…' : 'Save mood check'}
              </button>
            </div>
          </div>

          <div className={panel}>
            <div className="px-5 py-4 border-b border-slate-100">
              <p className={sectionLabel}>Care Team</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Latest update</h3>
            </div>
            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">
                  {careTeamSummary.latestNotificationTitle || 'No new care-team updates.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

const OnboardingCta: React.FC<{ orchestration: OrchestrationState | null }> = ({ orchestration }) => {
  const needsOnboarding = !!orchestration && !orchestration.onboarding_complete;
  if (!needsOnboarding) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className={sectionLabel}>Onboarding</p>
        <p className="mt-1 text-sm font-medium text-amber-950">
          Complete your setup to personalize recommendations. Next step: {orchestration?.resume_step}.
        </p>
      </div>
      <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
        Resume
      </Link>
    </div>
  );
};

function labelForRisk(riskLevel: string) {
  if (!riskLevel) return 'Unknown';
  return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
}

function capitalize(value: string) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function riskTone(level: string): 'danger' | 'warning' | 'primary' | 'neutral' {
  if (level === 'critical') return 'danger';
  if (level === 'high') return 'warning';
  if (level === 'medium') return 'primary';
  return 'neutral';
}

const toneMap: Record<string, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  primary: 'border-primary-200 bg-primary-50 text-primary-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-900',
  care: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
};

function MetricTile({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  tone: 'danger' | 'warning' | 'primary' | 'neutral';
}) {
  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
        <div className="opacity-70">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-75">{caption}</p>
    </div>
  );
}

function SignalBanner({ tone, title, body }: { tone: 'danger' | 'warning'; title: string; body: string }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${toneMap[tone]}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{body}</p>
    </div>
  );
}

function ActionRow({
  href,
  title,
  description,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  tone: 'primary' | 'neutral' | 'care';
}) {
  return (
    <Link
      to={href}
      className={`group flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition-all hover:-translate-y-px ${toneMap[tone]}`}
    >
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs opacity-85">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-950 text-right">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'danger' | 'warning' | 'primary' | 'neutral';
}) {
  return (
    <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${toneMap[tone]}`}>
      {label}
    </div>
  );
}
