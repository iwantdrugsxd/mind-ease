from django.db import models
from django.contrib.auth.models import User
from screening.models import Patient, PHQ9Screening, GAD7Screening


class Clinician(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    license_number = models.CharField(max_length=100, unique=True)
    specialization = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    qualification = models.CharField(max_length=200, blank=True)
    years_of_experience = models.PositiveSmallIntegerField(null=True, blank=True)
    organization = models.CharField(max_length=200, blank=True)
    max_patients_per_day = models.PositiveSmallIntegerField(null=True, blank=True)
    communication_modes = models.JSONField(default=list, blank=True)
    bio = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    def __str__(self):
        return f"Dr. {self.user.first_name} {self.user.last_name}"


class ClinicianDocument(models.Model):
    class DocumentType(models.TextChoices):
        LICENSE_CERTIFICATE = "license_certificate", "License certificate"
        ID_PROOF = "id_proof", "ID proof"
        OTHER = "other", "Other"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=40, choices=DocumentType.choices)
    file = models.FileField(upload_to="clinician_documents/%Y/%m/", blank=True, null=True)
    file_url = models.URLField(max_length=500, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.clinician_id} {self.document_type}"


class PatientAssignment(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['patient', 'clinician']
    
    def __str__(self):
        return f"{self.patient} - {self.clinician}"


class ClinicianDashboard(models.Model):
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    date = models.DateField()
    
    # Aggregated data for the day
    total_patients = models.IntegerField(default=0)
    high_risk_patients = models.IntegerField(default=0)
    new_screenings = models.IntegerField(default=0)
    alerts_generated = models.IntegerField(default=0)
    teleconsults_scheduled = models.IntegerField(default=0)
    
    # Risk level breakdown
    low_risk_count = models.IntegerField(default=0)
    medium_risk_count = models.IntegerField(default=0)
    high_risk_count = models.IntegerField(default=0)
    critical_risk_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['clinician', 'date']
    
    def __str__(self):
        return f"Dashboard - {self.clinician} - {self.date}"


class PatientTrend(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    date = models.DateField()
    
    # PHQ-9 trends
    phq9_score = models.IntegerField(null=True, blank=True)
    phq9_severity = models.CharField(max_length=20, null=True, blank=True)
    
    # GAD-7 trends
    gad7_score = models.IntegerField(null=True, blank=True)
    gad7_severity = models.CharField(max_length=20, null=True, blank=True)
    
    # Mood indicators
    mood_level = models.IntegerField(null=True, blank=True)
    energy_level = models.IntegerField(null=True, blank=True)
    sleep_quality = models.IntegerField(null=True, blank=True)
    stress_level = models.IntegerField(null=True, blank=True)
    
    # Risk indicators
    risk_level = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ])
    
    # Engagement metrics
    exercises_completed = models.IntegerField(default=0)
    check_ins_completed = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['patient', 'date']
    
    def __str__(self):
        return f"Trend - {self.patient} - {self.date}"


