from typing import Any, Dict, Optional, Tuple

from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum

from .models import (
    Patient,
    PatientBaseline,
    PatientConsent,
    PatientOnboardingStatus,
    PatientPreferences,
    PatientProfile,
    PHQ9Screening,
    GAD7Screening,
    ScreeningAlert,
)
from .lifestyle_insight_service import build_lifestyle_insight_summary


def _ensure_records(patient: Patient) -> Tuple[PatientProfile, PatientBaseline, PatientConsent, PatientPreferences, PatientOnboardingStatus]:
    profile, _ = PatientProfile.objects.get_or_create(patient=patient)
    baseline, _ = PatientBaseline.objects.get_or_create(patient=patient)
    consent, _ = PatientConsent.objects.get_or_create(patient=patient)
    preferences, _ = PatientPreferences.objects.get_or_create(patient=patient)
    status, _ = PatientOnboardingStatus.objects.get_or_create(patient=patient)
    return profile, baseline, consent, preferences, status


def get_onboarding_summary_readonly(patient: Patient) -> Dict[str, Any]:
    """
    Same shape as get_onboarding_summary but never creates rows (read-only / idempotent).
    Used by Patient Scorecard and other GET-only aggregations.
    """
    profile = PatientProfile.objects.filter(patient=patient).first()
    baseline = PatientBaseline.objects.filter(patient=patient).first()
    consent = PatientConsent.objects.filter(patient=patient).first()
    preferences = PatientPreferences.objects.filter(patient=patient).first()
    status = PatientOnboardingStatus.objects.filter(patient=patient).first()
    return {
        "profile": {
            "preferred_name": profile.preferred_name if profile else "",
            "birth_year": profile.birth_year if profile else None,
            "gender": profile.gender if profile else "unspecified",
            "occupation": profile.occupation if profile else "",
            "city": profile.city if profile else "",
        },
        "baseline": {
            "mood_baseline": baseline.mood_baseline if baseline else None,
            "sleep_quality_baseline": baseline.sleep_quality_baseline if baseline else None,
            "stress_level_baseline": baseline.stress_level_baseline if baseline else None,
            "main_concerns": baseline.main_concerns if baseline else [],
            "goals": baseline.goals if baseline else [],
        },
        "consent": {
            "data_usage_consent_given": consent.data_usage_consent_given if consent else False,
            "data_usage_consent_at": consent.data_usage_consent_at if consent else None,
            "emergency_disclaimer_acknowledged": consent.emergency_disclaimer_acknowledged if consent else False,
            "emergency_disclaimer_acknowledged_at": consent.emergency_disclaimer_acknowledged_at if consent else None,
            "clinician_access_opt_in": consent.clinician_access_opt_in if consent else False,
            "consent_version": consent.consent_version if consent else "v1",
        },
        "preferences": {
            "preferred_time_of_day": preferences.preferred_time_of_day if preferences else "unspecified",
        },
        "status": {
            "account_step_completed": status.account_step_completed if status else False,
            "profile_step_completed": status.profile_step_completed if status else False,
            "baseline_step_completed": status.baseline_step_completed if status else False,
            "consent_step_completed": status.consent_step_completed if status else False,
            "assessment_offered": status.assessment_offered if status else False,
            "assessment_completed": status.assessment_completed if status else False,
            "advanced_step_completed": status.advanced_step_completed if status else False,
            "onboarding_completed_at": status.onboarding_completed_at if status else None,
            "onboarding_version": status.onboarding_version if status else "v1",
        },
    }


