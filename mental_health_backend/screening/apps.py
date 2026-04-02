from django.apps import AppConfig


class ScreeningConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'screening'

    def ready(self):
        # Register database checks (onboarding table presence).
        import screening.checks  # noqa: F401
