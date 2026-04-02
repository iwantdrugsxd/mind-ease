"""
Database system checks for screening / onboarding schema.

Fails fast on runserver and `manage.py check --database default` when onboarding
migrations were not applied, instead of surfacing as 500s on first API call.
"""

from django.core.checks import Error, register, Tags
from django.db import connections


# Tables created by screening.0003_onboarding (must match migration operations).
EXPECTED_ONBOARDING_TABLES = (
    "screening_patientprofile",
    "screening_patientbaseline",
    "screening_patientconsent",
    "screening_patientpreferences",
    "screening_patientonboardingstatus",
)


@register(Tags.database)
def check_onboarding_tables_exist(app_configs, **kwargs):
    errors = []
    databases = kwargs.get("databases") or []
    for alias in databases:
        connection = connections[alias]
        try:
            connection.ensure_connection()
        except Exception:
            continue
        existing = set(connection.introspection.table_names())
        missing = [t for t in EXPECTED_ONBOARDING_TABLES if t not in existing]
        if missing:
            errors.append(
                Error(
                    "Onboarding tables are missing from the database (screening.0003_onboarding "
                    f"not applied): {', '.join(missing)}.",
                    hint="Run: python manage.py migrate screening",
                    id="screening.E001",
                )
            )
    return errors
