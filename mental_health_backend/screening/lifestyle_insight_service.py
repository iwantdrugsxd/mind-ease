from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from selfcare.models import MoodEntry

from .models import Patient


@dataclass(frozen=True)
class LifestyleSignal:
    key: str
    title: str
    severity: str
    summary: str
    recommendation: str


def _severity_rank(value: str) -> int:
    return {"low": 0, "medium": 1, "high": 2}.get(value, 0)


def _normalize_sleep_bucket(value: Any) -> str:
    if value is None:
        return "unknown"
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return "unknown"
    if numeric <= 5:
        return "short"
    if numeric <= 6:
        return "slightly_low"
    if numeric <= 8:
        return "healthy"
    return "high"


def _normalize_stress_bucket(value: Any) -> str:
    if value is None:
        return "unknown"
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return "unknown"
    if numeric >= 8:
        return "very_high"
    if numeric >= 6:
        return "elevated"
    if numeric >= 4:
        return "moderate"
    return "low"


def build_lifestyle_insight_summary(patient: Patient, state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic non-clinical lifestyle insight layer.

    This is informed by the external lifestyle research dataset but is intentionally kept separate from
    PHQ-9/GAD-7 risk and escalation logic. It should only shape supportive messaging and recommendation hints.
    """
    onboarding = state.get("onboarding") or {}
    baseline = onboarding.get("baseline") or {}
    activity = state.get("activity") or {}
    mood_trend = state.get("mood_trend") or {}
    recommendation = state.get("recommendation") or {}

    sleep_bucket = _normalize_sleep_bucket(baseline.get("sleep_quality_baseline"))
    stress_bucket = _normalize_stress_bucket(baseline.get("stress_level_baseline"))
    concerns = {str(item).strip().lower() for item in (baseline.get("main_concerns") or []) if item}
    mood_entries_30d = int(mood_trend.get("entry_count_30d") or 0)
    recent_avg_mood = mood_trend.get("recent_avg_mood")
    engagement_level = str(activity.get("engagement_level") or "unknown")
    completed_exercises = int(activity.get("completed_exercises") or 0)
    weekly_activity_count = int(activity.get("weekly_activity_count") or 0)

    signals: List[LifestyleSignal] = []

    if sleep_bucket == "short":
        signals.append(
            LifestyleSignal(
                key="sleep_strain",
                title="Sleep may be amplifying emotional strain",
                severity="high",
                summary="Short sleep is often associated with worse mood stability and higher stress sensitivity.",
                recommendation="Prioritize a short calming routine tonight and keep tomorrow's plan low-friction.",
            )
        )
    elif sleep_bucket == "slightly_low":
        signals.append(
            LifestyleSignal(
                key="sleep_consistency",
                title="Sleep consistency could help",
                severity="medium",
                summary="A slightly low sleep baseline can make anxiety and low mood feel heavier day to day.",
                recommendation="Use a breathing or wind-down exercise and avoid a demanding evening routine.",
            )
        )

    if stress_bucket == "very_high":
        signals.append(
            LifestyleSignal(
                key="stress_load",
                title="Stress load looks high",
                severity="high",
                summary="High stress frequently co-travels with lower wellbeing and more difficulty recovering between days.",
                recommendation="Choose a short decompression exercise before asking too much of yourself.",
            )
        )
    elif stress_bucket == "elevated":
        signals.append(
            LifestyleSignal(
                key="stress_buffer",
                title="Stress is worth buffering early",
                severity="medium",
                summary="Elevated stress can accumulate quietly before it becomes obvious in a formal screening.",
                recommendation="A brief breathing or grounding check-in is likely higher value than a long session.",
            )
        )

    if mood_entries_30d == 0:
        signals.append(
            LifestyleSignal(
                key="tracking_gap",
                title="You need more day-to-day signal",
                severity="medium",
                summary="Without regular mood tracking, it is harder to spot decline early and personalize recommendations.",
                recommendation="Use a one-minute mood check on the dashboard to improve trend quality.",
            )
        )
    elif mood_trend.get("trend_direction") == "declining":
        signals.append(
            LifestyleSignal(
                key="mood_decline",
                title="Recent mood trend is slipping",
                severity="high" if (recent_avg_mood or 0) <= 2.5 else "medium",
                summary="Your recent mood pattern suggests lower daily resilience than your earlier baseline.",
                recommendation="Stay close to short, repeatable exercises and consider opening Care Team if you want more support.",
            )
        )

    if completed_exercises == 0 and engagement_level in {"low", "unknown"}:
        signals.append(
            LifestyleSignal(
                key="activation_gap",
                title="A small activation step would help",
                severity="medium",
                summary="Low self-care engagement often leaves the system with fewer protective signals between screenings.",
                recommendation="Start with the shortest available exercise rather than waiting for a perfect window.",
            )
        )

    if {"sleep", "stress", "burnout", "motivation"}.intersection(concerns):
        signals.append(
            LifestyleSignal(
                key="baseline_concern_alignment",
                title="Your original concerns still matter",
                severity="low",
                summary="Your baseline concerns suggest lifestyle rhythm and recovery are likely meaningful parts of the picture.",
                recommendation="Keep recommendations tied to repeatable routines rather than occasional long sessions.",
            )
        )

    if weekly_activity_count >= 5 and completed_exercises >= 2:
        signals.append(
            LifestyleSignal(
                key="protective_routine",
                title="You already have protective routines",
                severity="low",
                summary="Consistent self-care and check-ins are strong signals for maintaining momentum over time.",
                recommendation="Stay consistent instead of escalating intensity too quickly.",
            )
        )

    top_signal = None
    if signals:
        top_signal = sorted(signals, key=lambda signal: _severity_rank(signal.severity), reverse=True)[0]

    recommendation_hints = {
        "prefer_short_form": any(signal.key in {"stress_load", "stress_buffer", "activation_gap"} for signal in signals),
        "prefer_sleep_support": any(signal.key in {"sleep_strain", "sleep_consistency"} for signal in signals),
        "prefer_mood_tracking": any(signal.key in {"tracking_gap", "mood_decline"} for signal in signals),
        "prefer_low_friction_selfcare": stress_bucket in {"very_high", "elevated"} or engagement_level == "low",
    }

    return {
        "version": 1,
        "top_signal": {
            "key": top_signal.key,
            "title": top_signal.title,
            "severity": top_signal.severity,
            "summary": top_signal.summary,
            "recommendation": top_signal.recommendation,
        } if top_signal else None,
        "signals": [
            {
                "key": signal.key,
                "title": signal.title,
                "severity": signal.severity,
                "summary": signal.summary,
                "recommendation": signal.recommendation,
            }
            for signal in signals[:4]
        ],
        "recommendation_hints": recommendation_hints,
        "supportive_copy": (
            top_signal.recommendation
            if top_signal
            else recommendation.get("message") or "Keep using short, repeatable habits to support your day-to-day mental health."
        ),
        "data_quality": {
            "has_baseline_sleep": baseline.get("sleep_quality_baseline") is not None,
            "has_baseline_stress": baseline.get("stress_level_baseline") is not None,
            "mood_entries_30d": mood_entries_30d,
        },
    }
