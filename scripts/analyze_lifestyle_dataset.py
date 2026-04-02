#!/usr/bin/env python3
"""
Offline analysis utility for the Mental_Health_and_Lifestyle_Research.csv dataset.

Purpose:
- understand coarse correlations that can inform recommendation design
- generate product-safe insight rules
- avoid using the dataset as a direct clinical diagnosis engine
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List


def load_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def normalize_status(value: str) -> str:
    raw = (value or "").strip().lower()
    if raw == "none":
        return "none"
    if "depression" in raw:
        return "depression"
    if "severe anxiety" in raw:
        return "severe_anxiety"
    if "moderate anxiety" in raw:
        return "moderate_anxiety"
    if "mild anxiety" in raw:
        return "mild_anxiety"
    return raw.replace(" ", "_")


def derive_buckets(row: Dict[str, str]) -> Dict[str, str]:
    sleep = float(row["Hours_of_Sleep"])
    stress = int(float(row["Stress_Level"]))
    activity = float(row["Physical_Activity"])
    screen = float(row["Screen_Time_per_Day"])
    wellbeing = int(float(row["Overall_Wellbeing_Score"]))

    if sleep <= 5:
        sleep_bucket = "sleep_short"
    elif sleep <= 6:
        sleep_bucket = "sleep_slightly_low"
    elif sleep <= 8:
        sleep_bucket = "sleep_healthy"
    else:
        sleep_bucket = "sleep_high"

    if stress >= 8:
        stress_bucket = "stress_very_high"
    elif stress >= 6:
        stress_bucket = "stress_elevated"
    elif stress >= 4:
        stress_bucket = "stress_moderate"
    else:
        stress_bucket = "stress_low"

    if activity < 15:
        activity_bucket = "activity_low"
    elif activity < 35:
        activity_bucket = "activity_medium"
    else:
        activity_bucket = "activity_high"

    if screen >= 8:
        screen_bucket = "screen_high"
    elif screen >= 5:
        screen_bucket = "screen_moderate"
    else:
        screen_bucket = "screen_low"

    if wellbeing <= 3:
        wellbeing_bucket = "wellbeing_low"
    elif wellbeing == 4:
        wellbeing_bucket = "wellbeing_mid"
    else:
        wellbeing_bucket = "wellbeing_high"

    return {
        "status": normalize_status(row["Mental_Health_Status"]),
        "sleep_bucket": sleep_bucket,
        "stress_bucket": stress_bucket,
        "activity_bucket": activity_bucket,
        "screen_bucket": screen_bucket,
        "social_bucket": f"social_{row['Social_Interaction_Freq'].strip().lower()}",
        "diet_bucket": f"diet_{row['Diet_Quality'].strip().lower().replace(' ', '_')}",
        "substance_bucket": f"substance_{row['Substance_Use'].strip().lower()}",
        "friends_bucket": "friends_yes" if row["Has_Close_Friends"].strip().lower() == "true" else "friends_no",
        "wellbeing_bucket": wellbeing_bucket,
    }


def ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: analyze_lifestyle_dataset.py /absolute/path/to/Mental_Health_and_Lifestyle_Research.csv")
        return 1

    path = Path(sys.argv[1]).expanduser().resolve()
    if not path.exists():
        print(f"Dataset not found: {path}")
        return 1

    rows = load_rows(path)
    derived = [derive_buckets(row) for row in rows]
    status_counts = Counter(item["status"] for item in derived)

    print(f"Dataset: {path}")
    print(f"Rows: {len(derived)}")
    print("\nMental health status distribution:")
    for key, count in status_counts.most_common():
        print(f"- {key}: {count}")

    feature_fields = [
        "sleep_bucket",
        "stress_bucket",
        "activity_bucket",
        "screen_bucket",
        "social_bucket",
        "diet_bucket",
        "substance_bucket",
        "friends_bucket",
        "wellbeing_bucket",
    ]

    findings = []

    for field in feature_fields:
        grouped: Dict[str, Counter] = defaultdict(Counter)
        for item in derived:
            grouped[item[field]][item["status"]] += 1
        print(f"\n{field}:")
        for bucket, counts in sorted(grouped.items()):
            total = sum(counts.values())
            any_distress = total - counts.get("none", 0)
            distress_rate = ratio(any_distress, total)
            print(
                f"- {bucket}: total={total}, distress_rate={distress_rate:.2%}, top={counts.most_common(3)}"
            )
            findings.append(
                {
                    "field": field,
                    "bucket": bucket,
                    "total": total,
                    "distress_rate": round(distress_rate, 4),
                    "counts": dict(counts),
                }
            )

    output = {
        "dataset_path": str(path),
        "row_count": len(derived),
        "status_distribution": dict(status_counts),
        "bucket_findings": findings,
        "recommended_product_uses": [
            "recommendation_ranking",
            "dashboard_lifestyle_insights",
            "chatbot_contextual_support",
            "selfcare_onboarding_personalization",
        ],
        "non_recommended_uses": [
            "clinical_diagnosis",
            "escalation_replacement",
            "standalone_risk_scoring",
        ],
    }

    print("\nJSON summary:")
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
