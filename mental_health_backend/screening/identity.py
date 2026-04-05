from typing import Optional, Tuple

from django.contrib.auth.models import User

from .models import Patient


def _extract_legacy_firebase_uid(request) -> str:
    if request.method in ("POST", "PUT", "PATCH"):
        return (request.data.get("firebase_uid") or "").strip()
    return (request.query_params.get("firebase_uid") or "").strip()


def get_verified_firebase_uid(request) -> str:
    if isinstance(request.auth, dict):
        return (request.auth.get("uid") or "").strip()
    return ""


def resolve_identity(request, allow_legacy_firebase_uid: bool = True) -> Tuple[Optional[User], Optional[Patient], str]:
    """
    Identity resolution priority:
    1) Verified Firebase UID from request.auth (trusted)
    2) Authenticated Django user
    3) Legacy raw firebase_uid from request body/query (temporary compatibility)
    """
    verified_uid = get_verified_firebase_uid(request)
    if verified_uid:
        patient = Patient.objects.select_related("user").filter(firebase_uid=verified_uid).first()
        if patient:
            return patient.user, patient, verified_uid
        if request.user.is_authenticated:
            patient_for_user = Patient.objects.select_related("user").filter(user=request.user).first()
            return request.user, patient_for_user, verified_uid
        return None, None, verified_uid

    if request.user.is_authenticated:
        patient = Patient.objects.select_related("user").filter(user=request.user).first()
        return request.user, patient, getattr(patient, "firebase_uid", "") or ""

    if allow_legacy_firebase_uid:
        legacy_uid = _extract_legacy_firebase_uid(request)
        if legacy_uid:
            patient = Patient.objects.select_related("user").filter(firebase_uid=legacy_uid).first()
            if patient:
                return patient.user, patient, legacy_uid
            return None, None, legacy_uid

    return None, None, ""


def get_or_create_patient_for_request(request, allow_legacy_firebase_uid: bool = True) -> Tuple[Optional[User], Optional[Patient], str]:
    user, patient, firebase_uid = resolve_identity(request, allow_legacy_firebase_uid=allow_legacy_firebase_uid)
    if patient:
        if firebase_uid and patient.firebase_uid != firebase_uid:
            conflict = Patient.objects.filter(firebase_uid=firebase_uid).exclude(id=patient.id).exists()
            if not conflict:
                patient.firebase_uid = firebase_uid
                patient.save(update_fields=["firebase_uid", "updated_at"])
            return user, patient, patient.firebase_uid
        return user, patient, firebase_uid

    if not firebase_uid and user:
        # Preserve prior behavior for non-firebase users by deriving an internal uid.
        firebase_uid = user.username

    if not firebase_uid:
        return user, None, ""

    if user is None:
        username = f"firebase_{firebase_uid}"
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{firebase_uid}@firebase.local",
                "first_name": "Firebase",
                "last_name": "User",
            },
        )

    patient, _ = Patient.objects.get_or_create(
        firebase_uid=firebase_uid,
        defaults={"user": user},
    )
    return user, patient, firebase_uid