def get_onboarding_summary(patient: Patient) -> Dict[str, Any]:
    profile, baseline, consent, preferences, status = _ensure_records(patient)
    return {
        "profile": {
            "preferred_name": profile.preferred_name,
            "birth_year": profile.birth_year,
            "gender": profile.gender,
            "occupation": profile.occupation,
            "city": profile.city,
        },
        "baseline": {
            "mood_baseline": baseline.mood_baseline,
            "sleep_quality_baseline": baseline.sleep_quality_baseline,
            "stress_level_baseline": baseline.stress_level_baseline,
            "main_concerns": baseline.main_concerns,
            "goals": baseline.goals,
        },
        "consent": {
            "data_usage_consent_given": consent.data_usage_consent_given,
            "data_usage_consent_at": consent.data_usage_consent_at,
            "emergency_disclaimer_acknowledged": consent.emergency_disclaimer_acknowledged,
            "emergency_disclaimer_acknowledged_at": consent.emergency_disclaimer_acknowledged_at,
            "clinician_access_opt_in": consent.clinician_access_opt_in,
            "consent_version": consent.consent_version,
        },
        "preferences": {
            "preferred_time_of_day": preferences.preferred_time_of_day,
        },
        "status": {
            "account_step_completed": status.account_step_completed,
            "profile_step_completed": status.profile_step_completed,
            "baseline_step_completed": status.baseline_step_completed,
            "consent_step_completed": status.consent_step_completed,
            "assessment_offered": status.assessment_offered,
            "assessment_completed": status.assessment_completed,
            "advanced_step_completed": status.advanced_step_completed,
            "onboarding_completed_at": status.onboarding_completed_at,
            "onboarding_version": status.onboarding_version,
        },
    }


def update_profile(patient: Patient, data: Dict[str, Any]) -> Dict[str, Any]:
    profile, *_ = _ensure_records(patient)
    for field in ["preferred_name", "birth_year", "gender", "occupation", "city"]:
        if field in data:
            setattr(profile, field, data[field])
    profile.save()

    status = PatientOnboardingStatus.objects.get(patient=patient)
    status.profile_step_completed = True
    status.save(update_fields=["profile_step_completed"])
    return get_onboarding_summary(patient)


def update_baseline(patient: Patient, data: Dict[str, Any]) -> Dict[str, Any]:
    _, baseline, *_ = _ensure_records(patient)
    for field in ["mood_baseline", "sleep_quality_baseline", "stress_level_baseline", "main_concerns", "goals"]:
        if field in data:
            setattr(baseline, field, data[field])
    baseline.save()

    status = PatientOnboardingStatus.objects.get(patient=patient)
    status.baseline_step_completed = True
    status.save(update_fields=["baseline_step_completed"])
    return get_onboarding_summary(patient)


def update_consent(patient: Patient, data: Dict[str, Any]) -> Dict[str, Any]:
    _, _, consent, _, status = _ensure_records(patient)
    now = timezone.now()

    if "data_usage_consent_given" in data:
        val = bool(data["data_usage_consent_given"])
        consent.data_usage_consent_given = val
        if val and consent.data_usage_consent_at is None:
            consent.data_usage_consent_at = now

    if "emergency_disclaimer_acknowledged" in data:
        val = bool(data["emergency_disclaimer_acknowledged"])
        consent.emergency_disclaimer_acknowledged = val
        if val and consent.emergency_disclaimer_acknowledged_at is None:
            consent.emergency_disclaimer_acknowledged_at = now

    if "clinician_access_opt_in" in data:
        consent.clinician_access_opt_in = bool(data["clinician_access_opt_in"])

    if "consent_version" in data and data["consent_version"]:
        consent.consent_version = str(data["consent_version"])

    consent.save()

    # Mark step complete only if required consents are provided
    if consent.data_usage_consent_given and consent.emergency_disclaimer_acknowledged:
        status.consent_step_completed = True
        status.save(update_fields=["consent_step_completed"])

    return get_onboarding_summary(patient)


def update_preferences(patient: Patient, data: Dict[str, Any]) -> Dict[str, Any]:
    *_, preferences, status = _ensure_records(patient)
    if "preferred_time_of_day" in data and data["preferred_time_of_day"]:
        preferences.preferred_time_of_day = data["preferred_time_of_day"]
    preferences.save()

    status.advanced_step_completed = True
    status.save(update_fields=["advanced_step_completed"])
    return get_onboarding_summary(patient)


def mark_account_step_completed(patient: Patient) -> None:
    _, _, _, _, status = _ensure_records(patient)
    if not status.account_step_completed:
        status.account_step_completed = True
        status.save(update_fields=["account_step_completed"])