class Appointment(models.Model):
    class PatientResponse(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    
    APPOINTMENT_TYPES = [
        ('initial', 'Initial Consultation'),
        ('follow_up', 'Follow-up'),
        ('teleconsult', 'Teleconsultation'),
        ('crisis', 'Crisis Intervention'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    consultation_case = models.ForeignKey('ConsultationCase', on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments')
    appointment_type = models.CharField(max_length=20, choices=APPOINTMENT_TYPES)
    scheduled_date = models.DateTimeField()
    duration_minutes = models.IntegerField(default=60)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    patient_response = models.CharField(
        max_length=20,
        choices=PatientResponse.choices,
        default=PatientResponse.PENDING,
        db_index=True,
    )
    patient_responded_at = models.DateTimeField(null=True, blank=True)
    
    # FHIR integration
    fhir_appointment_id = models.CharField(max_length=100, blank=True)
    fhir_patient_id = models.CharField(max_length=100, blank=True)
    fhir_practitioner_id = models.CharField(max_length=100, blank=True)
    
    # Notes
    reason = models.TextField(blank=True)
    clinician_notes = models.TextField(blank=True)
    patient_notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Appointment - {self.patient} - {self.scheduled_date}"


class TreatmentPlan(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    
    # Treatment details
    diagnosis = models.TextField()
    treatment_goals = models.TextField()
    recommended_interventions = models.TextField()
    medication_notes = models.TextField(blank=True)
    
    # Timeline
    start_date = models.DateField()
    review_date = models.DateField()
    is_active = models.BooleanField(default=True)
    
    # Progress tracking
    progress_notes = models.TextField(blank=True)
    last_reviewed = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Treatment Plan - {self.patient} - {self.start_date}"


class ClinicalNote(models.Model):
    NOTE_TYPES = [
        ('assessment', 'Assessment'),
        ('progress', 'Progress Note'),
        ('treatment', 'Treatment Note'),
        ('crisis', 'Crisis Note'),
        ('discharge', 'Discharge Note'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    consultation_case = models.ForeignKey('ConsultationCase', on_delete=models.SET_NULL, null=True, blank=True, related_name='notes')
    note_type = models.CharField(max_length=20, choices=NOTE_TYPES)
    content = models.TextField()
    
    # Associated screenings
    phq9_screening = models.ForeignKey(PHQ9Screening, on_delete=models.SET_NULL, null=True, blank=True)
    gad7_screening = models.ForeignKey(GAD7Screening, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Note - {self.patient} - {self.note_type} - {self.created_at}"


class AlertResponse(models.Model):
    alert = models.ForeignKey('screening.ScreeningAlert', on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    response = models.TextField()
    action_taken = models.CharField(max_length=100)
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Response - {self.alert} - {self.clinician}"


# ===============================
# Phase 1: Consultation domain
# ===============================

class ConsultationCase(models.Model):
    """Represents that a patient currently needs clinician attention."""
    SOURCE_CHOICES = [
        ("screening", "Screening"),
        ("chatbot", "Chatbot"),
        ("selfcare_drift", "Self-care drift"),
        ("scorecard_flag", "Scorecard flag"),
        ("manual", "Manual"),
    ]
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]
    STATUS_CHOICES = [
        ("open", "Open"),
        ("in_progress", "In progress"),
        ("awaiting_clinician", "Awaiting clinician"),
        ("awaiting_patient", "Awaiting patient"),
        ("scheduled", "Scheduled"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="consultation_cases")
    assigned_clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE, related_name="consultation_cases")
    assignment = models.ForeignKey(PatientAssignment, on_delete=models.SET_NULL, null=True, blank=True, related_name="consultation_cases")

    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default="scorecard_flag", db_index=True)
    trigger_reason = models.TextField(blank=True)
    priority = models.CharField(max_length=16, choices=PRIORITY_CHOICES, default="medium", db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open", db_index=True)

    created_by_system = models.BooleanField(default=True)
    requires_follow_up = models.BooleanField(default=True, db_index=True)
    opened_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["assigned_clinician", "status", "priority"]),
        ]
        constraints = [
            # Soft guard: prevent duplicate open system-generated cases per patient+clinician
            models.UniqueConstraint(
                fields=["patient", "assigned_clinician", "status", "created_by_system"],
                name="uniq_open_system_case_per_pair",
                condition=models.Q(status__in=["open", "in_progress", "awaiting_clinician", "awaiting_patient", "scheduled"], created_by_system=True),
            )
        ]

    def __str__(self):
        return f"ConsultationCase(p={self.patient_id}, c={self.assigned_clinician_id}, {self.status}, {self.priority})"


class ConsultationThread(models.Model):
    """Secure messaging channel between one clinician and one patient for one consultation case."""
    consultation_case = models.OneToOneField(ConsultationCase, on_delete=models.CASCADE, related_name="thread")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="consultation_threads")
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE, related_name="consultation_threads")
    is_active = models.BooleanField(default=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_message_preview = models.CharField(max_length=280, blank=True)
    clinician_unread_count = models.PositiveIntegerField(default=0)
    patient_unread_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Thread(case={self.consultation_case_id}, p={self.patient_id}, c={self.clinician_id})"


class ConsultationMessage(models.Model):
    """Individual messages in a consultation thread."""
    SENDER_TYPES = [
        ("clinician", "Clinician"),
        ("patient", "Patient"),
        ("system", "System"),
    ]
    MESSAGE_TYPES = [
        ("text", "Text"),
        ("system_notice", "System notice"),
        ("appointment_notice", "Appointment notice"),
        ("followup_notice", "Follow-up notice"),
    ]

    thread = models.ForeignKey(ConsultationThread, on_delete=models.CASCADE, related_name="messages")
    sender_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    sender_type = models.CharField(max_length=16, choices=SENDER_TYPES)
    content = models.TextField()
    message_type = models.CharField(max_length=32, choices=MESSAGE_TYPES, default="text")
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg(t={self.thread_id}, type={self.sender_type}, at={self.created_at})"


class CareNotification(models.Model):
    class NotificationType(models.TextChoices):
        CARE_TEAM_MESSAGE = "care_team_message", "Care team message"
        FOLLOW_UP_REMINDER = "follow_up_reminder", "Follow-up reminder"
        FOLLOW_UP_SCHEDULED = "follow_up_scheduled", "Follow-up scheduled"
        FOLLOW_UP_RESOLVED = "follow_up_resolved", "Follow-up resolved"
        APPOINTMENT_RESPONSE_REQUIRED = "appointment_response_required", "Appointment response required"
        REASSESSMENT_DUE = "reassessment_due", "Reassessment due"

    class Channel(models.TextChoices):
        IN_APP = "in_app", "In app"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    class RecipientRole(models.TextChoices):
        PATIENT = "patient", "Patient"
        CLINICIAN = "clinician", "Clinician"

    class DeliveryStatus(models.TextChoices):
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="care_notifications")
    clinician = models.ForeignKey(Clinician, on_delete=models.SET_NULL, null=True, blank=True, related_name="care_notifications")
    consultation_case = models.ForeignKey(ConsultationCase, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    related_message = models.ForeignKey(ConsultationMessage, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    related_appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    notification_type = models.CharField(max_length=40, choices=NotificationType.choices, db_index=True)
    channel = models.CharField(max_length=20, choices=Channel.choices, db_index=True)
    recipient_role = models.CharField(max_length=20, choices=RecipientRole.choices, default=RecipientRole.PATIENT, db_index=True)
    title = models.CharField(max_length=160)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.SENT, db_index=True)
    destination = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["patient", "recipient_role", "channel", "is_read"]),
            models.Index(fields=["consultation_case", "created_at"]),
        ]

    def __str__(self):
        return f"CareNotification(patient={self.patient_id}, type={self.notification_type}, channel={self.channel}, status={self.status})"


class CareEscalationEvent(models.Model):
    class EscalationType(models.TextChoices):
        PATIENT_REPLY_OVERDUE = "patient_reply_overdue", "Patient reply overdue"
        CLINICIAN_RESPONSE_OVERDUE = "clinician_response_overdue", "Clinician response overdue"
        DELIVERY_FAILURE = "delivery_failure", "Delivery failure"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="care_escalations")
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE, related_name="care_escalations")
    consultation_case = models.ForeignKey(ConsultationCase, on_delete=models.CASCADE, related_name="escalations")
    latest_notification = models.ForeignKey(CareNotification, on_delete=models.SET_NULL, null=True, blank=True, related_name="escalations")
    escalation_type = models.CharField(max_length=40, choices=EscalationType.choices, db_index=True)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    title = models.CharField(max_length=180)
    summary = models.TextField()
    due_at = models.DateTimeField(null=True, blank=True)
    triggered_at = models.DateTimeField(auto_now_add=True)
    last_evaluated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["clinician", "status", "severity"]),
            models.Index(fields=["escalation_type", "status"]),
        ]

    def __str__(self):
        return f"CareEscalationEvent(case={self.consultation_case_id}, type={self.escalation_type}, status={self.status})"


class CareOrchestrationPolicy(models.Model):
    name = models.CharField(max_length=120, default="Default policy")
    is_active = models.BooleanField(default=True, db_index=True)
    patient_reply_overdue_hours_default = models.PositiveIntegerField(default=24)
    patient_reply_overdue_hours_high = models.PositiveIntegerField(default=12)
    patient_reply_overdue_hours_urgent = models.PositiveIntegerField(default=4)
    clinician_response_overdue_hours_default = models.PositiveIntegerField(default=12)
    clinician_response_overdue_hours_high = models.PositiveIntegerField(default=4)
    clinician_response_overdue_hours_urgent = models.PositiveIntegerField(default=1)
    reminder_cooldown_hours = models.PositiveIntegerField(default=24)
    sms_for_urgent_reminders = models.BooleanField(default=True)
    auto_resolve_delivery_failure_on_success = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Care orchestration policy"
        verbose_name_plural = "Care orchestration policies"

    def __str__(self):
        return self.name
