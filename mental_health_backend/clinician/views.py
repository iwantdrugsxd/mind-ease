import json
import time
from typing import Optional

from django.http import StreamingHttpResponse
from django.db import OperationalError, ProgrammingError
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Exists, OuterRef
from django.utils import timezone
from django.utils.formats import date_format

from .access import get_clinician_for_user, require_approved_clinician, require_clinician, require_consultation_case_for_clinician, require_consultation_thread_membership
from .models import Appointment, ClinicalNote, Clinician, ClinicianDocument, PatientAssignment, TreatmentPlan, ConsultationCase, ConsultationThread, ConsultationMessage, CareNotification, CareEscalationEvent, CareOrchestrationPolicy
from .permissions import IsApprovedClinician
from .serializers import (
    AppointmentSerializer,
    ClinicalNoteSerializer,
    ClinicianDocumentSerializer,
    ClinicianProfileSerializer,
    ClinicianProfileUpdateSerializer,
    ClinicianRegistrationSerializer,
    ClinicianSerializer,
    TreatmentPlanSerializer,
    ConsultationCaseListSerializer,
    ConsultationCaseDetailSerializer,
    ConsultationThreadSerializer,
    ConsultationMessageSerializer,
    PatientConsultationCaseListSerializer,
    PatientAssignmentSerializer,
    CareNotificationSerializer,
    CareEscalationEventSerializer,
    CareOrchestrationPolicySerializer,
)
from screening.scorecard_service import build_clinician_patient_summary
from screening.models import Patient
from .consultation_service import (
    _ensure_thread_for_case,
    backfill_high_risk_patients_to_all_clinicians,
    ensure_consultation_case_for_assignment,
)
from .notification_service import send_patient_care_notification
from .orchestration_service import evaluate_case_orchestration, get_active_policy
from .notification_service import retry_failed_notification


class ServerSentEventRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "event-stream"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