def offer_assessment(patient: Patient, offered: bool = True) -> Dict[str, Any]:
    _, _, _, _, status = _ensure_records(patient)
    status.assessment_offered = offered
    # Optional assessment semantics: explicit skip marks this step complete.
    if not offered:
        status.assessment_completed = True
        status.save(update_fields=["assessment_offered", "assessment_completed"])
    else:
        status.save(update_fields=["assessment_offered"])
    return get_onboarding_summary(patient)


def mark_assessment_completed(patient: Patient) -> Dict[str, Any]:
    _, _, _, _, status = _ensure_records(patient)
    status.assessment_completed = True
    status.save(update_fields=["assessment_completed"])
    return get_onboarding_summary(patient)


def complete_onboarding_if_ready(patient: Patient) -> Dict[str, Any]:
    _, _, _, _, status = _ensure_records(patient)
    # Advanced step is optional and does not block completion.
    if (
        status.account_step_completed
        and status.profile_step_completed
        and status.baseline_step_completed
        and status.consent_step_completed
    ):
        if status.onboarding_completed_at is None:
            status.onboarding_completed_at = timezone.now()
        status.save(update_fields=["onboarding_completed_at"])
    return get_onboarding_summary(patient)


def _latest_assessment(patient: Patient) -> Dict[str, Any]:
    latest_phq9 = PHQ9Screening.objects.filter(patient=patient).order_by("-created_at").first()
    latest_gad7 = GAD7Screening.objects.filter(patient=patient).order_by("-created_at").first()
    latest = None
    if latest_phq9 and latest_gad7:
        latest = latest_phq9 if latest_phq9.created_at >= latest_gad7.created_at else latest_gad7
    else:
        latest = latest_phq9 or latest_gad7

    return {
        "latest_phq9": latest_phq9,
        "latest_gad7": latest_gad7,
        "latest": latest,
    }


def _safe_activity_metrics(patient: Patient) -> Dict[str, Any]:
    now = timezone.now()
    recent_window_start = now - timedelta(days=14)
    prior_window_start = now - timedelta(days=28)
    metrics = {
        # Distinct exercises the user has completed at least once.
        "completed_exercises": 0,
        # Sum of completion durations (seconds -> minutes already stored in duration_actual).
        "total_minutes": 0,
        "recent_completed_exercises": 0,
        "exercise_catalog_count": 0,
        "selfcare_progress_count": 0,
        "recent_activity_count": 0,
        "last_activity_at": None,
        "engagement_level": "low",
        "streak_days": 0,
    }
    try:
        from selfcare.models import ExerciseCompletion, PatientSelfCareProgress, SelfCareExercise
        completions = ExerciseCompletion.objects.filter(patient=patient)
        metrics["exercise_catalog_count"] = SelfCareExercise.objects.filter(is_active=True).count()
        metrics["completed_exercises"] = completions.values_list("exercise_id", flat=True).distinct().count()
        metrics["total_minutes"] = completions.filter(duration_actual__isnull=False).aggregate(
            total=Sum("duration_actual")
        ).get("total") or 0
        metrics["recent_completed_exercises"] = completions.filter(completed_at__gte=recent_window_start).count()
        metrics["selfcare_progress_count"] = PatientSelfCareProgress.objects.filter(patient=patient).count()

        latest_completion = completions.order_by("-completed_at").first()
        if latest_completion:
            metrics["last_activity_at"] = latest_completion.completed_at

        recent_days = set(
            completions.filter(completed_at__gte=prior_window_start)
            .values_list("completed_at__date", flat=True)
        )
        metrics["streak_days"] = len(recent_days)
        metrics["recent_activity_count"] = metrics["recent_completed_exercises"]
    except Exception:
        pass

    if metrics["recent_completed_exercises"] >= 5:
        metrics["engagement_level"] = "high"
    elif metrics["recent_completed_exercises"] >= 2:
        metrics["engagement_level"] = "moderate"
    else:
        metrics["engagement_level"] = "low"
    return metrics


