"""
Patient Scorecard — read-only, presentation-oriented view over persisted data + canonical orchestration.

Phase III: continuity/mood summaries, reassessment urgency tier, clinician summary projection
(build_clinician_patient_summary) sharing one readonly orchestration pass with the patient scorecard.
GET must not create onboarding rows (use build_user_state_summary_readonly).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from .models import GAD7Screening, Patient, PHQ9Screening, ScreeningAlert
from .onboarding_service import _days_since, build_user_state_summary_readonly

_RISK_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
SCORECARD_VERSION = 3


def _reassessment_urgency_tier(reassess: Dict[str, Any]) -> str:
    """Deterministic urgency label for reassessment (orchestration-aligned)."""
    if reassess.get("reassessment_due"):
        pr = reassess.get("reassessment_priority") or "low"
        if pr == "high":
            return "urgent"
        if pr == "medium":
            return "due"
        return "routine_due"
    if reassess.get("reassessment_recommended_soon"):
        return "recommended_soon"
    return "not_due"


def _continuity_summary(
    state: Dict[str, Any],
    screening_trend_direction: str,
) -> Dict[str, Any]:
    """Phase III continuity — derived from readonly orchestration + screening trend only."""
    activity = state.get("activity") or {}
    readiness = state.get("readiness") or {}
    continuity = state.get("continuity") or {}
    mood = state.get("mood_trend") or {}
    engagement_level = activity.get("engagement_level") or "unknown"
    worsening_screening = screening_trend_direction == "worsening"
    has_started = bool(activity.get("has_started_selfcare"))
    engagement_decay = bool(activity.get("is_drifting") or readiness.get("needs_reengagement"))
    pathway_id = continuity.get("continue_pathway_id")
    reassess = state.get("reassessment") or {}
    selfcare_reentry_suggested = bool(
        has_started
        and (
            engagement_decay
            or reassess.get("reassessment_due")
            or (pathway_id and engagement_decay)
        )
    )
    engaged_but_worsening = bool(
        worsening_screening and engagement_level in ("medium", "high")
    )
    not_engaged_and_worsening = bool(
        worsening_screening
        and not has_started
        and engagement_level in ("low", "unknown", "")
    )
    mood_declining = mood.get("trend_direction") == "declining"
    return {
        "engagement_decay": engagement_decay,
        "selfcare_reentry_suggested": selfcare_reentry_suggested,
        "engaged_but_worsening": engaged_but_worsening,
        "not_engaged_and_worsening": not_engaged_and_worsening,
        "mood_declining": mood_declining,
        "continue_pathway_name": continuity.get("continue_pathway_name"),
        "short_reengagement_exercise_name": (continuity.get("short_reengagement_exercise") or {}).get("name"),
    }


def _screening_snapshot_phq9(row: Optional[PHQ9Screening]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return {
        "score": row.total_score,
        "severity_code": row.severity_level,
        "severity_label": row.get_severity_level_display(),
        "risk_level": row.risk_level,
        "created_at": row.created_at,
    }


def _screening_snapshot_gad7(row: Optional[GAD7Screening]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return {
        "score": row.total_score,
        "severity_code": row.severity_level,
        "severity_label": row.get_severity_level_display(),
        "risk_level": row.risk_level,
        "created_at": row.created_at,
    }


def _overall_risk(latest_phq: Optional[PHQ9Screening], latest_gad: Optional[GAD7Screening]) -> str:
    levels: List[str] = []
    if latest_phq:
        levels.append(latest_phq.risk_level)
    if latest_gad:
        levels.append(latest_gad.risk_level)
    if not levels:
        return "unknown"
    return max(levels, key=lambda x: _RISK_RANK.get(x, 0))


def _pair_delta_and_direction(model, patient: Patient) -> Tuple[Optional[int], Optional[str]]:
    rows = list(model.objects.filter(patient=patient).order_by("-created_at")[:2])
    if len(rows) < 2:
        return None, None
    latest, previous = rows[0], rows[1]
    delta = int(latest.total_score) - int(previous.total_score)
    if delta < 0:
        direction = "improving"
    elif delta > 0:
        direction = "worsening"
    else:
        direction = "stable"
    return delta, direction


def _combine_trend_direction(
    phq_n: int,
    gad_n: int,
    dir_phq: Optional[str],
    dir_gad: Optional[str],
) -> str:
    has_phq = phq_n >= 2 and dir_phq is not None
    has_gad = gad_n >= 2 and dir_gad is not None
    if not has_phq and not has_gad:
        return "unknown"
    if has_phq and not has_gad:
        return dir_phq  # type: ignore
    if has_gad and not has_phq:
        return dir_gad  # type: ignore
    if dir_phq == dir_gad:
        return dir_phq  # type: ignore
    return "mixed"


def _most_recent_instrument(
    latest_phq: Optional[PHQ9Screening],
    latest_gad: Optional[GAD7Screening],
) -> Optional[str]:
    if latest_phq and latest_gad:
        return "phq9" if latest_phq.created_at >= latest_gad.created_at else "gad7"
    if latest_phq:
        return "phq9"
    if latest_gad:
        return "gad7"
    return None


def build_patient_scorecard(
    patient: Patient,
    *,
    _cached_readonly_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Phase III scorecard: screening aggregates + canonical readonly orchestration slice.

    Pass _cached_readonly_state when the caller already computed build_user_state_summary_readonly(patient)
    to avoid duplicate work (e.g. clinician summary builder).
    """
    generated_at = timezone.now()

    latest_phq = PHQ9Screening.objects.filter(patient=patient).order_by("-created_at").first()
    latest_gad = GAD7Screening.objects.filter(patient=patient).order_by("-created_at").first()

    phq_n = PHQ9Screening.objects.filter(patient=patient).count()
    gad_n = GAD7Screening.objects.filter(patient=patient).count()
    screening_count = phq_n + gad_n

    last_times = [t for t in [latest_phq and latest_phq.created_at, latest_gad and latest_gad.created_at] if t]
    last_screening_at = max(last_times) if last_times else None

    delta_phq, dir_phq = _pair_delta_and_direction(PHQ9Screening, patient)
    delta_gad, dir_gad = _pair_delta_and_direction(GAD7Screening, patient)
    has_enough_trend = phq_n >= 2 or gad_n >= 2
    trend_direction = _combine_trend_direction(phq_n, gad_n, dir_phq, dir_gad)

    overall = _overall_risk(latest_phq, latest_gad)

    if _cached_readonly_state is not None:
        state = _cached_readonly_state
    else:
        try:
            state = build_user_state_summary_readonly(patient)
        except Exception:
            state = {}

    activity = state.get("activity") or {}
    reassess = state.get("reassessment") or {}
    nba = state.get("next_best_action") or {}
    rec = state.get("recommendation") or {}
    readiness = state.get("readiness") or {}
    mood_trend = state.get("mood_trend") or {}

    engagement_summary = {
        "completed_exercises": int(activity.get("completed_exercises") or 0),
        "recent_activity_count": int(activity.get("recent_activity_count") or 0),
        "engagement_level": activity.get("engagement_level") or "unknown",
        "streak_days": int(activity.get("streak_days") or 0),
        "last_activity_at": activity.get("last_activity_at"),
        "has_started_selfcare": bool(activity.get("has_started_selfcare")),
        "has_recent_mood_tracking": bool(activity.get("has_recent_mood_tracking")),
    }

    urgency_tier = _reassessment_urgency_tier(reassess)
    reassessment_summary = {
        "reassessment_due": bool(reassess.get("reassessment_due")),
        "reassessment_recommended_soon": bool(reassess.get("reassessment_recommended_soon")),
        "reassessment_priority": reassess.get("reassessment_priority"),
        "days_since_last_assessment": reassess.get("days_since_last_assessment"),
        "recommended_reassessment_type": reassess.get("recommended_reassessment_type"),
        "reason": reassess.get("reason"),
        "urgency_tier": urgency_tier,
    }

    next_best_action = {
        "action_type": nba.get("action_type"),
        "title": nba.get("title"),
        "description": nba.get("description"),
        "target_route": nba.get("target_route"),
        "urgency": nba.get("urgency"),
        "reason": nba.get("reason"),
    }

    requires_attention = bool(
        (latest_phq and latest_phq.requires_immediate_attention)
        or (latest_gad and latest_gad.requires_immediate_attention)
        or overall in ("high", "critical")
    )

    candidate_for_clinician_review = bool(readiness.get("candidate_for_clinician_review"))

    clinician_followup_recommended = bool(
        rec.get("clinician_priority")
        or candidate_for_clinician_review
        or (latest_phq and latest_phq.requires_teleconsult)
        or (latest_gad and latest_gad.requires_teleconsult)
    )

    flags = {
        "requires_attention": requires_attention,
        "clinician_followup_recommended": clinician_followup_recommended,
        "candidate_for_clinician_review": candidate_for_clinician_review,
        "reassessment_due": bool(reassess.get("reassessment_due")),
        "high_risk_no_followup": bool(readiness.get("high_risk_no_followup")),
        "is_drifting": bool(activity.get("is_drifting")),
    }

    continuity_summary = _continuity_summary(state, trend_direction)
    mood_summary = {
        "trend_direction": mood_trend.get("trend_direction"),
        "has_enough_data": bool(mood_trend.get("has_enough_data")),
    }

    return {
        "scorecard_version": SCORECARD_VERSION,
        "patient_id": patient.id,
        "generated_at": generated_at,
        "latest_phq9": _screening_snapshot_phq9(latest_phq),
        "latest_gad7": _screening_snapshot_gad7(latest_gad),
        "overall_risk_level": overall,
        "last_screening_at": last_screening_at,
        "screening_status": {
            "has_any_screening": screening_count > 0,
            "screening_count": screening_count,
            "most_recent_instrument": _most_recent_instrument(latest_phq, latest_gad),
            "days_since_last_screening": _days_since(last_screening_at),
        },
        "trend_summary": {
            "direction": trend_direction,
            "delta_phq9": delta_phq,
            "delta_gad7": delta_gad,
            "has_enough_data": has_enough_trend,
            "phq9_trend_direction": dir_phq,
            "gad7_trend_direction": dir_gad,
        },
        "mood_summary": mood_summary,
        "engagement_summary": engagement_summary,
        "continuity_summary": continuity_summary,
        "reassessment_summary": reassessment_summary,
        "next_best_action": next_best_action,
        "flags": flags,
    }


