"""
Clinician identity and approval gates for API access.
"""
from typing import Optional

from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied

from .models import Clinician
from screening.models import Patient


def get_clinician_for_user(user: User) -> Optional[Clinician]:
    if not user or not user.is_authenticated:
        return None
    return Clinician.objects.filter(user=user).first()


def require_clinician(user: User) -> Clinician:
    c = get_clinician_for_user(user)
    if not c:
        raise PermissionDenied("No clinician profile registered for this account.")
    return c


def require_approved_clinician(user: User) -> Clinician:
    """
    Simplified clinician gate for the current product:
    any existing clinician profile may access the clinician console and APIs.
    """
    return require_clinician(user)


# ===============================
# Phase 1: Consultation access helpers
# ===============================

def require_assigned_patient(clinician: Clinician, patient: Patient) -> None:
    """Ensure that patient is assigned to clinician (active assignment)."""
    from .models import PatientAssignment
    assigned = PatientAssignment.objects.filter(clinician=clinician, patient=patient, is_active=True).exists()
    if not assigned:
        raise PermissionDenied("You are not assigned to this patient.")


def require_consultation_case_for_clinician(user: User, case) -> None:
    """Ensure the logged-in clinician owns the consultation case (by assignment)."""
    c = require_approved_clinician(user)
    if case.assigned_clinician_id != c.id:
        raise PermissionDenied("You are not authorized to access this consultation case.")


def require_consultation_thread_membership(user: User, thread) -> None:
    """Ensure the logged-in user is either the patient user or the clinician user for the thread."""
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    # Patient side
    if hasattr(thread.patient, "user") and thread.patient.user_id == user.id:
        return
    # Clinician side
    if hasattr(thread.clinician, "user") and thread.clinician.user_id == user.id:
        return
    raise PermissionDenied("You are not a member of this consultation thread.")