def _safe_mood_trend(patient: Patient) -> Dict[str, Any]:
    result = {
        "has_enough_data": False,
        "trend_direction": "unknown",
        "trend_score": 0.0,
        "recent_avg_mood": None,
        "prior_avg_mood": None,
        "entry_count_30d": 0,
    }
    try:
        from selfcare.models import MoodEntry
        now = timezone.now()
        recent_start = now - timedelta(days=14)
        prior_start = now - timedelta(days=28)
        entries_30 = MoodEntry.objects.filter(patient=patient, created_at__gte=prior_start).order_by("-created_at")
        result["entry_count_30d"] = entries_30.count()
        recent = entries_30.filter(created_at__gte=recent_start)
        prior = entries_30.filter(created_at__lt=recent_start)
        if recent.count() >= 2 and prior.count() >= 2:
            recent_avg = sum(e.mood_level for e in recent) / recent.count()
            prior_avg = sum(e.mood_level for e in prior) / prior.count()
            delta = round(recent_avg - prior_avg, 2)
            result["has_enough_data"] = True
            result["trend_score"] = delta
            result["recent_avg_mood"] = round(recent_avg, 2)
            result["prior_avg_mood"] = round(prior_avg, 2)
            if delta >= 0.4:
                result["trend_direction"] = "improving"
            elif delta <= -0.4:
                result["trend_direction"] = "declining"
            else:
                result["trend_direction"] = "stable"
    except Exception:
        pass
    return result


def _days_since(ts) -> Optional[int]:
    if not ts:
        return None
    return max((timezone.now() - ts).days, 0)


def _build_reassessment_status(
    latest,
    onboarding_complete: bool,
    mood_trend: Dict[str, Any],
    activity: Dict[str, Any],
) -> Dict[str, Any]:
    risk_level = getattr(latest, "risk_level", None) if latest else None
    last_at = getattr(latest, "created_at", None) if latest else None
    days = _days_since(last_at)

    due = False
    recommended_soon = False
    priority = "none"
    recommended_type = "phq9+gad7"
    reason = "not_required_yet"

    if latest is None:
        if onboarding_complete:
            due = False
            recommended_soon = True
            priority = "medium"
            reason = "onboarding_complete_without_assessment"
        else:
            priority = "low"
            reason = "onboarding_incomplete"
    elif risk_level in ("high", "critical"):
        if (days or 0) >= 7:
            due = True
            priority = "high"
            reason = "high_risk_recent_assessment_due"
        elif mood_trend.get("trend_direction") == "declining":
            due = True
            priority = "high"
            reason = "high_risk_declining_mood"
        elif activity.get("recent_activity_count", 0) == 0 and (days or 0) >= 3:
            due = True
            priority = "high"
            reason = "high_risk_low_followup"
        else:
            priority = "medium"
            reason = "monitor_high_risk"
    elif risk_level == "medium":
        if (days or 0) >= 14:
            due = True
            priority = "medium"
            reason = "moderate_risk_due"
        elif mood_trend.get("trend_direction") == "declining" and (days or 0) >= 10:
            due = True
            priority = "medium"
            reason = "moderate_declining_mood"
        else:
            priority = "low"
            reason = "monitor_moderate_risk"
    else:
        if (days or 0) >= 30:
            due = True
            priority = "low"
            reason = "routine_reassessment_due"
        elif mood_trend.get("trend_direction") == "declining" and (days or 0) >= 21:
            due = True
            priority = "medium"
            reason = "low_risk_declining_mood"

    return {
        "reassessment_due": due,
        "reassessment_recommended_soon": recommended_soon,
        "reassessment_priority": priority,
        "days_since_last_assessment": days,
        "recommended_reassessment_type": recommended_type,
        "reason": reason,
    }


def _build_continuity_signals(patient: Patient) -> Dict[str, Any]:
    signals = {
        "continue_pathway_id": None,
        "continue_pathway_name": None,
        "recommended_next_exercise_id": None,
        "recommended_next_exercise_name": None,
        "short_reengagement_exercise": None,
    }
    try:
        from selfcare.models import PatientSelfCareProgress, SelfCareExercise
        progress = PatientSelfCareProgress.objects.filter(patient=patient, is_completed=False).order_by("-started_at").first()
        if progress:
            signals["continue_pathway_id"] = progress.pathway_id
            signals["continue_pathway_name"] = progress.pathway.name
            if progress.current_exercise:
                signals["recommended_next_exercise_id"] = progress.current_exercise_id
                signals["recommended_next_exercise_name"] = progress.current_exercise.name
        short_ex = SelfCareExercise.objects.filter(is_active=True).order_by("duration_minutes").first()
        if short_ex:
            signals["short_reengagement_exercise"] = {
                "id": short_ex.id,
                "name": short_ex.name,
                "duration_minutes": short_ex.duration_minutes,
            }
    except Exception:
        pass
    return signals


