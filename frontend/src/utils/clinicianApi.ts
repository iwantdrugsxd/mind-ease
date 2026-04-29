import api from './api';

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const memoryCache = new Map<string, CacheEntry<any>>();

function readSessionCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / serialization failures.
  }
}

async function withCachedResource<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts?: { persist?: boolean }
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.inFlight) {
    return cached.inFlight;
  }

  const hydrated = opts?.persist ? readSessionCache<T>(key) : null;
  if (hydrated !== null && cached?.value === undefined) {
    memoryCache.set(key, { value: hydrated, expiresAt: now + Math.min(ttlMs, 5_000) });
    return hydrated;
  }

  const promise = loader()
    .then((value) => {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (opts?.persist) writeSessionCache(key, value);
      return value;
    })
    .catch((error) => {
      const previous = memoryCache.get(key) as CacheEntry<T> | undefined;
      if (previous?.value !== undefined) {
        memoryCache.set(key, { value: previous.value, expiresAt: Date.now() + 2_000 });
      } else {
        memoryCache.delete(key);
      }
      throw error;
    });

  memoryCache.set(key, {
    value: cached?.value,
    expiresAt: cached?.expiresAt ?? 0,
    inFlight: promise,
  });

  return promise;
}

function invalidateCachedResource(prefix: string) {
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

/** Matches GET /api/clinician/auth/status/ */
export interface ClinicianAuthStatus {
  has_clinician_profile: boolean;
  status: string | null;
  is_approved: boolean;
}

// ===============================
// Phase 2: Consultation types
// Uses backend payload shape; server now includes patient_summary inline
// ===============================
export interface ConsultationPatientSummary {
  patient_id: number;
  overall_risk_level: string;
  latest_phq9?: { score: number; severity_label?: string; created_at?: string } | null;
  latest_gad7?: { score: number; severity_label?: string; created_at?: string } | null;
  last_screening_at?: string | null;
  trend_direction?: string;
  flags?: {
    requires_attention?: boolean;
    clinician_followup_recommended?: boolean;
    high_risk_no_followup?: boolean;
  };
}

export type ConsultationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ConsultationStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_clinician'
  | 'awaiting_patient'
  | 'scheduled'
  | 'resolved'
  | 'closed';

export interface ConsultationListRow {
  id: number;
  patient: number;
  patient_name: string;
  assigned_clinician: number;
  clinician_name: string;
  source: string;
  trigger_reason: string;
  priority: ConsultationPriority;
  status: ConsultationStatus;
  requires_follow_up: boolean;
  opened_at: string;
  last_activity_at: string;
  resolved_at?: string | null;
  thread_id?: number | null;
  last_message_at?: string | null;
  unread_for_clinician?: number;
  unread_for_patient?: number;
  last_message_preview?: string | null;
  next_appointment_at?: string | null;
  next_appointment_status?: string | null;
  patient_summary?: ConsultationPatientSummary;
}

export interface ConsultationThreadMessage {
  id: number;
  thread: number;
  sender_user?: number | null;
  sender_type: 'clinician' | 'patient' | 'system';
  content: string;
  message_type: 'text' | 'system_notice' | 'appointment_notice' | 'followup_notice';
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface PendingPatientAppointment {
  id: number;
  appointment_type: 'initial' | 'follow_up' | 'teleconsult' | 'crisis';
  scheduled_date: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  patient_response: 'pending' | 'accepted' | 'rejected';
  reason?: string;
}

export interface ConsultationThread {
  id: number;
  consultation_case: number;
  patient: number;
  clinician: number;
  is_active: boolean;
  last_message_at?: string | null;
  last_message_preview?: string;
  clinician_unread_count: number;
  patient_unread_count: number;
  created_at: string;
  updated_at: string;
  messages: ConsultationThreadMessage[];
  pending_patient_appointment?: PendingPatientAppointment | null;
}

export interface ConsultationCaseDetail {
  id: number;
  patient: number;
  patient_name: string;
  assigned_clinician: number;
  clinician_name: string;
  source: string;
  trigger_reason: string;
  priority: ConsultationPriority;
  status: ConsultationStatus;
  requires_follow_up: boolean;
  opened_at: string;
  last_activity_at: string;
  resolved_at?: string | null;
  resolution_notes?: string;
  patient_summary?: ConsultationPatientSummary;
  appointment_count?: number;
  note_count?: number;
  most_recent_appointment?: string | null;
  most_recent_note_at?: string | null;
  next_appointment_at?: string | null;
  next_appointment_status?: string | null;
  notification_count?: number;
  unread_notification_count?: number;
  most_recent_notification_at?: string | null;
  latest_outbound_delivery_status?: string | null;
  thread?: ConsultationThread | null;
}

/** Patient-facing consultation row (no clinician scorecard / internal trigger text). */
export interface PatientConsultationListRow {
  id: number;
  patient: number;
  patient_name: string;
  clinician_name: string;
  priority: ConsultationPriority;
  status: ConsultationStatus;
  requires_follow_up: boolean;
  opened_at: string;
  last_activity_at: string;
  resolved_at?: string | null;
  thread_id?: number | null;
  last_message_at?: string | null;
  unread_for_patient?: number;
  last_message_preview?: string | null;
  care_preview?: string;
  next_appointment_at?: string | null;
  next_appointment_status?: string | null;
}

export interface ClinicianProfile {
  id: number;
  status: string;
  license_number: string;
  specialization: string;
  phone_number: string;
  qualification?: string;
  years_of_experience?: number | null;
  organization?: string;
  max_patients_per_day?: number | null;
  communication_modes?: string[];
  bio?: string;
  review_notes?: string;
}

export interface StaffClinicianRow {
  id: number;
  specialization: string;
  organization?: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface StaffAssignmentRow {
  id: number;
  patient: number;
  patient_name: string;
  clinician: number;
  clinician_name: string;
  assigned_at: string;
  is_active: boolean;
  notes?: string;
}

/** Row from GET /api/clinician/me/patient-summaries/ (build_clinician_patient_summary). */
export interface ClinicianPatientSummary {
  patient_id: number;
  consented_for_clinician_access: boolean;
  preferred_name: string;
  baseline_concerns?: string[];
  risk_level: string;
  overall_risk_level: string;
  mood_trend?: string | null;
  engagement_level?: string;
  last_activity_at?: string | null;
  high_risk_alerts: number;
  candidate_for_clinician_review: boolean;
  high_risk_no_followup: boolean;
  reassessment_due: boolean;
  reassessment_recommended_soon?: boolean;
  reassessment_priority?: string | null;
  reassessment_urgency_tier?: string | null;
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
  trend_direction?: string;
  days_since_last_screening?: number | null;
  last_screening_at?: string | null;
  next_best_action?: {
    action_type?: string;
    title?: string;
    urgency?: string;
  };
  continuity_summary?: {
    engagement_decay?: boolean;
    selfcare_reentry_suggested?: boolean;
    mood_declining?: boolean;
    engaged_but_worsening?: boolean;
    not_engaged_and_worsening?: boolean;
  };
  flags?: {
    requires_attention?: boolean;
    clinician_followup_recommended?: boolean;
    candidate_for_clinician_review?: boolean;
    reassessment_due?: boolean;
    high_risk_no_followup?: boolean;
    is_drifting?: boolean;
  };
  scorecard_version?: number;
}

export async function fetchClinicianStatus(): Promise<ClinicianAuthStatus> {
  const res = await api.get<ClinicianAuthStatus>('/clinician/auth/status/');
  return res.data;
}

export async function fetchClinicianProfile(): Promise<ClinicianProfile> {
  return withCachedResource(
    'clinician:profile',
    60_000,
    async () => {
      const res = await api.get<ClinicianProfile>('/clinician/auth/me/');
      return res.data;
    },
    { persist: true }
  );
}

export async function fetchStaffClinicians(): Promise<StaffClinicianRow[]> {
  const res = await api.get<{ results?: StaffClinicianRow[] } | StaffClinicianRow[]>('/clinician/internal/staff/clinicians/');
  const data: any = res.data;
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

export async function fetchStaffAssignments(): Promise<StaffAssignmentRow[]> {
  const res = await api.get<{ results?: StaffAssignmentRow[] } | StaffAssignmentRow[]>('/clinician/internal/staff/assignments/');
  const data: any = res.data;
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

export async function deactivateStaffAssignment(id: number): Promise<StaffAssignmentRow> {
  const res = await api.patch<StaffAssignmentRow>(`/clinician/internal/staff/assignments/${id}/`, { is_active: false });
  return res.data;
}

export async function transferStaffAssignment(input: {
  patient: number;
  to_clinician: number;
  notes?: string;
}): Promise<StaffAssignmentRow> {
  const res = await api.post<StaffAssignmentRow>('/clinician/internal/staff/assignments/transfer/', input);
  return res.data;
}

export async function fetchOrphanedConsultationCases(): Promise<ConsultationListRow[]> {
  const res = await api.get<{ results?: ConsultationListRow[] } | ConsultationListRow[]>('/clinician/internal/staff/consultation-cases/missing-assignment/');
  const data: any = res.data;
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

/** Assigned patients for approved clinician. */
export async function fetchClinicianPatientSummaries(): Promise<ClinicianPatientSummary[]> {
  return withCachedResource(
    'clinician:patient-summaries',
    20_000,
    async () => {
      const res = await api.get<{ results: ClinicianPatientSummary[] }>('/clinician/me/patient-summaries/');
      return res.data?.results ?? [];
    },
    { persist: true }
  );
}

// ===============================
// Phase 2: Consultation API helpers
// ===============================
export async function fetchClinicianConsultations(params?: {
  status?: ConsultationStatus;
  priority?: ConsultationPriority;
  patient?: number;
}): Promise<ConsultationListRow[]> {
  const normalizedParams = JSON.stringify(params || {});
  return withCachedResource(
    `clinician:consultations:${normalizedParams}`,
    10_000,
    async () => {
      const res = await api.get<ConsultationListRow[]>('/clinician/consultations/', {
        params,
      } as any);
      const data: any = res.data as any;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results as ConsultationListRow[];
      return [];
    },
    { persist: !params || Object.keys(params).length === 0 }
  );
}

export async function fetchConsultationCaseDetail(caseId: number): Promise<ConsultationCaseDetail> {
  const res = await api.get<ConsultationCaseDetail>(`/clinician/consultations/${caseId}/`);
  return res.data;
}

export async function fetchLatestConsultationForPatient(patientId: number): Promise<ConsultationCaseDetail | null> {
  const rows = await fetchClinicianConsultations({ patient: patientId });
  if (!rows.length) return null;
  const activeFirst = rows.filter((r) => r.status !== 'closed' && r.status !== 'resolved');
  const pool = activeFirst.length ? activeFirst : rows;
  const top = [...pool].sort((a, b) => {
    const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    return tb - ta;
  })[0];
  return fetchConsultationCaseDetail(top.id);
}

export async function fetchConsultationThread(caseId: number): Promise<ConsultationThread | null> {
  const res = await api.get<ConsultationThread | { detail: string }>(`/clinician/consultations/${caseId}/thread/`);
  if ((res.data as any)?.detail) return null;
  return res.data as ConsultationThread;
}

export async function sendConsultationMessage(caseId: number, content: string): Promise<ConsultationThreadMessage> {
  const res = await api.post<ConsultationThreadMessage>(`/clinician/consultations/${caseId}/messages/`, { content });
  return res.data;
}

export async function markConsultationMessageRead(caseId: number, messageId: number): Promise<void> {
  await api.post(`/clinician/consultations/${caseId}/messages/${messageId}/mark-read/`, {});
}

// ===============================
// Phase 3: Patient-side consultation API helpers
// ===============================
export async function fetchPatientConsultations(): Promise<PatientConsultationListRow[]> {
  return withCachedResource(
    'patient:consultations',
    10_000,
    async () => {
      const res = await api.get<{ results: PatientConsultationListRow[] }>('/clinician/patient/me/consultations/');
      return Array.isArray(res.data?.results) ? res.data.results : [];
    },
    { persist: true }
  );
}

export async function fetchPatientConsultationThread(caseId: number): Promise<ConsultationThread | null> {
  const res = await api.get<ConsultationThread | { detail: string }>('/clinician/patient/me/consultations/thread/', {
    params: { case_id: caseId },
  } as any);
  if ((res.data as any)?.detail) return null;
  return res.data as ConsultationThread;
}

export async function sendPatientConsultationMessage(caseId: number, content: string): Promise<ConsultationThreadMessage> {
  const res = await api.post<ConsultationThreadMessage>('/clinician/patient/me/consultations/thread/', { case_id: caseId, content });
  invalidateCachedResource('patient:consultations');
  invalidateCachedResource('patient:care-team-summary');
  invalidateCachedResource('patient:care-notifications');
  return res.data;
}

export async function markPatientConsultationMessageRead(caseId: number, messageId: number): Promise<void> {
  await api.post(`/clinician/patient/me/consultations/${caseId}/messages/${messageId}/mark-read/`, {});
  invalidateCachedResource('patient:consultations');
  invalidateCachedResource('patient:care-team-summary');
}

export async function respondToPatientAppointment(
  appointmentId: number,
  response: 'accepted' | 'rejected'
): Promise<PendingPatientAppointment> {
  const res = await api.post<PendingPatientAppointment>(`/clinician/patient/me/appointments/${appointmentId}/respond/`, { response });
  invalidateCachedResource('patient:consultations');
  invalidateCachedResource('patient:care-team-summary');
  invalidateCachedResource('patient:care-notifications');
  invalidateCachedResource('clinician:consultations:');
  invalidateCachedResource('clinician:consultation-summary');
  return res.data;
}

// ===============================
// Phase 4: Clinician workflow actions (status, linked appointment/note)
// ===============================
export async function setConsultationStatus(caseId: number, status: ConsultationStatus): Promise<ConsultationCaseDetail> {
  const res = await api.post<ConsultationCaseDetail>(`/clinician/consultations/${caseId}/set-status/`, { status });
  invalidateCachedResource('clinician:consultations:');
  invalidateCachedResource('clinician:consultation-summary');
  return res.data;
}

export async function createLinkedAppointment(input: {
  patient: number;
  appointment_type: string;
  scheduled_date: string; // ISO
  duration_minutes?: number;
  reason?: string;
  consultation_case?: number | null;
}): Promise<any> {
  const res = await api.post('/clinician/appointments/', input);
  invalidateCachedResource('clinician:consultations:');
  invalidateCachedResource('clinician:consultation-summary');
  return res.data;
}

export async function createLinkedNote(input: {
  patient: number;
  note_type: string;
  content: string;
  consultation_case?: number | null;
}): Promise<any> {
  const res = await api.post('/clinician/clinical-notes/', input);
  invalidateCachedResource('clinician:consultations:');
  return res.data;
}

// ===============================
// Phase 5: Summary endpoints
// ===============================
export interface ClinicianConsultationSummary {
  unread_patient_replies: number;
  open_cases: number;
  awaiting_patient_cases: number;
  scheduled_followups: number;
  urgent_cases: number;
  high_priority_cases: number;
  total_actionable_cases: number;
}

export interface CareEscalationEvent {
  id: number;
  consultation_case: number;
  patient: number;
  patient_name: string;
  clinician: number;
  clinician_name: string;
  escalation_type: 'patient_reply_overdue' | 'clinician_response_overdue' | 'delivery_failure';
  severity: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  summary: string;
  due_at?: string | null;
  triggered_at: string;
  last_evaluated_at: string;
  resolved_at?: string | null;
  latest_notification?: number | null;
  latest_notification_status?: string | null;
}

export interface PatientCareTeamSummary {
  unread_clinician_messages: number;
  active_conversations: number;
  reply_requested_count: number;
  scheduled_followups: number;
  unresolved_followups: number;
  unread_notifications: number;
  latest_notification_title: string;
}

export async function fetchClinicianConsultationSummary(): Promise<ClinicianConsultationSummary> {
  return withCachedResource(
    'clinician:consultation-summary',
    10_000,
    async () => {
      const res = await api.get<ClinicianConsultationSummary>('/clinician/me/consultation-summary/');
      return res.data;
    },
    { persist: true }
  );
}

export async function fetchClinicianEscalations(params?: {
  severity?: 'low' | 'medium' | 'high' | 'urgent';
  type?: 'patient_reply_overdue' | 'clinician_response_overdue' | 'delivery_failure';
}): Promise<CareEscalationEvent[]> {
  const res = await api.get<{ results: CareEscalationEvent[] }>('/clinician/me/escalations/', { params } as any);
  const data: any = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results as CareEscalationEvent[];
  return [];
}

export async function updateClinicianEscalationAction(
  escalationId: number,
  action: 'acknowledge' | 'resolve'
): Promise<CareEscalationEvent> {
  const res = await api.post<CareEscalationEvent>(`/clinician/me/escalations/${escalationId}/action/`, { action });
  return res.data;
}

export async function fetchPatientCareTeamSummary(): Promise<PatientCareTeamSummary> {
  return withCachedResource(
    'patient:care-team-summary',
    10_000,
    async () => {
      const res = await api.get<PatientCareTeamSummary>('/clinician/patient/me/care-team-summary/');
      return res.data;
    },
    { persist: true }
  );
}

export interface CareNotification {
  id: number;
  consultation_case_id?: number | null;
  related_appointment_id?: number | null;
  notification_type: 'care_team_message' | 'follow_up_scheduled' | 'follow_up_resolved' | 'appointment_response_required' | 'reassessment_due' | 'follow_up_reminder';
  channel: 'in_app' | 'email' | 'sms';
  title: string;
  body: string;
  status: 'sent' | 'failed' | 'skipped';
  destination?: string;
  is_read: boolean;
  read_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
}

export async function fetchPatientCareNotifications(): Promise<CareNotification[]> {
  return withCachedResource(
    'patient:care-notifications',
    10_000,
    async () => {
      const res = await api.get<{ results: CareNotification[] }>('/clinician/patient/me/notifications/');
      return Array.isArray(res.data?.results) ? res.data.results : [];
    },
    { persist: true }
  );
}

export async function markPatientCareNotificationRead(notificationId: number): Promise<void> {
  await api.post(`/clinician/patient/me/notifications/${notificationId}/mark-read/`, {});
  invalidateCachedResource('patient:care-notifications');
  invalidateCachedResource('patient:care-team-summary');
}

export interface ClinicianRegistrationPayload {
  license_number: string;
  specialization: string;
  phone_number: string;
  qualification?: string;
  years_of_experience?: number | null;
  organization?: string;
  max_patients_per_day?: number | null;
  communication_modes?: string[];
  bio?: string;
  first_name?: string;
  last_name?: string;
}

export async function registerClinicianProfile(payload: ClinicianRegistrationPayload) {
  return api.post<ClinicianProfile>('/clinician/auth/register/', payload);
}

export async function patchClinicianProfile(payload: Partial<ClinicianRegistrationPayload>) {
  return api.patch<ClinicianProfile>('/clinician/auth/profile/', payload);
}

export async function listClinicianDocuments() {
  return api.get('/clinician/auth/documents/');
}

/** Multipart if `file` is set; otherwise JSON with `file_url`. */
export async function createClinicianDocumentJson(body: { document_type: string; file?: File; file_url?: string }) {
  if (body.file) {
    const fd = new FormData();
    fd.append('document_type', body.document_type);
    fd.append('file', body.file);
    return api.post('/clinician/auth/documents/', fd);
  }
  if (body.file_url?.trim()) {
    return api.post('/clinician/auth/documents/', {
      document_type: body.document_type,
      file_url: body.file_url.trim(),
    });
  }
  return Promise.reject(new Error('Provide a file or file_url for the document.'));
}

export type PostClinicianLoginOptions = {
  /** e.g. router state from ClinicianProtectedLayout redirect to login */
  from?: string | null;
};

/**
 * Where to send the user after clinician login / registration based on backend status.
 * Approved users default to the clinician dashboard (or restore `from` when it is a console route).
 */
export function getPostClinicianLoginPath(s: ClinicianAuthStatus, opts?: PostClinicianLoginOptions): string {
  if (!s.has_clinician_profile) {
    return '/clinician/register';
  }
  const from = opts?.from;
  if (
    from &&
    from.startsWith('/clinician/') &&
    !from.startsWith('/clinician/login') &&
    !from.startsWith('/clinician/register') &&
    // no pending route in simplified flow
    !from.startsWith('/clinician/pending')
  ) {
    return from;
  }
  return '/clinician/dashboard';
}

const RISK_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

export function riskRank(level: string | undefined): number {
  if (!level) return 0;
  return RISK_ORDER[level] ?? 0;
}

/** Default: highest risk first, then reassessment due, then review flags. */
export function sortPatientSummariesForPriority(rows: ClinicianPatientSummary[]): ClinicianPatientSummary[] {
  return [...rows].sort((a, b) => {
    const rd = riskRank(b.overall_risk_level) - riskRank(a.overall_risk_level);
    if (rd !== 0) return rd;
    if (Boolean(b.reassessment_due) !== Boolean(a.reassessment_due)) {
      return Number(b.reassessment_due) - Number(a.reassessment_due);
    }
    if (Boolean(b.high_risk_no_followup) !== Boolean(a.high_risk_no_followup)) {
      return Number(b.high_risk_no_followup) - Number(a.high_risk_no_followup);
    }
    if (Boolean(b.candidate_for_clinician_review) !== Boolean(a.candidate_for_clinician_review)) {
      return Number(b.candidate_for_clinician_review) - Number(a.candidate_for_clinician_review);
    }
    return a.patient_id - b.patient_id;
  });
}
