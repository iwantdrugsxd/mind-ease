from __future__ import annotations

from typing import Optional, Tuple
from django.utils import timezone
from django.db import transaction

from screening.scorecard_service import build_patient_scorecard
from screening.models import ScreeningAlert, Patient, PHQ9Screening, GAD7Screening
from .models import Clinician, ConsultationCase, ConsultationThread, PatientAssignment


def _derive_priority_from_scorecard(sc: dict) -> Tuple[str, str]:
    """Return (priority, reason) from scorecard data."""
    overall = sc.get("overall_risk_level") or "unknown"
    flags = sc.get("flags") or {}
    reassess = sc.get("reassessment_summary") or {}
    continuity = sc.get("continuity_summary") or {}

    # Deterministic minimal rules for MVP
    reason_bits = []
    if overall in ("critical", "high"):
        reason_bits.append(f"overall_risk_{overall}")
    if flags.get("clinician_followup_recommended"):
        reason_bits.append("clinician_followup_recommended")
    if flags.get("candidate_for_clinician_review"):
        reason_bits.append("candidate_for_review")
    if flags.get("high_risk_no_followup"):
        reason_bits.append("high_risk_no_followup")
    if reassess.get("reassessment_due"):
        reason_bits.append("reassessment_due")
    if continuity.get("engaged_but_worsening") or continuity.get("not_engaged_and_worsening"):
        reason_bits.append("worsening_trend")

    # Alerts
    # Note: caller should ensure patient is available; ScreeningAlert is scoped by patient only.
    # Presence of unresolved alerts prompts at least medium priority.
    priority = "low"
    if "overall_risk_critical" in reason_bits:
        priority = "urgent"
    elif "overall_risk_high" in reason_bits:
        priority = "high"
    elif "reassessment_due" in reason_bits or "worsening_trend" in reason_bits or "clinician_followup_recommended" in reason_bits:
        priority = "medium"
    elif reason_bits:
        priority = "medium"

    reason = ", ".join(reason_bits) if reason_bits else "monitoring"
    return priority, reason


@transaction.atomic
def auto_assign_high_risk_patient_to_all_clinicians(patient: Patient) -> int:
    """
    Temporary MVP behavior:
    assign a high/critical-risk patient to every active clinician account that can access
    the clinician console, then derive consultation cases for each of them.

    Returns the number of clinician assignments created or reactivated.
    """
    changed = 0
    clinicians = Clinician.objects.filter(is_active=True).exclude(status=Clinician.Status.REJECTED)
    for clinician in clinicians:
        assignment, created = PatientAssignment.objects.get_or_create(
            patient=patient,
            clinician=clinician,
            defaults={"is_active": True, "notes": "Auto-assigned from severe/high-risk screening."},
        )
        if created:
            changed += 1
        elif not assignment.is_active:
            assignment.is_active = True
            if not assignment.notes:
                assignment.notes = "Auto-assigned from severe/high-risk screening."
            assignment.save(update_fields=["is_active", "notes"])
            changed += 1
        ensure_consultation_case_for_assignment(clinician, patient)
    return changed


@transaction.atomic
def backfill_high_risk_patients_to_all_clinicians() -> int:
    """
    Temporary MVP backfill:
    ensure already-high-risk patients are assigned to every clinician too, not just
    newly submitted screenings after the feature was added.
    """
    patient_ids = set(
        PHQ9Screening.objects.filter(risk_level__in=["high", "critical"]).values_list("patient_id", flat=True)
    )
    patient_ids.update(
        GAD7Screening.objects.filter(risk_level__in=["high", "critical"]).values_list("patient_id", flat=True)
    )
    changed = 0
    for patient in Patient.objects.filter(id__in=patient_ids):
        changed += auto_assign_high_risk_patient_to_all_clinicians(patient)
    return changed


@transaction.atomic
def ensure_consultation_case_for_assignment(clinician: Clinician, patient: Patient) -> Optional[ConsultationCase]:
    """
    Derive consultation need from canonical scorecard signals and unresolved alerts.
    Deduplicate: at most one active system-created case per (patient, clinician).
    Returns a ConsultationCase if a new or existing active case is appropriate, otherwise None.
    """
    # Ensure assignment
    assignment = PatientAssignment.objects.filter(clinician=clinician, patient=patient, is_active=True).first()
    if not assignment:
        return None

    sc = build_patient_scorecard(patient)
    # Check alerts
    unresolved_alerts = ScreeningAlert.objects.filter(patient=patient, is_resolved=False).exists()

    priority, reason = _derive_priority_from_scorecard(sc)
    if unresolved_alerts and priority in ("low",):
        priority = "medium"
        reason = f"{reason}, unresolved_alerts"

    # If nothing suggests follow-up, do not create a case
    needs = priority in ("medium", "high", "urgent")
    if not needs:
        return None

    # Deduplicate: fetch active system-generated case if any
    active = ConsultationCase.objects.filter(
        patient=patient,
        assigned_clinician=clinician,
        created_by_system=True,
        status__in=["open", "in_progress", "awaiting_clinician", "awaiting_patient", "scheduled"],
    ).first()

    if active:
        # Update priority upward and touch activity
        rank = {"low": 0, "medium": 1, "high": 2, "urgent": 3}
        changed_fields = []
        if rank.get(priority, 0) > rank.get(active.priority, 0):
            active.priority = priority
            changed_fields.append("priority")
        if reason and reason not in (active.trigger_reason or ""):
            active.trigger_reason = f"{(active.trigger_reason or '').strip()} | {reason}".strip(" |")
            changed_fields.append("trigger_reason")
        if not active.requires_follow_up:
            active.requires_follow_up = True
            changed_fields.append("requires_follow_up")
        if changed_fields:
            active.save(update_fields=changed_fields)
        # Ensure thread exists
        _ensure_thread_for_case(active)
        return active

    # Create new case
    case = ConsultationCase.objects.create(
        patient=patient,
        assigned_clinician=clinician,
        assignment=assignment,
        source="scorecard_flag",
        trigger_reason=reason,
        priority=priority,
        status="open",
        created_by_system=True,
        requires_follow_up=True,
    )
    _ensure_thread_for_case(case)
    return case


def _ensure_thread_for_case(case: ConsultationCase) -> ConsultationThread:
    thread = getattr(case, "thread", None)
    if thread:
        return thread
    return ConsultationThread.objects.create(
        consultation_case=case,
        patient=case.patient,
        clinician=case.assigned_clinician,
        is_active=True,
    )
