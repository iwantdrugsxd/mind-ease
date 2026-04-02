import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import firebase_admin
from django.conf import settings
from django.contrib.auth.models import User
from firebase_admin import auth, credentials
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed


logger = logging.getLogger(__name__)


def _get_credentials_path() -> str:
    configured = getattr(settings, "FIREBASE_CREDENTIALS_PATH", "") or os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.exists():
            return str(candidate)
        return configured

    # Local development fallback: use the checked-in backend service account if present.
    base_dir = Path(getattr(settings, "BASE_DIR", Path.cwd()))
    fallback = base_dir.parent / "backend_env" / "mindcare-mental-health-a1a1f-firebase-adminsdk-fbsvc-ffb561259e.json"
    if fallback.exists():
        return str(fallback)
    return ""


def _get_credentials_json() -> str:
    return os.getenv("FIREBASE_CREDENTIALS_JSON", "")


def initialize_firebase_admin() -> bool:
    """
    Initialize Firebase Admin idempotently.
    Returns True when Firebase Admin is ready, False when credentials are missing.
    """
    if firebase_admin._apps:
        return True

    cred_path = _get_credentials_path()
    cred_json = _get_credentials_json()
    options: Dict[str, Any] = {}
    db_url = getattr(settings, "FIREBASE_DATABASE_URL", "") or os.getenv("FIREBASE_DATABASE_URL", "")
    if db_url:
        options["databaseURL"] = db_url

    try:
        if cred_path:
            firebase_admin.initialize_app(credentials.Certificate(cred_path), options=options or None)
            return True
        if cred_json:
            firebase_admin.initialize_app(
                credentials.Certificate(json.loads(cred_json)),
                options=options or None,
            )
            return True
        try:
            firebase_admin.initialize_app(options=options or None)
            logger.info("Firebase Admin initialized with application default credentials.")
            return True
        except Exception:
            pass
        logger.warning("Firebase Admin not initialized: missing credentials.")
        return False
    except Exception as exc:
        logger.warning("Firebase Admin initialization failed: %s", exc)
        return False


def resolve_user_from_firebase_uid(firebase_uid: str, decoded_token: Optional[Dict[str, Any]] = None) -> User:
    from .models import Patient

    patient = Patient.objects.select_related("user").filter(firebase_uid=firebase_uid).first()
    if patient:
        return patient.user

    username = f"firebase_{firebase_uid}"
    email = ""
    first_name = "Firebase"
    last_name = "User"
    if decoded_token:
        email = decoded_token.get("email") or ""
        name = (decoded_token.get("name") or "").strip()
        if name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

    user, _ = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email or f"{firebase_uid}@firebase.local",
            "first_name": first_name,
            "last_name": last_name,
        },
    )
    return user


class FirebaseAuthentication(authentication.BaseAuthentication):
    """
    DRF authentication via Firebase ID tokens.
    - If Authorization header is absent, authentication is skipped.
    - If Authorization header is Bearer but token is invalid, request is rejected.
    - If Firebase credentials are missing, it fails gracefully with an auth error.
    """

    keyword = "Bearer"

    def authenticate(self, request) -> Optional[Tuple[User, Dict[str, Any]]]:
        auth_header = authentication.get_authorization_header(request).decode("utf-8")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        token = parts[1].strip()
        if not token:
            raise AuthenticationFailed("Invalid Firebase authorization header.")

        if not initialize_firebase_admin():
            raise AuthenticationFailed("Firebase authentication is not configured on this server.")

        try:
            decoded_token = auth.verify_id_token(token)
            firebase_uid = decoded_token.get("uid")
            if not firebase_uid:
                raise AuthenticationFailed("Firebase token missing uid.")
            user = resolve_user_from_firebase_uid(firebase_uid, decoded_token=decoded_token)
            return user, decoded_token
        except AuthenticationFailed:
            raise
        except Exception as exc:
            raise AuthenticationFailed(f"Invalid Firebase token: {exc}")
