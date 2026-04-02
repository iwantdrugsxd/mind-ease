from django.contrib import admin

from .models import AlertResponse, Appointment, ClinicalNote, Clinician, ClinicianDocument, PatientAssignment, TreatmentPlan, ConsultationCase, ConsultationThread, ConsultationMessage, CareNotification, CareEscalationEvent, CareOrchestrationPolicy


@admin.register(Clinician)
class ClinicianAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "license_number",
        "specialization",
        "status",
        "is_active",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("status", "is_active")
    search_fields = ("license_number", "user__email", "user__username", "specialization")
    readonly_fields = ("created_at",)
    fields = (
        "user",
        "license_number",
        "specialization",
        "phone_number",
        "is_active",
        "status",
        "qualification",
        "years_of_experience",
        "organization",
        "max_patients_per_day",
        "communication_modes",
        "bio",
        "reviewed_at",
        "review_notes",
        "created_at",
    )


@admin.register(ClinicianDocument)
class ClinicianDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "clinician",
        "document_type",
        "verification_status",
        "uploaded_at",
        "reviewed_at",
    )
    list_filter = ("document_type", "verification_status")
    readonly_fields = ("uploaded_at",)
    fields = (
        "clinician",
        "document_type",
        "file",
        "file_url",
        "verification_status",
        "uploaded_at",
        "reviewed_at",
        "review_notes",
    )


admin.site.register(PatientAssignment)
admin.site.register(Appointment)
admin.site.register(TreatmentPlan)
admin.site.register(ClinicalNote)
admin.site.register(AlertResponse)


@admin.register(ConsultationCase)
class ConsultationCaseAdmin(admin.ModelAdmin):
	 list_display = (
		 "id",
		 "patient",
		 "assigned_clinician",
		 "priority",
		 "status",
		 "requires_follow_up",
		 "source",
		 "opened_at",
		 "last_activity_at",
	 )
	 list_filter = ("priority", "status", "source", "requires_follow_up")
	 search_fields = ("patient__user__email", "assigned_clinician__user__email", "trigger_reason")
	 readonly_fields = ("opened_at", "last_activity_at", "resolved_at")


@admin.register(ConsultationThread)
class ConsultationThreadAdmin(admin.ModelAdmin):
	 list_display = (
		 "id",
		 "consultation_case",
		 "patient",
		 "clinician",
		 "is_active",
		 "last_message_at",
		 "clinician_unread_count",
		 "patient_unread_count",
	 )
	 list_filter = ("is_active",)
	 search_fields = ("patient__user__email", "clinician__user__email")
	 readonly_fields = ("created_at", "updated_at", "last_message_at")


@admin.register(ConsultationMessage)
class ConsultationMessageAdmin(admin.ModelAdmin):
	 list_display = (
		 "id",
		 "thread",
		 "sender_type",
		 "message_type",
		 "is_read",
		 "created_at",
	 )
	 list_filter = ("sender_type", "message_type", "is_read")
	 search_fields = ("content",)
	 readonly_fields = ("created_at", "read_at")


@admin.register(CareNotification)
class CareNotificationAdmin(admin.ModelAdmin):
	 list_display = (
		 "id",
		 "patient",
		 "notification_type",
		 "channel",
		 "status",
		 "is_read",
		 "delivered_at",
		 "created_at",
	 )
	 list_filter = ("notification_type", "channel", "status", "is_read")
	 search_fields = ("patient__user__email", "title", "body", "destination")
	 readonly_fields = ("created_at", "updated_at", "delivered_at", "read_at")


@admin.register(CareEscalationEvent)
class CareEscalationEventAdmin(admin.ModelAdmin):
	 list_display = (
		 "id",
		 "consultation_case",
		 "escalation_type",
		 "severity",
		 "status",
		 "due_at",
		 "triggered_at",
		 "resolved_at",
	 )
	 list_filter = ("escalation_type", "severity", "status")
	 search_fields = ("patient__user__email", "clinician__user__email", "title", "summary")
	 readonly_fields = ("triggered_at", "last_evaluated_at", "resolved_at")


@admin.register(CareOrchestrationPolicy)
class CareOrchestrationPolicyAdmin(admin.ModelAdmin):
	 list_display = ("id", "name", "is_active", "updated_at")
	 list_filter = ("is_active",)
	 readonly_fields = ("created_at", "updated_at")
