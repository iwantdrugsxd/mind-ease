from datetime import timedelta

from django.utils import timezone

from .models import CareEscalationEvent, CareNotification, CareOrchestrationPolicy, ConsultationCase
from .notification_service import send_patient_care_notification


def _severity_for_case(case: ConsultationCase, default: str = CareEscalationEvent.Severity.MEDIUM) -> str:
    if case.priority == "urgent":
        return CareEscalationEvent.Severity.URGENT
    if case.priority == "high":
        return CareEscalationEvent.Severity.HIGH
    return default


def get_active_policy() -> CareOrchestrationPolicy:
    policy = CareOrchestrationPolicy.objects.filter(is_active=True).order_by("-updated_at").first()
    if policy:
        return policy
    return CareOrchestrationPolicy.objects.create()


def _open_event(case: ConsultationCase, escalation_type: str, title: str, summary: str, severity: str, due_at=None, latest_notification=None):
    event = CareEscalationEvent.objects.filter(
        consultation_case=case,
        escalation_type=escalation_type,
        status__in=[CareEscalationEvent.Status.OPEN, CareEscalationEvent.Status.ACKNOWLEDGED],
    ).order_by("-triggered_at").first()
    created = event is None
    if created:
        event = CareEscalationEvent.objects.create(
            patient=case.patient,
            clinician=case.assigned_clinician,
            consultation_case=case,
            escalation_type=escalation_type,
            severity=severity,
            title=title,
            summary=summary,
            due_at=due_at,
            latest_notification=latest_notification,
        )
    if not created:
        event.patient = case.patient
        event.clinician = case.assigned_clinician
        event.severity = severity
        event.title = title
        event.summary = summary
        event.due_at = due_at
        event.latest_notification = latest_notification
        event.resolved_at = None
        if event.status == CareEscalationEvent.Status.RESOLVED:
            event.status = CareEscalationEvent.Status.OPEN
        event.save(update_fields=["patient", "clinician", "severity", "title", "summary", "due_at", "latest_notification", "resolved_at", "status", "last_evaluated_at"])
    return event


def _resolve_event(case: ConsultationCase, escalation_type: str):
    now = timezone.now()
    qs = CareEscalationEvent.objects.filter(
        consultation_case=case,
        escalation_type=escalation_type,
    ).exclude(status=CareEscalationEvent.Status.RESOLVED)
    for event in qs:
        event.status = CareEscalationEvent.Status.RESOLVED
        event.resolved_at = now
        event.save(update_fields=["status", "resolved_at", "last_evaluated_at"])


def evaluate_case_orchestration(case: ConsultationCase):
    now = timezone.now()
    policy = get_active_policy()

    if case.status in {"resolved", "closed"}:
        for escalation_type in CareEscalationEvent.EscalationType.values:
            _resolve_event(case, escalation_type)
        return

    # Patient has not replied after clinician outreach.
    patient_reply_hours = policy.patient_reply_overdue_hours_urgent if case.priority == "urgent" else (
        policy.patient_reply_overdue_hours_high if case.priority == "high" else policy.patient_reply_overdue_hours_default
    )
    reply_deadline = case.last_activity_at + timedelta(hours=patient_reply_hours)
    if case.status == "awaiting_patient" and case.last_activity_at <= now - timedelta(hours=patient_reply_hours):
        recent_nudge = case.notifications.filter(
            notification_type=CareNotification.NotificationType.FOLLOW_UP_REMINDER,
            channel=CareNotification.Channel.IN_APP,
            created_at__gte=now - timedelta(hours=policy.reminder_cooldown_hours),
        ).exists()
        if not recent_nudge:
            send_patient_care_notification(
                case=case,
                notification_type=CareNotification.NotificationType.FOLLOW_UP_REMINDER,
                title="Your care team is waiting for your reply",
                body="Your clinician is waiting for your response in Care Team. Reply when you are ready so they can continue your follow-up.",
                send_email_delivery=True,
                send_sms_delivery=policy.sms_for_urgent_reminders and case.priority == "urgent",
                email_subject="MindEase follow-up reminder",
                email_body="Your care team is waiting for your reply in MindEase. Open Care Team when you are ready to continue your follow-up.",
                sms_body="MindEase: Your care team is waiting for your reply. Open the app when you are ready.",
            )
        _open_event(
            case,
            CareEscalationEvent.EscalationType.PATIENT_REPLY_OVERDUE,
            "Patient reply overdue",
            "The patient has not replied within the follow-up reminder window.",
            _severity_for_case(case),
            due_at=reply_deadline,
        )
    else:
        _resolve_event(case, CareEscalationEvent.EscalationType.PATIENT_REPLY_OVERDUE)

    # Clinician owes response after patient reply.
    clinician_window = policy.clinician_response_overdue_hours_urgent if case.priority == "urgent" else (
        policy.clinician_response_overdue_hours_high if case.priority == "high" else policy.clinician_response_overdue_hours_default
    )
    clinician_deadline = case.last_activity_at + timedelta(hours=clinician_window)
    if case.status == "awaiting_clinician" and case.last_activity_at <= now - timedelta(hours=clinician_window):
        _open_event(
            case,
            CareEscalationEvent.EscalationType.CLINICIAN_RESPONSE_OVERDUE,
            "Clinician response overdue",
            "The patient replied and the case is waiting on clinician follow-up.",
            _severity_for_case(case, default=CareEscalationEvent.Severity.HIGH),
            due_at=clinician_deadline,
        )
    else:
        _resolve_event(case, CareEscalationEvent.EscalationType.CLINICIAN_RESPONSE_OVERDUE)

    # Outbound delivery failures on unresolved care loops.
    failed_delivery = case.notifications.exclude(channel=CareNotification.Channel.IN_APP).filter(status=CareNotification.DeliveryStatus.FAILED).order_by("-created_at").first()
    if failed_delivery:
        _open_event(
            case,
            CareEscalationEvent.EscalationType.DELIVERY_FAILURE,
            "Outbound care notification failed",
            "An email or SMS delivery attempt failed for this active follow-up.",
            _severity_for_case(case, default=CareEscalationEvent.Severity.MEDIUM),
            due_at=None,
            latest_notification=failed_delivery,
        )
    else:
        if policy.auto_resolve_delivery_failure_on_success:
            _resolve_event(case, CareEscalationEvent.EscalationType.DELIVERY_FAILURE)