def _sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _stream_snapshot_events(snapshot_fn, channel: str, *, duration_seconds: int = 30, poll_seconds: int = 3):
    def event_iter():
        yield _sse_event("ready", {"channel": channel, "connected_at": timezone.now().isoformat()})
        previous = None
        heartbeat_every = max(1, int(12 / max(1, poll_seconds)))
        unchanged_cycles = 0
        deadline = time.monotonic() + duration_seconds
        while time.monotonic() < deadline:
            current = snapshot_fn()
            if current != previous:
                previous = current
                unchanged_cycles = 0
                yield _sse_event("update", current)
            else:
                unchanged_cycles += 1
                if unchanged_cycles >= heartbeat_every:
                    unchanged_cycles = 0
                    yield _sse_event("heartbeat", {"channel": channel, "ts": timezone.now().isoformat()})
            time.sleep(poll_seconds)

    response = StreamingHttpResponse(event_iter(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


def _ensure_consultation_cases_for_clinician(clinician: Clinician):
    backfill_high_risk_patients_to_all_clinicians()
    for assignment in PatientAssignment.objects.filter(clinician=clinician, is_active=True).select_related("patient"):
        case = ensure_consultation_case_for_assignment(clinician, assignment.patient)
        if case:
            evaluate_case_orchestration(case)


def _build_clinician_consultation_summary_payload(clinician: Clinician) -> dict:
    _ensure_consultation_cases_for_clinician(clinician)
    qs = ConsultationCase.objects.filter(assigned_clinician=clinician)
    total_open = qs.exclude(status__in=["resolved", "closed"]).count()
    awaiting_patient = qs.filter(status="awaiting_patient").count()
    scheduled = qs.filter(status="scheduled").count()
    urgent = qs.filter(priority__in=["high", "urgent"]).exclude(status__in=["resolved", "closed"]).count()
    unread = ConsultationThread.objects.filter(consultation_case__in=qs, clinician_unread_count__gt=0).count()
    high_priority = qs.filter(priority__in=["high", "urgent"]).count()
    actionable = qs.exclude(status__in=["resolved", "closed"]).filter(
        status__in=["open", "in_progress", "awaiting_clinician", "awaiting_patient", "scheduled"]
    ).count()
    latest_case = qs.order_by("-last_activity_at").values_list("last_activity_at", flat=True).first()
    latest_thread = (
        ConsultationThread.objects.filter(consultation_case__in=qs)
        .order_by("-last_message_at")
        .values_list("last_message_at", flat=True)
        .first()
    )
    return {
        "unread_patient_replies": unread,
        "open_cases": total_open,
        "awaiting_patient_cases": awaiting_patient,
        "scheduled_followups": scheduled,
        "urgent_cases": urgent,
        "high_priority_cases": high_priority,
        "total_actionable_cases": actionable,
        "latest_case_activity_at": latest_case.isoformat() if latest_case else None,
        "latest_thread_message_at": latest_thread.isoformat() if latest_thread else None,
    }


def _build_patient_care_team_summary_payload(patient: Optional[Patient]) -> dict:
    if not patient:
        return {
            "unread_clinician_messages": 0,
            "active_conversations": 0,
            "reply_requested_count": 0,
            "scheduled_followups": 0,
            "unresolved_followups": 0,
            "unread_notifications": 0,
            "latest_notification_title": "",
            "latest_case_activity_at": None,
            "latest_thread_message_at": None,
        }
    cases = ConsultationCase.objects.filter(patient=patient)
    active = cases.exclude(status__in=["closed"]).count()
    reply_requested = cases.filter(status="awaiting_patient").count()
    scheduled = cases.filter(status="scheduled").count()
    unresolved = cases.exclude(status__in=["resolved", "closed"]).count()
    unread = ConsultationThread.objects.filter(consultation_case__in=cases, patient_unread_count__gt=0).count()
    try:
        unread_notifications = CareNotification.objects.filter(
            patient=patient,
            recipient_role=CareNotification.RecipientRole.PATIENT,
            channel=CareNotification.Channel.IN_APP,
            is_read=False,
        ).count()
        latest_notification = CareNotification.objects.filter(
            patient=patient,
            recipient_role=CareNotification.RecipientRole.PATIENT,
            channel=CareNotification.Channel.IN_APP,
        ).order_by("-created_at").first()
    except (OperationalError, ProgrammingError):
        unread_notifications = 0
        latest_notification = None
    latest_case = cases.order_by("-last_activity_at").values_list("last_activity_at", flat=True).first()
    latest_thread = (
        ConsultationThread.objects.filter(consultation_case__in=cases)
        .order_by("-last_message_at")
        .values_list("last_message_at", flat=True)
        .first()
    )
    return {
        "unread_clinician_messages": unread,
        "active_conversations": active,
        "reply_requested_count": reply_requested,
        "scheduled_followups": scheduled,
        "unresolved_followups": unresolved,
        "unread_notifications": unread_notifications,
        "latest_notification_title": latest_notification.title if latest_notification else "",
        "latest_case_activity_at": latest_case.isoformat() if latest_case else None,
        "latest_thread_message_at": latest_thread.isoformat() if latest_thread else None,
    }


def _build_thread_event_payload(case: ConsultationCase) -> dict:
    case = ConsultationCase.objects.get(id=case.id)
    thread = getattr(case, "thread", None)
    if not thread:
        return {
            "case_id": case.id,
            "status": case.status,
            "last_activity_at": case.last_activity_at.isoformat() if case.last_activity_at else None,
            "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
            "thread_id": None,
            "last_message_at": None,
            "message_count": 0,
            "clinician_unread_count": 0,
            "patient_unread_count": 0,
        }
    thread = ConsultationThread.objects.get(id=thread.id)
    return {
        "case_id": case.id,
        "status": case.status,
        "last_activity_at": case.last_activity_at.isoformat() if case.last_activity_at else None,
        "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
        "thread_id": thread.id,
        "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
        "message_count": ConsultationMessage.objects.filter(thread=thread).count(),
        "clinician_unread_count": thread.clinician_unread_count,
        "patient_unread_count": thread.patient_unread_count,
    }


class ClinicianRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if Clinician.objects.filter(user=request.user).exists():
            return Response(
                {"detail": "A clinician profile already exists for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = ClinicianRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        first_name = (data.pop("first_name", None) or "").strip()
        last_name = (data.pop("last_name", None) or "").strip()
        if "communication_modes" not in data or data["communication_modes"] is None:
            data["communication_modes"] = []

        # Temporary: auto-approve new registrations (no manual review queue).
        clinician = Clinician.objects.create(
            user=request.user,
            status=Clinician.Status.APPROVED,
            **data,
        )
        if first_name:
            request.user.first_name = first_name
        if last_name:
            request.user.last_name = last_name
        if first_name or last_name:
            request.user.save(update_fields=["first_name", "last_name"])

        return Response(
            ClinicianProfileSerializer(clinician).data,
            status=status.HTTP_201_CREATED,
        )


class ClinicianAuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        clinician = get_clinician_for_user(request.user)
        if not clinician:
            return Response(
                {"detail": "No clinician profile for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ClinicianProfileSerializer(clinician).data)


class ClinicianAuthStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        clinician = get_clinician_for_user(request.user)
        if not clinician:
            return Response(
                {
                    "has_clinician_profile": False,
                    "status": None,
                    "is_approved": False,
                }
            )
        return Response(
            {
                "has_clinician_profile": True,
                "status": clinician.status,
                # True for pending + approved so clients route to the console; only rejected is blocked.
                "is_approved": clinician.status != Clinician.Status.REJECTED,
            }
        )


class ClinicianAuthProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        clinician = require_clinician(request.user)
        if clinician.status == Clinician.Status.REJECTED:
            return Response(
                {"detail": "Profile cannot be updated after rejection."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = ClinicianProfileUpdateSerializer(clinician, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ClinicianProfileSerializer(clinician).data)


class ClinicianDocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClinicianDocumentSerializer

    def get_queryset(self):
        c = get_clinician_for_user(self.request.user)
        if not c:
            return ClinicianDocument.objects.none()
        return ClinicianDocument.objects.filter(clinician=c)

    def perform_create(self, serializer):
        c = require_clinician(self.request.user)
        serializer.save(clinician=c)


class ClinicianViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ClinicianSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Clinician.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="patient-summaries")
    def patient_summaries(self, request):
        clinician = require_approved_clinician(request.user)
        assignments = PatientAssignment.objects.filter(clinician=clinician, is_active=True).select_related("patient")
        payload = [build_clinician_patient_summary(assignment.patient) for assignment in assignments]
        return Response({"results": payload})


class ConsultationCaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Clinician-facing consultation queue."""
    permission_classes = [IsAuthenticated, IsApprovedClinician]
    serializer_class = ConsultationCaseListSerializer

    def get_queryset(self):
        clinician = get_clinician_for_user(self.request.user)
        if not clinician:
            return ConsultationCase.objects.none()
        for assignment in PatientAssignment.objects.filter(clinician=clinician, is_active=True).select_related("patient"):
            ensure_consultation_case_for_assignment(clinician, assignment.patient)
        qs = ConsultationCase.objects.filter(assigned_clinician=clinician)
        status_param = self.request.query_params.get("status")
        prio_param = self.request.query_params.get("priority")
        patient_param = self.request.query_params.get("patient")
        if status_param:
            qs = qs.filter(status=status_param)
        if prio_param:
            qs = qs.filter(priority=prio_param)
        if patient_param:
            qs = qs.filter(patient_id=patient_param)
        for case in qs:
            evaluate_case_orchestration(case)
        return qs.order_by("-last_activity_at")

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        require_consultation_case_for_clinician(request.user, obj)
        data = ConsultationCaseDetailSerializer(obj).data
        return Response(data)

    @action(detail=False, methods=["post"], url_path="derive")
    def derive_cases(self, request):
        """Derive consultation cases for all active assignments of this clinician (idempotent)."""
        clinician = require_approved_clinician(request.user)
        created_or_updated = 0
        for assignment in PatientAssignment.objects.filter(clinician=clinician, is_active=True).select_related("patient"):
            case = ensure_consultation_case_for_assignment(clinician, assignment.patient)
            if case:
                created_or_updated += 1
        return Response({"updated": created_or_updated})

    @action(detail=True, methods=["get"], url_path="thread")
    def get_thread(self, request, pk=None):
        obj = self.get_object()
        require_consultation_case_for_clinician(request.user, obj)
        if not hasattr(obj, "thread"):
            return Response({"detail": "No thread for this case yet."}, status=200)
        return Response(ConsultationThreadSerializer(obj.thread).data)

    @action(detail=True, methods=["post"], url_path="messages")
    def post_message(self, request, pk=None):
        """Create a clinician message in the consultation thread (text-only)."""
        obj = self.get_object()
        require_consultation_case_for_clinician(request.user, obj)
        thread = getattr(obj, "thread", None)
        if not thread:
            return Response({"detail": "No thread exists for this case."}, status=status.HTTP_400_BAD_REQUEST)
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"detail": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)
        msg = ConsultationMessage.objects.create(
            thread=thread,
            sender_user=request.user,
            sender_type="clinician",
            content=content,
            message_type="text",
        )
        # Update thread meta
        thread.last_message_at = msg.created_at
        thread.last_message_preview = content[:280]
        thread.patient_unread_count = (thread.patient_unread_count or 0) + 1
        thread.save(update_fields=["last_message_at", "last_message_preview", "patient_unread_count"])
        obj.status = "awaiting_patient"
        obj.requires_follow_up = True
        obj.last_activity_at = timezone.now()
        obj.resolved_at = None
        obj.save(update_fields=["status", "requires_follow_up", "last_activity_at", "resolved_at"])
        evaluate_case_orchestration(obj)
        send_patient_care_notification(
            case=obj,
            notification_type=CareNotification.NotificationType.CARE_TEAM_MESSAGE,
            title="Your care team sent a new message",
            body="Open Care Team in MindEase to read the latest secure message from your clinician.",
            related_message=msg,
            send_email_delivery=True,
            send_sms_delivery=obj.priority == "urgent",
            email_subject="New message from your MindEase care team",
            email_body="You have a new secure message from your care team in MindEase. Sign in to Care Team to review it.",
            sms_body="MindEase: Your care team sent you a secure message. Open the app to review it.",
        )
        return Response(ConsultationMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="messages/(?P<message_id>[^/.]+)/mark-read")
    def mark_message_read(self, request, pk=None, message_id=None):
        obj = self.get_object()
        require_consultation_case_for_clinician(request.user, obj)
        try:
            msg = ConsultationMessage.objects.get(id=message_id, thread__consultation_case=obj)
        except ConsultationMessage.DoesNotExist:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        if not msg.is_read:
            msg.is_read = True
            msg.read_at = timezone.now()
            msg.save(update_fields=["is_read", "read_at"])
            # Adjust unread count
            t = msg.thread
            if t.clinician_unread_count and msg.sender_type == "patient":
                t.clinician_unread_count = max(0, t.clinician_unread_count - 1)
                t.save(update_fields=["clinician_unread_count"])
        evaluate_case_orchestration(obj)
        return Response({"ok": True})
    
    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        """Update consultation status explicitly (clinician-side)."""
        obj = self.get_object()
        require_consultation_case_for_clinician(request.user, obj)
        new_status = (request.data.get("status") or "").strip()
        allowed = {"open", "in_progress", "awaiting_clinician", "awaiting_patient", "scheduled", "resolved", "closed"}
        if new_status not in allowed:
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        obj.status = new_status
        obj.last_activity_at = now
        if new_status in {"resolved", "closed"}:
            obj.requires_follow_up = False
            obj.resolved_at = now
        else:
            obj.requires_follow_up = True
            obj.resolved_at = None
        obj.save(update_fields=["status", "requires_follow_up", "last_activity_at", "resolved_at"])
        if new_status in {"resolved", "closed"}:
            send_patient_care_notification(
                case=obj,
                notification_type=CareNotification.NotificationType.FOLLOW_UP_RESOLVED,
                title="Your follow-up has been marked resolved",
                body="Your care team marked this follow-up as resolved. If you still need support, you can reply in Care Team.",
                send_email_delivery=True,
                send_sms_delivery=False,
                email_subject="MindEase follow-up update",
                email_body="Your MindEase care team marked a recent follow-up as resolved. If you need more help, you can reply in Care Team.",
            )
        evaluate_case_orchestration(obj)
        return Response(ConsultationCaseDetailSerializer(obj).data)


class PatientConsultationThreadView(APIView):
    """Patient-facing access to a specific thread and patient replies."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"detail": "Patient identity not found"}, status=status.HTTP_400_BAD_REQUEST)
        case_id = request.query_params.get("case_id")
        if not case_id:
            return Response({"detail": "case_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            case = ConsultationCase.objects.get(id=case_id, patient=patient)
        except ConsultationCase.DoesNotExist:
            return Response({"detail": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
        thread = getattr(case, "thread", None)
        if not thread:
            return Response({"detail": "No thread for this case"}, status=status.HTTP_400_BAD_REQUEST)
        require_consultation_thread_membership(request.user, thread)
        return Response(ConsultationThreadSerializer(thread).data)

    def post(self, request):
        """Send a patient message into a thread for a given case_id."""
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"detail": "Patient identity not found"}, status=status.HTTP_400_BAD_REQUEST)
        case_id = request.data.get("case_id")
        content = (request.data.get("content") or "").strip()
        if not case_id or not content:
            return Response({"detail": "case_id and content are required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            case = ConsultationCase.objects.get(id=case_id, patient=patient)
        except ConsultationCase.DoesNotExist:
            return Response({"detail": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
        thread = getattr(case, "thread", None)
        if not thread:
            return Response({"detail": "No thread for this case"}, status=status.HTTP_400_BAD_REQUEST)
        # Membership check (patient)
        require_consultation_thread_membership(request.user, thread)
        msg = ConsultationMessage.objects.create(
            thread=thread,
            sender_user=request.user,
            sender_type="patient",
            content=content,
            message_type="text",
        )
        thread.last_message_at = msg.created_at
        thread.last_message_preview = content[:280]
        thread.clinician_unread_count = (thread.clinician_unread_count or 0) + 1
        thread.save(update_fields=["last_message_at", "last_message_preview", "clinician_unread_count"])
        case.status = "awaiting_clinician"
        case.requires_follow_up = True
        case.last_activity_at = timezone.now()
        case.resolved_at = None
        case.save(update_fields=["status", "requires_follow_up", "last_activity_at", "resolved_at"])
        evaluate_case_orchestration(case)
        return Response(ConsultationMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class PatientConsultationCaseListView(APIView):
    """Patient-facing list of their consultation cases."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"results": []})
        cases = ConsultationCase.objects.filter(patient=patient).order_by("-last_activity_at")
        for case in cases:
            evaluate_case_orchestration(case)
        data = PatientConsultationCaseListSerializer(cases, many=True).data
        return Response({"results": data})


class PatientCareNotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"results": []})
        qs = CareNotification.objects.filter(
            patient=patient,
            recipient_role=CareNotification.RecipientRole.PATIENT,
            channel=CareNotification.Channel.IN_APP,
        ).order_by("-created_at")
        return Response({"results": CareNotificationSerializer(qs, many=True).data})


class PatientCareNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id=None):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"detail": "Patient identity not found"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            notification = CareNotification.objects.get(
                id=notification_id,
                patient=patient,
                recipient_role=CareNotification.RecipientRole.PATIENT,
                channel=CareNotification.Channel.IN_APP,
            )
        except CareNotification.DoesNotExist:
            return Response({"detail": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
        return Response({"ok": True})


class IsDjangoStaffUser(BasePermission):
    """Internal ops only — not for patients or typical clinician JWT users."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_staff)


class StaffPatientAssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]
    serializer_class = PatientAssignmentSerializer
    queryset = PatientAssignment.objects.all().select_related(
        "patient", "clinician", "patient__user", "clinician__user"
    ).order_by("-assigned_at")


class StaffClinicianListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]
    serializer_class = ClinicianSerializer

    def get_queryset(self):
        return Clinician.objects.filter(
            status=Clinician.Status.APPROVED,
            is_active=True,
        ).select_related("user").order_by("user__first_name", "user__last_name", "id")


class StaffPatientAssignmentRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]
    serializer_class = PatientAssignmentSerializer
    queryset = PatientAssignment.objects.all().select_related(
        "patient", "clinician", "patient__user", "clinician__user"
    )


class StaffPatientAssignmentTransferView(APIView):
    """Deactivate other active assignments for the patient and ensure one active row for target clinician."""

    permission_classes = [IsAuthenticated, IsDjangoStaffUser]

    def post(self, request):
        patient_id = request.data.get("patient")
        to_clinician_id = request.data.get("to_clinician")
        notes = (request.data.get("notes") or "").strip()
        if not patient_id or not to_clinician_id:
            return Response(
                {"detail": "patient and to_clinician are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            to_clinician = Clinician.objects.get(id=to_clinician_id)
        except Clinician.DoesNotExist:
            return Response({"detail": "Clinician not found."}, status=status.HTTP_404_NOT_FOUND)

        PatientAssignment.objects.filter(patient=patient, is_active=True).update(is_active=False)
        row, _created = PatientAssignment.objects.get_or_create(
            patient=patient,
            clinician=to_clinician,
            defaults={"is_active": True, "notes": notes},
        )
        if not row.is_active:
            row.is_active = True
        if notes:
            row.notes = notes
        row.save(update_fields=["is_active", "notes"])
        return Response(PatientAssignmentSerializer(row).data, status=status.HTTP_201_CREATED)


class StaffOrphanedConsultationCaseListView(generics.ListAPIView):
    """
    Cases whose patient no longer has an active assignment to the case's assigned clinician.
    Useful when reassigning patients in admin without closing old cases.
    """

    permission_classes = [IsAuthenticated, IsDjangoStaffUser]
    serializer_class = ConsultationCaseListSerializer

    def get_queryset(self):
        active_for_pair = PatientAssignment.objects.filter(
            patient_id=OuterRef("patient_id"),
            clinician_id=OuterRef("assigned_clinician_id"),
            is_active=True,
        )
        return (
            ConsultationCase.objects.filter(~Exists(active_for_pair))
            .exclude(status__in=["closed", "resolved"])
            .select_related("patient", "assigned_clinician", "patient__user", "assigned_clinician__user")
            .prefetch_related("thread")
            .order_by("-last_activity_at")
        )


class ClinicianEscalationEventListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsApprovedClinician]
    serializer_class = CareEscalationEventSerializer

    def get_queryset(self):
        clinician = require_approved_clinician(self.request.user)
        cases = ConsultationCase.objects.filter(assigned_clinician=clinician).exclude(status__in=["resolved", "closed"])
        for case in cases:
            evaluate_case_orchestration(case)
        qs = CareEscalationEvent.objects.filter(clinician=clinician).exclude(status=CareEscalationEvent.Status.RESOLVED)
        severity = self.request.query_params.get("severity")
        escalation_type = self.request.query_params.get("type")
        if severity:
            qs = qs.filter(severity=severity)
        if escalation_type:
            qs = qs.filter(escalation_type=escalation_type)
        return qs.select_related("patient__user", "clinician__user", "latest_notification").order_by("-triggered_at")


class ClinicianEscalationEventActionView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedClinician]

    def post(self, request, escalation_id=None):
        clinician = require_approved_clinician(request.user)
        try:
            event = CareEscalationEvent.objects.get(id=escalation_id, clinician=clinician)
        except CareEscalationEvent.DoesNotExist:
            return Response({"detail": "Escalation not found."}, status=status.HTTP_404_NOT_FOUND)
        action_name = (request.data.get("action") or "").strip()
        if action_name not in {"acknowledge", "resolve"}:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)
        if action_name == "acknowledge":
            event.status = CareEscalationEvent.Status.ACKNOWLEDGED
            event.resolved_at = None
            event.save(update_fields=["status", "resolved_at", "last_evaluated_at"])
        else:
            event.status = CareEscalationEvent.Status.RESOLVED
            event.resolved_at = timezone.now()
            event.save(update_fields=["status", "resolved_at", "last_evaluated_at"])
        return Response(CareEscalationEventSerializer(event).data)


class StaffNotificationFailureListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]
    serializer_class = CareNotificationSerializer

    def get_queryset(self):
        return CareNotification.objects.exclude(channel=CareNotification.Channel.IN_APP).filter(
            status=CareNotification.DeliveryStatus.FAILED
        ).select_related("patient__user", "clinician__user", "consultation_case").order_by("-created_at")


class StaffNotificationFailureRetryView(APIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]

    def post(self, request, notification_id=None):
        try:
            notification = CareNotification.objects.get(id=notification_id)
        except CareNotification.DoesNotExist:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        notification = retry_failed_notification(notification)
        case = notification.consultation_case
        if case:
            evaluate_case_orchestration(case)
        return Response(CareNotificationSerializer(notification).data)


class StaffCareOrchestrationPolicyView(APIView):
    permission_classes = [IsAuthenticated, IsDjangoStaffUser]

    def get(self, request):
        return Response(CareOrchestrationPolicySerializer(get_active_policy()).data)

    def patch(self, request):
        active = get_active_policy()
        serializer = CareOrchestrationPolicySerializer(active, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PatientConsultationMessageReadView(APIView):
    """Patient-side message read acknowledgement inside own consultation thread."""
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id=None, message_id=None):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"detail": "Patient identity not found"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            case = ConsultationCase.objects.get(id=case_id, patient=patient)
        except ConsultationCase.DoesNotExist:
            return Response({"detail": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
        thread = getattr(case, "thread", None)
        if not thread:
            return Response({"detail": "No thread for this case"}, status=status.HTTP_400_BAD_REQUEST)
        require_consultation_thread_membership(request.user, thread)
        try:
            msg = ConsultationMessage.objects.get(id=message_id, thread=thread)
        except ConsultationMessage.DoesNotExist:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        if not msg.is_read:
            msg.is_read = True
            msg.read_at = timezone.now()
            msg.save(update_fields=["is_read", "read_at"])
            if thread.patient_unread_count and msg.sender_type in ("clinician", "system"):
                thread.patient_unread_count = max(0, thread.patient_unread_count - 1)
                thread.save(update_fields=["patient_unread_count"])
        return Response({"ok": True})
class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsApprovedClinician]

    def get_queryset(self):
        return Appointment.objects.filter(clinician__user=self.request.user).order_by("-scheduled_date")

    def perform_create(self, serializer):
        c = require_approved_clinician(self.request.user)
        appt = serializer.save(clinician=c)
        # If linked to a consultation case, update status to scheduled
        case = getattr(appt, "consultation_case", None)
        if case and case.assigned_clinician_id == c.id:
            case.status = "scheduled"
            case.requires_follow_up = True
            case.resolved_at = None
            case.last_activity_at = timezone.now()
            case.save(update_fields=["status", "requires_follow_up", "resolved_at", "last_activity_at"])
            thread = _ensure_thread_for_case(case)
            when = date_format(appt.scheduled_date, "SHORT_DATETIME_FORMAT")
            body = (
                f"A follow-up consultation has been scheduled for {when}. "
                "Your care team will share any details you need."
            )
            sys_msg = ConsultationMessage.objects.create(
                thread=thread,
                sender_user=None,
                sender_type="system",
                content=body,
                message_type="appointment_notice",
            )
            thread.last_message_at = sys_msg.created_at
            thread.last_message_preview = body[:280]
            thread.patient_unread_count = (thread.patient_unread_count or 0) + 1
            thread.save(
                update_fields=["last_message_at", "last_message_preview", "patient_unread_count"]
            )
            when = date_format(appt.scheduled_date, "SHORT_DATETIME_FORMAT")
            evaluate_case_orchestration(case)
            send_patient_care_notification(
                case=case,
                notification_type=CareNotification.NotificationType.FOLLOW_UP_SCHEDULED,
                title="A follow-up has been scheduled",
                body=f"Your care team scheduled a follow-up for {when}. Open Care Team for the latest details.",
                related_appointment=appt,
                send_email_delivery=True,
                send_sms_delivery=case.priority == "urgent" or appt.appointment_type == "crisis",
                email_subject="MindEase follow-up scheduled",
                email_body=f"Your MindEase care team scheduled a follow-up for {when}. Sign in to Care Team to review the details.",
                sms_body=f"MindEase: A follow-up has been scheduled for {when}. Open the app to review the details.",
            )


class TreatmentPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TreatmentPlanSerializer
    permission_classes = [IsAuthenticated, IsApprovedClinician]

    def get_queryset(self):
        return TreatmentPlan.objects.filter(clinician__user=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        c = require_approved_clinician(self.request.user)
        serializer.save(clinician=c)


class ClinicalNoteViewSet(viewsets.ModelViewSet):
    serializer_class = ClinicalNoteSerializer
    permission_classes = [IsAuthenticated, IsApprovedClinician]

    def get_queryset(self):
        return ClinicalNote.objects.filter(clinician__user=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        c = require_approved_clinician(self.request.user)
        note = serializer.save(clinician=c)
        case = getattr(note, "consultation_case", None)
        if case and case.assigned_clinician_id == c.id and case.status not in {"resolved", "closed"}:
            # adding a note means the case is actively being worked
            case.status = "in_progress"
            case.requires_follow_up = True
            case.resolved_at = None
            case.last_activity_at = timezone.now()
            case.save(update_fields=["status", "requires_follow_up", "resolved_at", "last_activity_at"])
            evaluate_case_orchestration(case)


class ClinicianConsultationSummaryView(APIView):
    """Role-specific summary for clinician console badges and stats."""
    permission_classes = [IsAuthenticated, IsApprovedClinician]

    def get(self, request):
        clinician = require_approved_clinician(request.user)
        return Response(_build_clinician_consultation_summary_payload(clinician))


class ClinicianConsultationEventsView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedClinician]
    renderer_classes = [ServerSentEventRenderer]

    def get(self, request):
        clinician = require_approved_clinician(request.user)
        return _stream_snapshot_events(
            lambda: _build_clinician_consultation_summary_payload(clinician),
            "clinician_consultation_summary",
        )


class ClinicianConsultationThreadEventsView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedClinician]
    renderer_classes = [ServerSentEventRenderer]

    def get(self, request, case_id=None):
        try:
            case = ConsultationCase.objects.get(id=case_id)
        except ConsultationCase.DoesNotExist:
            return Response({"detail": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
        require_consultation_case_for_clinician(request.user, case)
        return _stream_snapshot_events(
            lambda: _build_thread_event_payload(case),
            f"clinician_case_{case.id}_thread",
        )


class PatientCareTeamSummaryView(APIView):
    """Patient-side summary for Care Team badges and awareness."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if patient:
            for case in ConsultationCase.objects.filter(patient=patient).exclude(status__in=["resolved", "closed"]):
                evaluate_case_orchestration(case)
        return Response(_build_patient_care_team_summary_payload(patient))


class PatientCareTeamEventsView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [ServerSentEventRenderer]

    def get(self, request):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        return _stream_snapshot_events(
            lambda: _build_patient_care_team_summary_payload(patient),
            "patient_care_team_summary",
        )


class PatientConsultationThreadEventsView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [ServerSentEventRenderer]

    def get(self, request, case_id=None):
        from screening.identity import resolve_identity
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"detail": "Patient identity not found"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            case = ConsultationCase.objects.get(id=case_id, patient=patient)
        except ConsultationCase.DoesNotExist:
            return Response({"detail": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
        thread = getattr(case, "thread", None)
        if not thread:
            return Response({"detail": "No thread for this case"}, status=status.HTTP_400_BAD_REQUEST)
        require_consultation_thread_membership(request.user, thread)
        return _stream_snapshot_events(
            lambda: _build_thread_event_payload(case),
            f"patient_case_{case.id}_thread",
        )
