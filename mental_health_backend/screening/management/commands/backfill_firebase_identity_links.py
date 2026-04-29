"""
Populate FirebaseIdentityLink from existing Patient rows and legacy clinician accounts.

Safe to run multiple times (idempotent). Use --dry-run first in production.

Does not call Firebase; uses only DB state.
Priority:
1) Patient.firebase_uid -> Patient.user
2) Legacy User.username == firebase_<uid> for clinician users
3) Explicit clinician email-to-uid mappings passed via --map email=uid
"""

from typing import Optional

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from clinician.models import Clinician
from screening.models import FirebaseIdentityLink, Patient


class Command(BaseCommand):
    help = "Backfill FirebaseIdentityLink from Patient.firebase_uid and legacy firebase_* usernames."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print actions without writing to the database.",
        )
        parser.add_argument(
            "--map",
            action="append",
            default=[],
            metavar="EMAIL=FIREBASE_UID",
            help=(
                "Explicit clinician email-to-firebase-uid mapping. Repeatable. "
                "Example: --map revant12@gmail.com=abc123uid"
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        raw_mappings = options["map"] or []
        created = 0
        skipped_ok = 0
        conflicts = 0
        malformed = 0

        def report(msg: str, level: Optional[str] = None):
            if level == "error":
                self.stdout.write(self.style.ERROR(msg))
            elif level == "warning":
                self.stdout.write(self.style.WARNING(msg))
            else:
                self.stdout.write(msg)

        explicit_maps = []
        for item in raw_mappings:
            raw = (item or "").strip()
            if "=" not in raw:
                report(f"SKIP malformed mapping {raw!r}: expected EMAIL=FIREBASE_UID", "warning")
                malformed += 1
                continue
            email, uid = raw.split("=", 1)
            email = email.strip().lower()
            uid = uid.strip()
            if not email or not uid:
                report(f"SKIP malformed mapping {raw!r}: expected non-empty EMAIL and FIREBASE_UID", "warning")
                malformed += 1
                continue
            explicit_maps.append((email, uid))

        # --- 1) Patient rows (source of truth for UID <-> user) ---
        for patient in Patient.objects.select_related("user").iterator():
            uid = (patient.firebase_uid or "").strip()
            if not uid:
                report(f"SKIP patient id={patient.id}: empty firebase_uid", "warning")
                continue
            user = patient.user

            existing_by_uid = FirebaseIdentityLink.objects.filter(firebase_uid=uid).first()
            existing_by_user = FirebaseIdentityLink.objects.filter(user=user).first()

            if existing_by_uid and existing_by_uid.user_id != user.id:
                report(
                    f"CONFLICT firebase_uid={uid!r} already linked to user_id={existing_by_uid.user_id}, "
                    f"patient wants user_id={user.id}",
                    "error",
                )
                conflicts += 1
                continue

            if existing_by_user and existing_by_user.firebase_uid != uid:
                report(
                    f"CONFLICT user_id={user.id} already linked to firebase_uid={existing_by_user.firebase_uid!r}, "
                    f"patient row has firebase_uid={uid!r}",
                    "error",
                )
                conflicts += 1
                continue

            if existing_by_uid:
                skipped_ok += 1
                continue

            email = (user.email or "").strip()
            if dry_run:
                report(f"DRY-RUN would create link uid={uid!r} -> user_id={user.id} ({user.username})")
                created += 1
            else:
                with transaction.atomic():
                    FirebaseIdentityLink.objects.create(
                        user=user,
                        firebase_uid=uid,
                        email=email,
                    )
                report(f"CREATED link uid={uid!r} -> user_id={user.id}")
                created += 1

        # --- 2) Legacy User.username firebase_<uid> (often clinicians / orphans without Patient) ---
        prefix = "firebase_"
        for user in User.objects.filter(username__startswith=prefix).iterator():
            if FirebaseIdentityLink.objects.filter(user=user).exists():
                skipped_ok += 1
                continue

            uid = user.username[len(prefix) :].strip()
            if not uid:
                continue

            # Prefer explicit patient row if this user has one (phase 1 should have linked it)
            if Patient.objects.filter(user=user).exists():
                skipped_ok += 1
                continue

            if FirebaseIdentityLink.objects.filter(firebase_uid=uid).exists():
                report(
                    f"CONFLICT firebase_uid={uid!r} already linked; user_id={user.id} has username={user.username!r}",
                    "error",
                )
                conflicts += 1
                continue

            # Only auto-link clinicians or clearly Firebase-created users (avoid random usernames)
            if not Clinician.objects.filter(user=user).exists():
                report(
                    f"SKIP user_id={user.id} username={user.username!r}: not a clinician (no Patient and not clinician)",
                    "warning",
                )
                continue

            email = (user.email or "").strip()
            if dry_run:
                report(f"DRY-RUN would create link (legacy username) uid={uid!r} -> user_id={user.id}")
                created += 1
            else:
                with transaction.atomic():
                    FirebaseIdentityLink.objects.create(
                        user=user,
                        firebase_uid=uid,
                        email=email,
                    )
                report(f"CREATED link (legacy username) uid={uid!r} -> user_id={user.id}")
                created += 1

        # --- 3) Explicit email->uid mappings for existing clinician accounts ---
        for email, uid in explicit_maps:
            clinicians = list(
                Clinician.objects.select_related("user").filter(user__email__iexact=email).order_by("id")
            )
            if len(clinicians) != 1:
                report(
                    f"CONFLICT mapping email={email!r}: expected exactly 1 clinician account, found {len(clinicians)}",
                    "error",
                )
                conflicts += 1
                continue

            user = clinicians[0].user
            existing_by_uid = FirebaseIdentityLink.objects.filter(firebase_uid=uid).first()
            existing_by_user = FirebaseIdentityLink.objects.filter(user=user).first()

            if existing_by_uid and existing_by_uid.user_id != user.id:
                report(
                    f"CONFLICT mapping uid={uid!r}: already linked to user_id={existing_by_uid.user_id}, "
                    f"cannot link clinician user_id={user.id}",
                    "error",
                )
                conflicts += 1
                continue

            if existing_by_user and existing_by_user.firebase_uid != uid:
                report(
                    f"CONFLICT mapping user_id={user.id}: already linked to firebase_uid={existing_by_user.firebase_uid!r}, "
                    f"cannot relink to {uid!r}",
                    "error",
                )
                conflicts += 1
                continue

            if existing_by_uid or existing_by_user:
                skipped_ok += 1
                continue

            if dry_run:
                report(f"DRY-RUN would create link (explicit map) uid={uid!r} -> user_id={user.id} email={email}")
                created += 1
            else:
                with transaction.atomic():
                    FirebaseIdentityLink.objects.create(
                        user=user,
                        firebase_uid=uid,
                        email=email,
                    )
                report(f"CREATED link (explicit map) uid={uid!r} -> user_id={user.id} email={email}")
                created += 1

        report(
            f"Done. created={created} skipped_already_ok≈{skipped_ok} conflicts={conflicts} malformed={malformed} dry_run={dry_run}"
        )
