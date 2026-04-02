import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  fetchClinicianPatientSummaries,
  type ClinicianPatientSummary,
  type ConsultationCaseDetail,
  type ConsultationStatus,
  type ConsultationThread,
  fetchConsultationCaseDetail,
  fetchLatestConsultationForPatient,
  setConsultationStatus,
  createLinkedAppointment,
  createLinkedNote,
} from '../utils/clinicianApi';
import ClinicianRiskBadge from '../components/clinician/ClinicianRiskBadge';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import {
  clinPanel,
  clinBtnSecondary,
  clinConsoleStack,
  clinPanelAccentTop,
  clinPanelHeader,
} from '../components/clinician/clinicianUiClasses';
import {
  ArrowLeft,
  Calendar,
  Activity,
  Shield,
  MessageCircle,
  StickyNote,
  Clock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import ConsultationStatusBadge from '../components/clinician/ConsultationStatusBadge';
import ConsultationChatPanel from '../components/clinician/ConsultationChatPanel';
import { subscribeConsultationRefresh, emitConsultationRefresh } from '../utils/consultationRefreshBus';
import { useRefreshOnWindowFocus } from '../hooks/useRefreshOnWindowFocus';
import { useAuthenticatedEventStream } from '../hooks/useAuthenticatedEventStream';

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

function toDatetimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const STATUS_ACTIONS: { value: ConsultationStatus; label: string }[] = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_patient', label: 'Awaiting patient' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'resolved', label: 'Resolved' },
];