def _build_next_best_action(summary: Dict[str, Any]) -> Dict[str, Any]:
    if not summary.get("onboarding_complete"):
        action = {
            "action_type": "resume_onboarding",
            "type": "resume_onboarding",
            "title": "Complete onboarding",
            "description": f"Continue from step: {summary.get('resume_step', 'profile')}.",
            "target_route": "/register",
            "urgency": "medium",
            "reason": "onboarding_incomplete",
        }
        return action

    reassessment = summary.get("reassessment", {})
    recommendation = summary.get("recommendation", {})
    activity = summary.get("activity", {})
    continuity = summary.get("continuity", {})
    risk = recommendation.get("risk_level", "low")

    if reassessment.get("reassessment_due"):
        action = {
            "action_type": "take_reassessment",
            "type": "take_reassessment",
            "title": "Take a follow-up assessment",
            "description": "A reassessment is due to keep your care plan current.",
            "target_route": "/screening",
            "urgency": "high" if reassessment.get("reassessment_priority") == "high" else "medium",
            "reason": reassessment.get("reason", "reassessment_due"),
        }
        return action

    if reassessment.get("reassessment_recommended_soon"):
        action = {
            "action_type": "plan_reassessment",
            "type": "plan_reassessment",
            "title": "Plan your first follow-up assessment",
            "description": "You have completed onboarding; a check-in screening is recommended soon.",
            "target_route": "/screening",
            "urgency": "low",
            "reason": reassessment.get("reason", "recommended_soon"),
        }
        return action

    if risk in ("high", "critical"):
        action = {
            "action_type": "seek_support",
            "type": "seek_support",
            "title": "Review support options",
            "description": "Your recent state suggests extra support may help right now.",
            "target_route": "/dashboard",
            "urgency": "high",
            "reason": "elevated_risk",
        }
        return action

    if activity.get("is_drifting"):
        short = continuity.get("short_reengagement_exercise", {})
        action = {
            "action_type": "reengage_short_exercise",
            "type": "reengage_short_exercise",
            "title": "Restart with a short session",
            "description": f"Try {short.get('name', 'a quick exercise')} to rebuild momentum.",
            "target_route": "/selfcare",
            "urgency": "medium",
            "reason": "low_engagement",
        }
        return action

    if continuity.get("continue_pathway_id"):
        action = {
            "action_type": "continue_pathway",
            "type": "continue_pathway",
            "title": "Continue your pathway",
            "description": f"Pick up where you left off in {continuity.get('continue_pathway_name')}.",
            "target_route": "/selfcare",
            "urgency": "low",
            "reason": "continuity",
        }
        return action

    if not activity.get("has_recent_mood_tracking", False):
        action = {
            "action_type": "log_mood",
            "type": "log_mood",
            "title": "Log your mood today",
            "description": "A quick mood check helps personalize your recommendations.",
            "target_route": "/selfcare",
            "urgency": "low",
            "reason": "missing_mood_tracking",
        }
        return action

    return {
        "action_type": "do_selfcare",
        "type": "do_selfcare",
        "title": "Complete a self-care exercise",
        "description": recommendation.get("next_action", "Take your next self-care session."),
        "target_route": "/selfcare",
        "urgency": "low",
        "reason": recommendation.get("recommendation_reason", "ongoing_care"),
    }


