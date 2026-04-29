from rest_framework import serializers
from .models import (
    Clinician,
    ClinicianDocument,
    PatientAssignment,
    ClinicianDashboard,
    PatientTrend,
    Appointment,
    TreatmentPlan,
    ClinicalNote,
    AlertResponse,
    ConsultationCase,
    ConsultationThread,
    ConsultationMessage,
    CareNotification,
    CareEscalationEvent,
    CareOrchestrationPolicy,
)
from screening.models import Patient, PHQ9Screening, GAD7Screening, ScreeningAlert
from django.contrib.auth.models import User
from screening.scorecard_service import build_clinician_patient_summary
from .access import get_clinician_for_user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class ClinicianSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Clinician
        fields = [
            'id',
            'user',
            'license_number',
            'specialization',
            'phone_number',
            'is_active',
            'created_at',
            'status',
            'qualification',
            'years_of_experience',
            'organization',
            'max_patients_per_day',
            'communication_modes',
            'bio',
            'reviewed_at',
            'review_notes',
        ]


class ClinicianRegistrationSerializer(serializers.Serializer):
    license_number = serializers.CharField(max_length=100)
    specialization = serializers.CharField(max_length=100)
    phone_number = serializers.CharField(max_length=20)
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    years_of_experience = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=80)
    organization = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    max_patients_per_day = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=500)
    communication_modes = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    bio = serializers.CharField(required=False, allow_blank=True, default='')
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_communication_modes(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list of mode strings.")
        return value


class ClinicianProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Clinician
        fields = [
            'id',
            'user',
            'license_number',
            'specialization',
            'phone_number',
            'is_active',
            'created_at',
            'status',
            'qualification',
            'years_of_experience',
            'organization',
            'max_patients_per_day',
            'communication_modes',
            'bio',
            'reviewed_at',
            'review_notes',
        ]


class ClinicianProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinician
        fields = [
            'specialization',
            'phone_number',
            'qualification',
            'years_of_experience',
            'organization',
            'max_patients_per_day',
            'communication_modes',
            'bio',
        ]

    def validate_communication_modes(self, value):
        if value is not None and not isinstance(value, list):
            raise serializers.ValidationError("Expected a list of mode strings.")
        return value


class ClinicianDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicianDocument
        fields = [
            'id',
            'document_type',
            'file',
            'file_url',
            'verification_status',
            'uploaded_at',
            'reviewed_at',
            'review_notes',
        ]
        read_only_fields = ['id', 'verification_status', 'uploaded_at', 'reviewed_at', 'review_notes']

    def validate(self, attrs):
        file = attrs.get('file')
        url = (attrs.get('file_url') or '').strip()
        if self.instance is None and not file and not url:
            raise serializers.ValidationError("Provide either file or file_url for a new document.")
        return attrs


class PatientAssignmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = PatientAssignment
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'assigned_at', 'is_active', 'notes']


class ClinicianDashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicianDashboard
        fields = ['id', 'clinician', 'date', 'total_patients', 'high_risk_patients',
                 'new_screenings', 'alerts_generated', 'teleconsults_scheduled',
                 'low_risk_count', 'medium_risk_count', 'high_risk_count',
                 'critical_risk_count', 'created_at']


class PatientTrendSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    
    class Meta:
        model = PatientTrend
        fields = ['id', 'patient', 'patient_name', 'date', 'phq9_score', 'phq9_severity',
                 'gad7_score', 'gad7_severity', 'mood_level', 'energy_level',
                 'sleep_quality', 'stress_level', 'risk_level', 'exercises_completed',
                 'check_ins_completed', 'created_at']


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        case = attrs.get('consultation_case') or getattr(self.instance, 'consultation_case', None)
        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        request = self.context.get('request')
        clinician = get_clinician_for_user(getattr(request, 'user', None)) if request else None
        if case:
            if patient and case.patient_id != patient.id:
                raise serializers.ValidationError({'consultation_case': 'Consultation case does not belong to the selected patient.'})
            if clinician and case.assigned_clinician_id != clinician.id:
                raise serializers.ValidationError({'consultation_case': 'You are not authorized to link this consultation case.'})
        return attrs
    
    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'appointment_type', 'scheduled_date', 'duration_minutes', 'status',
                 'patient_response', 'patient_responded_at',
                 'fhir_appointment_id', 'fhir_patient_id', 'fhir_practitioner_id',
                 'reason', 'clinician_notes', 'patient_notes', 'consultation_case', 'created_at',
                 'updated_at', 'completed_at']
        read_only_fields = ['id', 'clinician', 'patient_name', 'clinician_name', 'patient_responded_at', 'created_at', 'updated_at', 'completed_at']


class TreatmentPlanSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = TreatmentPlan
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'diagnosis', 'treatment_goals', 'recommended_interventions',
                 'medication_notes', 'start_date', 'review_date', 'is_active',
                 'progress_notes', 'last_reviewed', 'created_at', 'updated_at']


class ClinicalNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        case = attrs.get('consultation_case') or getattr(self.instance, 'consultation_case', None)
        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        request = self.context.get('request')
        clinician = get_clinician_for_user(getattr(request, 'user', None)) if request else None
        if case:
            if patient and case.patient_id != patient.id:
                raise serializers.ValidationError({'consultation_case': 'Consultation case does not belong to the selected patient.'})
            if clinician and case.assigned_clinician_id != clinician.id:
                raise serializers.ValidationError({'consultation_case': 'You are not authorized to link this consultation case.'})
        return attrs
    
    class Meta:
        model = ClinicalNote
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'note_type', 'content', 'phq9_screening', 'gad7_screening',
                 'consultation_case', 'created_at', 'updated_at']
        read_only_fields = ['id', 'clinician', 'patient_name', 'clinician_name', 'created_at', 'updated_at']


class AlertResponseSerializer(serializers.ModelSerializer):
    alert_type = serializers.CharField(source='alert.alert_type', read_only=True)
    patient_name = serializers.CharField(source='alert.patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = AlertResponse
        fields = ['id', 'alert', 'alert_type', 'patient_name', 'clinician',
                 'clinician_name', 'response', 'action_taken', 'follow_up_required',
                 'follow_up_date', 'created_at']


class PatientSummarySerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    patient_name = serializers.CharField()
    latest_phq9_score = serializers.IntegerField()
    latest_gad7_score = serializers.IntegerField()
    risk_level = serializers.CharField()
    last_screening_date = serializers.DateTimeField()
    exercises_completed = serializers.IntegerField()
    check_ins_completed = serializers.IntegerField()
    last_appointment = serializers.DateTimeField()
    requires_attention = serializers.BooleanField()


class DashboardStatsSerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    high_risk_patients = serializers.IntegerField()
    new_screenings_today = serializers.IntegerField()
    alerts_pending = serializers.IntegerField()
    appointments_today = serializers.IntegerField()
    risk_distribution = serializers.DictField()
    screening_trends = serializers.DictField()


# ===============================
# Phase 1: Consultation serializers
# ===============================

class ConsultationMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultationMessage
        fields = [
            'id',
            'thread',
            'sender_user',
            'sender_type',
            'content',
            'message_type',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'thread', 'sender_user', 'created_at', 'read_at', 'is_read']


class ConsultationThreadSerializer(serializers.ModelSerializer):
    messages = ConsultationMessageSerializer(many=True, read_only=True)
    pending_patient_appointment = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationThread
        fields = [
            'id',
            'consultation_case',
            'patient',
            'clinician',
            'is_active',
            'last_message_at',
            'last_message_preview',
            'clinician_unread_count',
            'patient_unread_count',
            'created_at',
            'updated_at',
            'messages',
            'pending_patient_appointment',
        ]
        read_only_fields = [
            'id',
            'consultation_case',
            'patient',
            'clinician',
            'last_message_at',
            'last_message_preview',
            'clinician_unread_count',
            'patient_unread_count',
            'created_at',
            'updated_at',
        ]

    def get_pending_patient_appointment(self, obj):
        appointment = Appointment.objects.filter(
            consultation_case=obj.consultation_case,
            patient=obj.patient,
            clinician=obj.clinician,
            status="scheduled",
            patient_response=Appointment.PatientResponse.PENDING,
        ).order_by("scheduled_date").first()
        if not appointment:
            return None
        return {
            "id": appointment.id,
            "appointment_type": appointment.appointment_type,
            "scheduled_date": appointment.scheduled_date,
            "duration_minutes": appointment.duration_minutes,
            "status": appointment.status,
            "patient_response": appointment.patient_response,
            "reason": appointment.reason,
        }


class CareNotificationSerializer(serializers.ModelSerializer):
    consultation_case_id = serializers.IntegerField(source="consultation_case.id", read_only=True)
    related_appointment_id = serializers.IntegerField(source="related_appointment.id", read_only=True)

    class Meta:
        model = CareNotification
        fields = [
            "id",
            "consultation_case_id",
            "related_appointment_id",
            "notification_type",
            "channel",
            "title",
            "body",
            "status",
            "destination",
            "is_read",
            "read_at",
            "delivered_at",
            "created_at",
        ]
        read_only_fields = fields


class CareEscalationEventSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.user.get_full_name", read_only=True)
    clinician_name = serializers.CharField(source="clinician.user.get_full_name", read_only=True)
    latest_notification_status = serializers.CharField(source="latest_notification.status", read_only=True)

    class Meta:
        model = CareEscalationEvent
        fields = [
            "id",
            "consultation_case",
            "patient",
            "patient_name",
            "clinician",
            "clinician_name",
            "escalation_type",
            "severity",
            "status",
            "title",
            "summary",
            "due_at",
            "triggered_at",
            "last_evaluated_at",
            "resolved_at",
            "latest_notification",
            "latest_notification_status",
        ]
        read_only_fields = fields


class CareOrchestrationPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareOrchestrationPolicy
        fields = [
            "id",
            "name",
            "is_active",
            "patient_reply_overdue_hours_default",
            "patient_reply_overdue_hours_high",
            "patient_reply_overdue_hours_urgent",
            "clinician_response_overdue_hours_default",
            "clinician_response_overdue_hours_high",
            "clinician_response_overdue_hours_urgent",
            "reminder_cooldown_hours",
            "sms_for_urgent_reminders",
            "auto_resolve_delivery_failure_on_success",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConsultationCaseListSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='assigned_clinician.user.get_full_name', read_only=True)
    thread_id = serializers.IntegerField(source='thread.id', read_only=True)
    last_message_at = serializers.DateTimeField(source='thread.last_message_at', read_only=True)
    unread_for_clinician = serializers.IntegerField(source='thread.clinician_unread_count', read_only=True)
    unread_for_patient = serializers.IntegerField(source='thread.patient_unread_count', read_only=True)
    last_message_preview = serializers.CharField(source='thread.last_message_preview', read_only=True)
    patient_summary = serializers.SerializerMethodField()
    next_appointment_at = serializers.SerializerMethodField()
    next_appointment_status = serializers.SerializerMethodField()
    notification_count = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationCase
        fields = [
            'id',
            'patient',
            'patient_name',
            'assigned_clinician',
            'clinician_name',
            'source',
            'trigger_reason',
            'priority',
            'status',
            'requires_follow_up',
            'opened_at',
            'last_activity_at',
            'resolved_at',
            'thread_id',
            'last_message_at',
            'unread_for_clinician',
            'unread_for_patient',
            'last_message_preview',
            'next_appointment_at',
            'next_appointment_status',
            'notification_count',
            'patient_summary',
        ]

    def get_patient_summary(self, obj):
        summary_map = self.context.get("patient_summary_map") or {}
        cached = summary_map.get(obj.patient_id)
        if cached is not None:
            return cached
        return build_clinician_patient_summary(obj.patient)

    def _get_next_appointment(self, obj):
        prefetched = getattr(obj, "_prefetched_active_appointments", None)
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        try:
            return obj.appointments.filter(status__in=['scheduled', 'confirmed', 'in_progress']).order_by('scheduled_date').first()
        except Exception:
            return None

    def get_next_appointment_at(self, obj):
        appt = self._get_next_appointment(obj)
        return appt.scheduled_date if appt else None

    def get_next_appointment_status(self, obj):
        appt = self._get_next_appointment(obj)
        return appt.status if appt else None

    def get_notification_count(self, obj):
        prefetched = getattr(obj, "_prefetched_in_app_notifications", None)
        if prefetched is not None:
            return len(prefetched)
        try:
            return obj.notifications.filter(channel=CareNotification.Channel.IN_APP, recipient_role=CareNotification.RecipientRole.PATIENT).count()
        except Exception:
            return 0


class PatientConsultationCaseListSerializer(ConsultationCaseListSerializer):
    """
    Patient-facing consultation list: no clinician scorecard payload, no internal trigger codes,
    no peer-side unread counts.
    """

    care_preview = serializers.SerializerMethodField()

    class Meta(ConsultationCaseListSerializer.Meta):
        fields = [
            "id",
            "patient",
            "patient_name",
            "clinician_name",
            "priority",
            "status",
            "requires_follow_up",
            "opened_at",
            "last_activity_at",
            "resolved_at",
            "thread_id",
            "last_message_at",
            "unread_for_patient",
            "last_message_preview",
            "care_preview",
            "next_appointment_at",
            "next_appointment_status",
        ]

    def get_care_preview(self, obj):
        prev = (getattr(getattr(obj, "thread", None), "last_message_preview", None) or "").strip()
        if prev:
            return prev
        return "Your care team is here to support your follow-up."


class ConsultationCaseDetailSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='assigned_clinician.user.get_full_name', read_only=True)
    thread = ConsultationThreadSerializer(read_only=True)
    patient_summary = serializers.SerializerMethodField()
    appointment_count = serializers.SerializerMethodField()
    note_count = serializers.SerializerMethodField()
    most_recent_appointment = serializers.SerializerMethodField()
    next_appointment_at = serializers.SerializerMethodField()
    next_appointment_status = serializers.SerializerMethodField()
    most_recent_note_at = serializers.SerializerMethodField()
    notification_count = serializers.SerializerMethodField()
    unread_notification_count = serializers.SerializerMethodField()
    most_recent_notification_at = serializers.SerializerMethodField()
    latest_outbound_delivery_status = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationCase
        fields = [
            'id',
            'patient',
            'patient_name',
            'assigned_clinician',
            'clinician_name',
            'source',
            'trigger_reason',
            'priority',
            'status',
            'requires_follow_up',
            'opened_at',
            'last_activity_at',
            'resolved_at',
            'resolution_notes',
            'patient_summary',
            'appointment_count',
            'note_count',
            'most_recent_appointment',
            'most_recent_note_at',
            'next_appointment_at',
            'next_appointment_status',
            'notification_count',
            'unread_notification_count',
            'most_recent_notification_at',
            'latest_outbound_delivery_status',
            'thread',
        ]

    def get_patient_summary(self, obj):
        summary_map = self.context.get("patient_summary_map") or {}
        cached = summary_map.get(obj.patient_id)
        if cached is not None:
            return cached
        return build_clinician_patient_summary(obj.patient)

    def get_appointment_count(self, obj):
        prefetched = getattr(obj, "_prefetched_all_appointments", None)
        if prefetched is not None:
            return len(prefetched)
        try:
            return obj.appointments.count()
        except Exception:
            return 0

    def get_note_count(self, obj):
        prefetched = getattr(obj, "_prefetched_notes", None)
        if prefetched is not None:
            return len(prefetched)
        try:
            return obj.notes.count()
        except Exception:
            return 0

    def get_most_recent_appointment(self, obj):
        prefetched = getattr(obj, "_prefetched_all_appointments", None)
        if prefetched is not None:
            return prefetched[0].scheduled_date if prefetched else None
        try:
            appt = obj.appointments.order_by('-scheduled_date').first()
            return appt.scheduled_date if appt else None
        except Exception:
            return None

    def get_next_appointment_at(self, obj):
        prefetched = getattr(obj, "_prefetched_active_appointments", None)
        if prefetched is not None:
            return prefetched[0].scheduled_date if prefetched else None
        try:
            appt = obj.appointments.filter(status__in=['scheduled', 'confirmed', 'in_progress']).order_by('scheduled_date').first()
            return appt.scheduled_date if appt else None
        except Exception:
            return None

    def get_next_appointment_status(self, obj):
        prefetched = getattr(obj, "_prefetched_active_appointments", None)
        if prefetched is not None:
            return prefetched[0].status if prefetched else None
        try:
            appt = obj.appointments.filter(status__in=['scheduled', 'confirmed', 'in_progress']).order_by('scheduled_date').first()
            return appt.status if appt else None
        except Exception:
            return None

    def get_most_recent_note_at(self, obj):
        prefetched = getattr(obj, "_prefetched_notes", None)
        if prefetched is not None:
            return prefetched[0].created_at if prefetched else None
        try:
            note = obj.notes.order_by("-created_at").first()
            return note.created_at if note else None
        except Exception:
            return None

    def get_notification_count(self, obj):
        prefetched = getattr(obj, "_prefetched_in_app_notifications", None)
        if prefetched is not None:
            return len(prefetched)
        try:
            return obj.notifications.filter(channel=CareNotification.Channel.IN_APP, recipient_role=CareNotification.RecipientRole.PATIENT).count()
        except Exception:
            return 0

    def get_unread_notification_count(self, obj):
        prefetched = getattr(obj, "_prefetched_in_app_notifications", None)
        if prefetched is not None:
            return sum(1 for notification in prefetched if not notification.is_read)
        try:
            return obj.notifications.filter(
                channel=CareNotification.Channel.IN_APP,
                recipient_role=CareNotification.RecipientRole.PATIENT,
                is_read=False,
            ).count()
        except Exception:
            return 0

    def get_most_recent_notification_at(self, obj):
        prefetched = getattr(obj, "_prefetched_in_app_notifications", None)
        if prefetched is not None:
            return prefetched[0].created_at if prefetched else None
        try:
            notif = obj.notifications.filter(
                channel=CareNotification.Channel.IN_APP,
                recipient_role=CareNotification.RecipientRole.PATIENT,
            ).order_by("-created_at").first()
            return notif.created_at if notif else None
        except Exception:
            return None

    def get_latest_outbound_delivery_status(self, obj):
        prefetched = getattr(obj, "_prefetched_outbound_notifications", None)
        if prefetched is not None:
            return prefetched[0].status if prefetched else None
        try:
            notif = obj.notifications.exclude(channel=CareNotification.Channel.IN_APP).order_by("-created_at").first()
            return notif.status if notif else None
        except Exception:
            return None