const ClinicianPatientDetail: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const location = useLocation();
  const idNum = parseInt(patientId || '', 10);
  const [row, setRow] = useState<ClinicianPatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationCaseDetail | null>(null);
  const [consultationError, setConsultationError] = useState<string | null>(null);
  const chatSectionRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [appt, setAppt] = useState<{ type: string; when: string; duration: string; reason: string }>({
    type: 'follow_up',
    when: '',
    duration: '30',
    reason: '',
  });
  const [note, setNote] = useState<{ type: string; content: string }>({ type: 'progress', content: '' });

  const load = useCallback(async () => {
    if (!patientId || Number.isNaN(idNum)) {
      setError('Invalid patient.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchClinicianPatientSummaries();
      const found = rows.find((r) => r.patient_id === idNum) || null;
      if (!found) {
        setError('This patient is not assigned to you or could not be found.');
        setRow(null);
      } else {
        setRow(found);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load patient.');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, idNum]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadConsultation = async () => {
      if (!row) {
        setConsultation(null);
        setConsultationError(null);
        return;
      }
      setConsultationError(null);
      try {
        const stateCaseId = (location.state as { consultationCaseId?: number })?.consultationCaseId;
        let detail: ConsultationCaseDetail | null = null;
        if (stateCaseId) {
          try {
            const routed = await fetchConsultationCaseDetail(stateCaseId);
            detail = routed.patient === row.patient_id ? routed : null;
          } catch {
            detail = null;
          }
        }
        if (!detail) {
          detail = await fetchLatestConsultationForPatient(row.patient_id);
        }
        setConsultation(detail);
      } catch {
        setConsultation(null);
        setConsultationError('Could not load the current consultation case for this patient.');
      }
    };
    void loadConsultation();
  }, [row, location.state]);

  useEffect(() => {
    if ((location.state as { focusChat?: boolean })?.focusChat && consultation && chatSectionRef.current) {
      chatSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [consultation, location.state]);

  const scrollToChat = () => {
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const refreshCase = useCallback(async (caseId: number) => {
    try {
      const refreshed = await fetchConsultationCaseDetail(caseId);
      setConsultation(refreshed);
      setConsultationError(null);
      return refreshed;
    } catch {
      setConsultationError('The consultation case could not be refreshed. Please reload the page.');
      return null;
    }
  }, []);

  const handleThreadChange = useCallback((t: ConsultationThread | null) => {
    setConsultation((c) => {
      if (!c) return c;
      const currentId = c.thread?.id ?? null;
      const nextId = t?.id ?? null;
      const currentUpdated = c.thread?.updated_at ?? null;
      const nextUpdated = t?.updated_at ?? null;
      const currentCount = c.thread?.messages?.length ?? 0;
      const nextCount = t?.messages?.length ?? 0;
      if (currentId === nextId && currentUpdated === nextUpdated && currentCount === nextCount) {
        return c;
      }
      return { ...c, thread: t || null };
    });
  }, []);

  const handleThreadActivity = useCallback(async () => {
    if (consultationRef.current?.id) {
      await refreshCase(consultationRef.current.id);
    }
  }, [refreshCase]);

  const consultationRef = useRef(consultation);
  consultationRef.current = consultation;

  useEffect(() => {
    return subscribeConsultationRefresh('clinician', () => {
      const id = consultationRef.current?.id;
      if (id) void refreshCase(id);
    });
  }, [refreshCase]);

  useRefreshOnWindowFocus(() => {
    const id = consultationRef.current?.id;
    if (id) void refreshCase(id);
  }, { debounceMs: 1000 });

  const liveThread = useAuthenticatedEventStream(
    consultation?.id ? `/clinician/consultations/${consultation.id}/thread-events/` : null,
    {
      enabled: Boolean(consultation?.id),
      onUpdate: () => {
        const id = consultationRef.current?.id;
        if (id) void refreshCase(id);
      },
    }
  );

  if (loading) {
    return <ClinicianLoadingState message="Loading care workspace…" />;
  }

  if (error || !row) {
    return (
      <div className={`${clinPanel} border-amber-200/90 bg-amber-50/40 p-8 max-w-xl mx-auto`}>
        <p className="text-sm font-bold text-amber-950">{error || 'Not found'}</p>
        <p className="text-xs text-amber-900/80 mt-2">Records are limited to your current assignments.</p>
        <Link to="/clinician/dashboard" className={`${clinBtnSecondary} mt-5 inline-flex`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>
    );
  }

  const displayName =
    row.consented_for_clinician_access && row.preferred_name?.trim()
      ? row.preferred_name.trim()
      : `Patient #${row.patient_id}`;

  const summaryCard =
    'rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-0.5';

  const unreadPatient =
    consultation?.thread?.clinician_unread_count != null && consultation.thread.clinician_unread_count > 0;

  const actionBtn =
    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:pointer-events-none';

  return (
    <div className={`${clinConsoleStack} max-w-6xl`}>
      <div>
        <Link
          to="/clinician/patients"
          className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Patients
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_min(100%,320px)] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          <div className={`${clinPanel} overflow-hidden`}>
            <div className={clinPanelAccentTop} />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{displayName}</h1>
                    <ClinicianRiskBadge level={row.overall_risk_level} />
                  </div>
                  <p className="text-sm text-slate-500 mt-2 font-mono font-semibold">Patient ID {row.patient_id}</p>
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                    Last screening: {formatDt(row.last_screening_at)}
                    {row.days_since_last_screening != null ? ` · ${row.days_since_last_screening}d ago` : ''}
                  </p>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-600 max-w-xs leading-relaxed border border-slate-200/80 rounded-xl bg-slate-50/90 p-3.5 shadow-sm">
                  <Shield className="h-4 w-4 text-primary-600/70 shrink-0 mt-0.5" aria-hidden />
                  <span>Assignment-scoped workspace. Identity and clinical fields follow consent and policy.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={summaryCard}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PHQ-9</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {row.latest_phq9 != null ? row.latest_phq9.score : '—'}
              </p>
              <p className="text-xs text-slate-600 mt-1 font-medium truncate">
                {row.latest_phq9?.severity_label || row.latest_phq9?.severity_code || ''}
              </p>
            </div>
            <div className={summaryCard}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">GAD-7</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {row.latest_gad7 != null ? row.latest_gad7.score : '—'}
              </p>
              <p className="text-xs text-slate-600 mt-1 font-medium truncate">
                {row.latest_gad7?.severity_label || row.latest_gad7?.severity_code || ''}
              </p>
            </div>
            <div className={summaryCard}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engagement</p>
              <p className="text-lg font-bold text-slate-900 mt-1 capitalize">{row.engagement_level || '—'}</p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                {row.last_activity_at ? formatDt(row.last_activity_at) : 'No recent activity'}
              </p>
            </div>
            <div className={summaryCard}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reassessment</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {row.reassessment_due ? 'Due' : row.reassessment_recommended_soon ? 'Soon' : 'Not flagged'}
              </p>
              <p className="text-xs text-slate-500 mt-1 capitalize font-medium">
                {row.reassessment_urgency_tier?.replace(/_/g, ' ') || ''}
              </p>
            </div>
          </div>

          <div className={`${clinPanel} overflow-hidden`}>
            <div className={clinPanelHeader}>
              <h2 className="text-sm font-bold text-slate-900">Clinical trajectory</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Screening trend and in-app engagement</p>
            </div>
            <div className="p-5">
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Screening trend</dt>
                  <dd className="font-semibold text-slate-900 capitalize mt-1">{row.trend_direction || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Mood (app)</dt>
                  <dd className="font-semibold text-slate-900 capitalize mt-1">{row.mood_trend || '—'}</dd>
                </div>
                {row.next_best_action?.title ? (
                  <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Patient app — suggested step</dt>
                    <dd className="font-medium text-slate-900 mt-1">{row.next_best_action.title}</dd>
                  </div>
                ) : null}
              </dl>
              {row.consented_for_clinician_access && row.baseline_concerns && row.baseline_concerns.length > 0 ? (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Stated concerns (consent)</p>
                  <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside font-medium">
                    {row.baseline_concerns.map((c, i) => (
                      <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {!consultation ? (
            <div className={`${clinPanel} p-6`}>
              <h2 className="text-sm font-bold text-slate-900">Consultation</h2>
              <p className="text-sm text-slate-600 mt-2">
                No consultation case is available for this patient right now. Cases are created when follow-up is clinically
                indicated for an assigned patient.
              </p>
              {consultationError ? <p className="text-xs text-rose-700 mt-3">{consultationError}</p> : null}
            </div>
          ) : (
            <>
              <div className={`${clinPanel} overflow-hidden`}>
                <div className={clinPanelHeader}>
                  <h2 className="text-sm font-bold text-slate-900">Consultation context</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Operational state for this episode of care</p>
                </div>
                <div className="p-5 space-y-4">
                {consultationError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {consultationError}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <ConsultationStatusBadge status={consultation.status} priority={consultation.priority} />
                  {liveThread.connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live updates
                    </span>
                  ) : null}
                  {consultation.requires_follow_up ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                        Follow-up required
                      </span>
                    ) : null}
                    {unreadPatient ? (
                      <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200/80 px-2.5 py-1 text-[11px] font-semibold text-sky-900">
                        Unread patient reply
                      </span>
                    ) : null}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Opened</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{formatDt(consultation.opened_at)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Last activity</p>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {consultation.last_activity_at ? formatDt(consultation.last_activity_at) : '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Why this case</p>
                      <p className="text-slate-800 mt-1 leading-relaxed">{consultation.trigger_reason || '—'}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 flex items-start gap-2">
                      <StickyNote className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <p className="font-bold text-slate-800">{consultation.note_count ?? 0} notes</p>
                        <p className="text-slate-500 mt-0.5">
                          Last: {consultation.most_recent_note_at ? formatDt(consultation.most_recent_note_at) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <p className="font-bold text-slate-800">{consultation.appointment_count ?? 0} appointments</p>
                        <p className="text-slate-500 mt-0.5">
                          Next:{' '}
                          {consultation.next_appointment_at
                            ? formatDt(consultation.next_appointment_at)
                            : consultation.most_recent_appointment
                              ? formatDt(String(consultation.most_recent_appointment))
                              : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 flex items-start gap-2">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <p className="font-bold text-slate-800">Thread</p>
                        <p className="text-slate-500 mt-0.5">
                          {consultation.thread?.last_message_at
                            ? `Last message ${formatDt(consultation.thread.last_message_at)}`
                            : 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 text-xs text-slate-600">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Patient notifications</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-white border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">
                        {consultation.notification_count ?? 0} sent
                      </span>
                      {(consultation.unread_notification_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 font-semibold text-primary-700">
                          {consultation.unread_notification_count} unread
                        </span>
                      ) : null}
                      {consultation.latest_outbound_delivery_status ? (
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white capitalize">
                          Last outbound {consultation.latest_outbound_delivery_status}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-slate-500">
                      Most recent notification: {consultation.most_recent_notification_at ? formatDt(consultation.most_recent_notification_at) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div ref={chatSectionRef} className={`${clinPanel} overflow-hidden p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary-600" aria-hidden />
                    Care messaging
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {consultation.thread?.clinician_unread_count
                      ? `${consultation.thread.clinician_unread_count} unread from patient`
                      : 'Inbox clear'}
                  </p>
                </div>
                <ConsultationChatPanel
                  caseId={consultation.id}
                  refreshIntervalMs={45_000}
                  externalRefreshKey={liveThread.lastEventAt}
                  onThreadChange={handleThreadChange}
                  onActivity={handleThreadActivity}
                />
              </div>
            </>
          )}
        </div>

        {consultation ? (
          <aside className="space-y-4 lg:sticky lg:top-4 self-start w-full">
            <div className={`${clinPanel} overflow-hidden p-4`}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Care actions</h2>
              <div className="space-y-2">
                <button type="button" className={actionBtn} onClick={scrollToChat}>
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary-600" aria-hidden />
                    {consultation.thread?.messages?.length ? 'Continue chat' : 'Open chat'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                </button>
                <button
                  type="button"
                  className={actionBtn}
                  onClick={() => {
                    setActionError(null);
                    setShowNoteForm((v) => !v);
                    setShowApptForm(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-slate-600" aria-hidden />
                    Add clinical note
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                </button>
                <button
                  type="button"
                  className={actionBtn}
                  onClick={() => {
                    setActionError(null);
                    setShowApptForm((v) => !v);
                    setShowNoteForm(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-600" aria-hidden />
                    Schedule follow-up visit
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                </button>
              </div>

              {showNoteForm ? (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Note</p>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="Type (e.g. progress)"
                    value={note.type}
                    onChange={(e) => setNote({ ...note, type: e.target.value })}
                  />
                  <textarea
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    rows={4}
                    placeholder="Documentation (not visible to patient)"
                    value={note.content}
                    onChange={(e) => setNote({ ...note, content: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={saving || !note.content.trim()}
                    onClick={async () => {
                      setActionError(null);
                      setSaving(true);
                      try {
                        await createLinkedNote({
                          patient: row.patient_id,
                          note_type: note.type || 'progress',
                          content: note.content,
                          consultation_case: consultation.id,
                        } as any);
                        setNote({ type: 'progress', content: '' });
                        setShowNoteForm(false);
                        await refreshCase(consultation.id);
                        emitConsultationRefresh('clinician');
                      } catch (e: any) {
                        setActionError(e?.response?.data?.detail || e?.message || 'Could not save the note right now.');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Save note
                  </button>
                </div>
              ) : null}

              {showApptForm ? (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Appointment</p>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">Date and time</span>
                    <input
                      type="datetime-local"
                      className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                      value={toDatetimeLocalInput(appt.when)}
                      onChange={(e) => setAppt({ ...appt, when: e.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Visit type</span>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
                        value={appt.type}
                        onChange={(e) => setAppt({ ...appt, type: e.target.value })}
                      >
                        <option value="follow_up">Follow-up</option>
                        <option value="consultation">Consultation</option>
                        <option value="check_in">Check-in</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Duration</span>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
                        value={appt.duration}
                        onChange={(e) => setAppt({ ...appt, duration: e.target.value })}
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">60 min</option>
                      </select>
                    </label>
                  </div>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                    rows={3}
                    placeholder="Reason or preparation note for the patient"
                    value={appt.reason}
                    onChange={(e) => setAppt({ ...appt, reason: e.target.value })}
                  />
                  {actionError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                      {actionError}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving || !appt.when.trim()}
                    onClick={async () => {
                      setActionError(null);
                      const scheduledDate = localInputToIso(appt.when);
                      if (!scheduledDate) {
                        setActionError('Select a valid appointment date and time.');
                        return;
                      }
                      setSaving(true);
                      try {
                        await createLinkedAppointment({
                          patient: row.patient_id,
                          appointment_type: appt.type || 'follow_up',
                          scheduled_date: scheduledDate,
                          duration_minutes: Number(appt.duration) || 30,
                          reason: appt.reason || '',
                          consultation_case: consultation.id,
                        } as any);
                        setAppt({ type: 'follow_up', when: '', duration: '30', reason: '' });
                        setShowApptForm(false);
                        await refreshCase(consultation.id);
                        emitConsultationRefresh('clinician');
                      } catch (e: any) {
                        setActionError(e?.response?.data?.detail || e?.message || 'Could not create the appointment right now.');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Schedule appointment
                  </button>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Linked visits notify the patient in Care Team and move the case into scheduled follow-up.
                  </p>
                </div>
              ) : null}
              {actionError && !showApptForm && !showNoteForm ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                  {actionError}
                </div>
              ) : null}
            </div>

            <div className={`${clinPanel} overflow-hidden p-4`}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Case status</h2>
              <p className="text-[11px] text-slate-500 mb-3">Use explicit transitions to keep the queue accurate.</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={saving || consultation.status === value}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const updated = await setConsultationStatus(consultation.id, value);
                        setConsultation(updated);
                        emitConsultationRefresh('clinician');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      consultation.status === value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || consultation.status === 'open'}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updated = await setConsultationStatus(consultation.id, 'open');
                      setConsultation(updated);
                      emitConsultationRefresh('clinician');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Reopen (open)
                </button>
                <button
                  type="button"
                  disabled={saving || consultation.status === 'closed'}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updated = await setConsultationStatus(consultation.id, 'closed');
                      setConsultation(updated);
                      emitConsultationRefresh('clinician');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Close case
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default ClinicianPatientDetail;
