from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (ClinicianViewSet, PatientAssignmentViewSet, ClinicianDashboardViewSet,
                   PatientTrendViewSet, AppointmentViewSet, TreatmentPlanViewSet,
                   ClinicalNoteViewSet, AlertResponseViewSet)

router = DefaultRouter()
router.register(r'clinicians', ClinicianViewSet)
router.register(r'assignments', PatientAssignmentViewSet)
router.register(r'dashboard', ClinicianDashboardViewSet)
router.register(r'patient-trends', PatientTrendViewSet)
router.register(r'appointments', AppointmentViewSet)
router.register(r'treatment-plans', TreatmentPlanViewSet)
router.register(r'clinical-notes', ClinicalNoteViewSet)
router.register(r'alert-responses', AlertResponseViewSet)

urlpatterns = [
    path('', include(router.urls)),
]