def _resume_step(status: Optional[PatientOnboardingStatus]) -> str:
    if status is None:
        return "account"
    if not status.account_step_completed:
        return "account"
    if not status.profile_step_completed:
        return "profile"
    if not status.baseline_step_completed:
        return "baseline"
    if not status.consent_step_completed:
        return "consent"
    if not status.assessment_completed and status.assessment_offered:
        return "assessment"
    if not status.onboarding_completed_at and not status.advanced_step_completed:
        return "advanced"
    return "complete"


def build_initial_recommendation(patient: Patient, *, readonly: bool = False) -> Dict[str, Any]:
    """
    Lightweight explicit rules for first-run recommendations.

    When readonly=True, loads baseline/consent/preferences without creating onboarding rows.
    Logic is otherwise identical to the mutating path.
    """
    if readonly:
        baseline = PatientBaseline.objects.filter(patient=patient).first()
        consent = PatientConsent.objects.filter(patient=patient).first()
        preferences = PatientPreferences.objects.filter(patient=patient).first()
    else:
        _, baseline, consent, preferences, _status_unused = _ensure_records(patient)

    assessment = _latest_assessment(patient)
    latest = assessment["latest"]
    mood_trend = _safe_mood_trend(patient)
    activity = _safe_activity_metrics(patient)

    risk_level = getattr(latest, "risk_level", "low") if latest else "low"
    severity = getattr(latest, "severity_level", "minimal") if latest else "minimal"
    concerns = (baseline.main_concerns or []) if baseline else []
    preferred_time = (preferences.preferred_time_of_day if preferences else None) or "unspecified"

    pathway_hint = "stress-support"
    exercise_type_hint = "mindfulness"
    next_action = "Take your first self-care session"
    emphasize_professional_support = False
    clinician_priority = False
    emphasize_consistency = False
    emphasize_reassessment = False
    escalation_messaging = False
    message = "Start with a short mindfulness session to build consistency."
    recommendation_reason = "starter"
    latest_assessment_at = getattr(latest, "created_at", None)

    if risk_level in ("high", "critical"):
        pathway_hint = "professional-support"
        exercise_type_hint = "breathing"
        next_action = "Review support options and consider professional help"
        emphasize_professional_support = True
        clinician_priority = bool(consent and consent.clinician_access_opt_in)
        escalation_messaging = True
        recommendation_reason = "high_risk"
        message = (
            "Your latest assessment suggests elevated distress. Prioritize support resources and "
            "consider reaching out to a mental health professional."
        )
    elif activity["engagement_level"] == "low" and activity["completed_exercises"] > 0:
        pathway_hint = "habit-building"
        exercise_type_hint = "breathing"
        next_action = "Re-start with a short 5-minute routine"
        emphasize_consistency = True
        recommendation_reason = "low_engagement"
        message = "Your activity has slowed recently. A short daily routine can help rebuild momentum."
    elif latest_assessment_at and latest_assessment_at < timezone.now() - timedelta(days=30):
        pathway_hint = "reassessment"
        exercise_type_hint = "mindfulness"
        next_action = "Take a reassessment to refresh your care plan"
        emphasize_reassessment = True
        recommendation_reason = "reassessment_due"
        message = "It has been a while since your last screening. A quick reassessment can improve recommendations."
    elif mood_trend["has_enough_data"] and mood_trend["trend_direction"] == "declining":
        pathway_hint = "mood-support"
        exercise_type_hint = "journaling"
        next_action = "Try mood support exercises and track your mood daily"
        recommendation_reason = "declining_mood"
        message = "Your recent mood trend suggests a dip. Focus on mood-support and regular check-ins."
    elif "sleep" in concerns or (baseline and baseline.sleep_quality_baseline in (1, 2)):
        pathway_hint = "sleep-support"
        exercise_type_hint = "breathing"
        next_action = "Start a sleep support pathway"
        recommendation_reason = "sleep_support"
        message = "A short evening breathing routine can help improve sleep quality."
    elif "stress" in concerns or (baseline and baseline.stress_level_baseline in (4, 5)):
        pathway_hint = "stress-support"
        exercise_type_hint = "breathing"
        next_action = "Try a stress reduction exercise"
        recommendation_reason = "stress_support"
        message = "Begin with breathing exercises to reduce stress quickly."
    elif "anxiety" in concerns:
        pathway_hint = "anxiety-support"
        exercise_type_hint = "mindfulness"
        next_action = "Start an anxiety management pathway"
        recommendation_reason = "anxiety_support"
        message = "Mindfulness and paced breathing are good first steps for anxiety."
    elif "motivation" in concerns or "mood" in concerns:
        pathway_hint = "mood-support"
        exercise_type_hint = "journaling"
        next_action = "Try a mood journaling exercise"
        recommendation_reason = "mood_support"
        message = "A brief journaling practice can help improve mood awareness."

    if preferred_time and preferred_time != "unspecified":
        message = f"{message} Your preferred time is {preferred_time}, so plan it then."

    return {
        "risk_level": risk_level,
        "severity_level": severity,
        "pathway_hint": pathway_hint,
        "exercise_type_hint": exercise_type_hint,
        "next_action": next_action,
        "emphasize_professional_support": emphasize_professional_support,
        "emphasize_consistency": emphasize_consistency,
        "emphasize_reassessment": emphasize_reassessment,
        "escalation_messaging": escalation_messaging,
        "clinician_priority": clinician_priority,
        "recommendation_reason": recommendation_reason,
        "message": message,
    }


