from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppointmentViewSet,
    ClinicalNoteViewSet,
    ClinicianAuthMeView,
    ClinicianAuthProfileView,
    ClinicianAuthStatusView,
    ClinicianDocumentListCreateView,
    ClinicianRegistrationView,
    ClinicianViewSet,
    TreatmentPlanViewSet,
    ConsultationCaseViewSet,
    PatientConsultationThreadView,
    PatientConsultationCaseListView,
    PatientAppointmentResponseView,
    PatientConsultationMessageReadView,
    PatientConsultationThreadEventsView,
    PatientCareNotificationListView,
    PatientCareNotificationReadView,
    ClinicianConsultationSummaryView,
    ClinicianConsultationEventsView,
    ClinicianConsultationThreadEventsView,
    ClinicianEscalationEventListView,
    ClinicianEscalationEventActionView,
    PatientCareTeamSummaryView,
    PatientCareTeamEventsView,
    StaffClinicianListView,
    StaffPatientAssignmentListCreateView,
    StaffPatientAssignmentRetrieveUpdateView,
    StaffPatientAssignmentTransferView,
    StaffOrphanedConsultationCaseListView,
    StaffNotificationFailureListView,
    StaffNotificationFailureRetryView,
    StaffCareOrchestrationPolicyView,
)

router = DefaultRouter()
router.register(r'me', ClinicianViewSet, basename='clinician-me')
router.register(r'appointments', AppointmentViewSet, basename='clinician-appointments')
router.register(r'treatment-plans', TreatmentPlanViewSet, basename='clinician-treatment-plans')
router.register(r'clinical-notes', ClinicalNoteViewSet, basename='clinician-clinical-notes')
router.register(r'consultations', ConsultationCaseViewSet, basename='clinician-consultations')

urlpatterns = [
    path('auth/register/', ClinicianRegistrationView.as_view(), name='clinician-auth-register'),
    path('auth/me/', ClinicianAuthMeView.as_view(), name='clinician-auth-me'),
    path('auth/status/', ClinicianAuthStatusView.as_view(), name='clinician-auth-status'),
    path('auth/profile/', ClinicianAuthProfileView.as_view(), name='clinician-auth-profile'),
    path('auth/documents/', ClinicianDocumentListCreateView.as_view(), name='clinician-auth-documents'),
    # Summary endpoints
    path('me/consultation-summary/', ClinicianConsultationSummaryView.as_view(), name='clinician-consultation-summary'),
    path('me/consultation-events/', ClinicianConsultationEventsView.as_view(), name='clinician-consultation-events'),
    path('me/escalations/', ClinicianEscalationEventListView.as_view(), name='clinician-escalations'),
    path('me/escalations/<int:escalation_id>/action/', ClinicianEscalationEventActionView.as_view(), name='clinician-escalation-action'),
    path('patient/me/care-team-summary/', PatientCareTeamSummaryView.as_view(), name='patient-care-team-summary'),
    path('patient/me/care-team-events/', PatientCareTeamEventsView.as_view(), name='patient-care-team-events'),
    # Patient-side endpoints
    path('patient/me/consultations/', PatientConsultationCaseListView.as_view(), name='patient-consultations'),
    path('patient/me/consultations/thread/', PatientConsultationThreadView.as_view(), name='patient-consultation-thread'),
    path('patient/me/appointments/<int:appointment_id>/respond/', PatientAppointmentResponseView.as_view(), name='patient-appointment-respond'),
    path('patient/me/consultations/<int:case_id>/thread-events/', PatientConsultationThreadEventsView.as_view(), name='patient-consultation-thread-events'),
    path('patient/me/consultations/<int:case_id>/messages/<int:message_id>/mark-read/', PatientConsultationMessageReadView.as_view(), name='patient-consultation-message-read'),
    path('patient/me/notifications/', PatientCareNotificationListView.as_view(), name='patient-care-notifications'),
    path('patient/me/notifications/<int:notification_id>/mark-read/', PatientCareNotificationReadView.as_view(), name='patient-care-notification-read'),
    # Staff-only assignment operations (Django admin remains the primary MVP surface)
    path('internal/staff/clinicians/', StaffClinicianListView.as_view(), name='staff-clinicians'),
    path('internal/staff/assignments/', StaffPatientAssignmentListCreateView.as_view(), name='staff-assignments'),
    path('internal/staff/assignments/<int:pk>/', StaffPatientAssignmentRetrieveUpdateView.as_view(), name='staff-assignment-detail'),
    path('internal/staff/assignments/transfer/', StaffPatientAssignmentTransferView.as_view(), name='staff-assignment-transfer'),
    path(
        'internal/staff/consultation-cases/missing-assignment/',
        StaffOrphanedConsultationCaseListView.as_view(),
        name='staff-consultation-orphaned',
    ),
    path('internal/staff/notification-failures/', StaffNotificationFailureListView.as_view(), name='staff-notification-failures'),
    path('internal/staff/notification-failures/<int:notification_id>/retry/', StaffNotificationFailureRetryView.as_view(), name='staff-notification-failure-retry'),
    path('internal/staff/orchestration-policy/', StaffCareOrchestrationPolicyView.as_view(), name='staff-orchestration-policy'),
    path('consultations/<int:case_id>/thread-events/', ClinicianConsultationThreadEventsView.as_view(), name='clinician-consultation-thread-events'),
    path('', include(router.urls)),
]