def build_clinician_patient_summary(patient: Patient) -> Dict[str, Any]:
    """
    Clinician assignment row: scorecard as canonical clinical core + consent-gated onboarding fields.
    Uses a single readonly orchestration pass shared with the scorecard payload.
    """
    try:
        state = build_user_state_summary_readonly(patient)
    except Exception:
        state = {}
    sc = build_patient_scorecard(patient, _cached_readonly_state=state)
    consented = bool((state.get("consent") or {}).get("clinician_access_opt_in"))
    onboarding = state.get("onboarding") or {}
    profile = onboarding.get("profile") or {}
    baseline = onboarding.get("baseline") or {}
    mood = state.get("mood_trend") or {}
    readiness = state.get("readiness") or {}

    high_risk_alerts = ScreeningAlert.objects.filter(patient=patient, is_resolved=False).count()

    nba = sc.get("next_best_action") or {}
    return {
        "patient_id": patient.id,
        "consented_for_clinician_access": consented,
        "preferred_name": (profile.get("preferred_name") or "") if consented else "",
        "baseline_concerns": (baseline.get("main_concerns") or []) if consented else [],
        "risk_level": sc["overall_risk_level"],
        "overall_risk_level": sc["overall_risk_level"],
        "mood_trend": mood.get("trend_direction"),
        "engagement_level": sc["engagement_summary"]["engagement_level"],
        "last_activity_at": sc["engagement_summary"]["last_activity_at"],
        "high_risk_alerts": high_risk_alerts,
        "candidate_for_clinician_review": bool(readiness.get("candidate_for_clinician_review")),
        "high_risk_no_followup": sc["flags"]["high_risk_no_followup"],
        "reassessment_due": sc["reassessment_summary"]["reassessment_due"],
        "reassessment_recommended_soon": sc["reassessment_summary"]["reassessment_recommended_soon"],
        "reassessment_priority": sc["reassessment_summary"]["reassessment_priority"],
        "reassessment_urgency_tier": sc["reassessment_summary"]["urgency_tier"],
        "latest_phq9": sc["latest_phq9"],
        "latest_gad7": sc["latest_gad7"],
        "trend_direction": sc["trend_summary"]["direction"],
        "days_since_last_screening": sc["screening_status"]["days_since_last_screening"],
        "last_screening_at": sc["last_screening_at"],
        "next_best_action": {
            "action_type": nba.get("action_type"),
            "title": nba.get("title"),
            "urgency": nba.get("urgency"),
        },
        "continuity_summary": sc.get("continuity_summary"),
        "flags": sc.get("flags"),
        "scorecard_version": sc["scorecard_version"],
    }