def build_user_state_summary(patient: Patient, *, readonly: bool = False) -> Dict[str, Any]:
    """
    Full orchestration payload for dashboard and related surfaces.

    readonly=True: same computation rules without creating onboarding stub rows (GET-safe).
    """
    if readonly:
        onboarding = get_onboarding_summary_readonly(patient)
        status_obj = PatientOnboardingStatus.objects.filter(patient=patient).first()
        recommendation = build_initial_recommendation(patient, readonly=True)
    else:
        onboarding = get_onboarding_summary(patient)
        status_obj = PatientOnboardingStatus.objects.get(patient=patient)
        recommendation = build_initial_recommendation(patient)

    status_data = onboarding["status"]
    assessment = _latest_assessment(patient)
    latest = assessment["latest"]

    onboarding_complete = bool(status_data.get("onboarding_completed_at"))
    next_route = "/dashboard" if onboarding_complete else "/register"
    total_screenings = PHQ9Screening.objects.filter(patient=patient).count() + GAD7Screening.objects.filter(patient=patient).count()
    high_risk_alerts = ScreeningAlert.objects.filter(patient=patient, is_resolved=False).count()
    activity = _safe_activity_metrics(patient)
    mood_trend = _safe_mood_trend(patient)
    completed_exercises = activity["completed_exercises"]
    consent_obj = PatientConsent.objects.filter(patient=patient).first()
    clinician_access_opt_in = bool(getattr(consent_obj, "clinician_access_opt_in", False))
    no_recent_activity = activity["recent_activity_count"] == 0
    suggested_next_screening_at = None
    if getattr(latest, "created_at", None):
        suggested_next_screening_at = latest.created_at + timedelta(days=14)
    days_since_last_activity = _days_since(activity["last_activity_at"])
    has_started_selfcare = bool(activity.get("completed_exercises", 0) > 0 or activity.get("selfcare_progress_count", 0) > 0)
    has_recent_mood_tracking = bool(mood_trend.get("entry_count_30d", 0) > 0)
    weekly_activity_count = int(activity.get("recent_completed_exercises", 0)) + int(mood_trend.get("entry_count_30d", 0))
    # Avoid classifying brand-new/sparse users as drifting before they start engagement.
    is_drifting = bool(
        has_started_selfcare
        and (
            (days_since_last_activity is not None and days_since_last_activity >= 7)
            or (activity.get("engagement_level") == "low" and activity.get("recent_activity_count", 0) == 0)
        )
    )
    reassessment = _build_reassessment_status(latest, onboarding_complete, mood_trend, activity)
    continuity = _build_continuity_signals(patient)
    high_risk_no_followup = bool(
        recommendation.get("risk_level") in ("high", "critical")
        and (activity.get("recent_activity_count", 0) == 0)
        and (reassessment.get("days_since_last_assessment") or 0) >= 3
    )

    summary = {
        "has_patient": True,
        "patient": {
            "id": patient.id,
            "firebase_uid": patient.firebase_uid,
            "email": patient.user.email,
            "first_name": patient.user.first_name,
            "last_name": patient.user.last_name,
            "created_at": patient.created_at,
            "updated_at": patient.updated_at,
            "emergency_contact": patient.emergency_contact,
            "emergency_phone": patient.emergency_phone,
        },
        "onboarding_complete": onboarding_complete,
        "resume_step": _resume_step(status_obj),
        "next_route": next_route,
        "onboarding": onboarding,
        "consent": {
            "clinician_access_opt_in": clinician_access_opt_in,
        },
        "latest_assessment": {
            "has_assessment": latest is not None,
            "risk_level": getattr(latest, "risk_level", None),
            "severity_level": getattr(latest, "severity_level", None),
            "total_score": getattr(latest, "total_score", None),
            "created_at": getattr(latest, "created_at", None),
        },
        "recommendation": recommendation,
        "activity": {
            "last_activity_at": activity["last_activity_at"],
            "days_since_last_activity": days_since_last_activity,
            "recent_activity_count": activity["recent_activity_count"],
            "weekly_activity_count": weekly_activity_count,
            "engagement_level": activity["engagement_level"],
            "streak_days": activity["streak_days"],
            "no_recent_activity": no_recent_activity,
            "completed_exercises": activity.get("completed_exercises", 0),
            "total_minutes": activity.get("total_minutes", 0),
            "exercise_catalog_count": activity.get("exercise_catalog_count", 0),
            "has_started_selfcare": has_started_selfcare,
            "has_recent_mood_tracking": has_recent_mood_tracking,
            "is_drifting": is_drifting,
        },
        "reassessment": reassessment,
        "continuity": continuity,
        "mood_trend": mood_trend,
        "next_actions": {
            "suggested_next_screening_at": suggested_next_screening_at,
            "take_screening_now": (latest is None) or recommendation.get("emphasize_reassessment", False),
            "open_selfcare_now": True,
        },
        "recent_activity": [
            {
                "type": "screening",
                "label": f"Latest screening: {getattr(latest, 'risk_level', 'n/a') if latest else 'none'}",
                "timestamp": getattr(latest, "created_at", None),
            },
            {
                "type": "exercise",
                "label": f"Completed exercises: {completed_exercises}",
                "timestamp": activity["last_activity_at"],
            },
            {
                "type": "mood",
                "label": f"Mood trend: {mood_trend['trend_direction']}",
                "timestamp": None,
            },
        ],
        "dashboard_stats": {
            "total_screenings": total_screenings,
            "high_risk_alerts": high_risk_alerts,
            "completed_exercises": completed_exercises,
            "last_screening": getattr(latest, "created_at", None),
            "risk_level": recommendation.get("risk_level", "low"),
            "mood_trend_score": mood_trend["trend_score"],
            "mood_trend_direction": mood_trend["trend_direction"],
        },
        "readiness": {
            "candidate_for_guided_plan": bool(onboarding_complete and activity.get("engagement_level") == "high"),
            "candidate_for_clinician_review": bool(
                clinician_access_opt_in and recommendation.get("risk_level") in ("high", "critical")
            ),
            "high_engagement_user": bool(activity.get("engagement_level") == "high"),
            "high_risk_no_followup": high_risk_no_followup,
            "needs_reengagement": is_drifting,
        },
        "analytics": {
            "onboarding_complete": onboarding_complete,
            "has_assessment": latest is not None,
            "has_started_selfcare": has_started_selfcare,
            "reassessment_due": reassessment.get("reassessment_due"),
            "recommended_action_type": None,  # populated below
        },
    }
    summary["lifestyle_insights"] = build_lifestyle_insight_summary(patient, summary)
    next_best_action = _build_next_best_action(summary)
    summary["next_best_action"] = next_best_action
    summary["analytics"]["recommended_action_type"] = next_best_action.get("action_type")
    return summary


def build_user_state_summary_readonly(patient: Patient) -> Dict[str, Any]:
    """
    Orchestration snapshot without creating onboarding rows. Use from GET-only endpoints (e.g. scorecard).
    """
    return build_user_state_summary(patient, readonly=True)
