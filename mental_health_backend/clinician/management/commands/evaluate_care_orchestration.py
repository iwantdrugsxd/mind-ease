from django.core.management.base import BaseCommand

from clinician.models import ConsultationCase
from clinician.orchestration_service import evaluate_case_orchestration


class Command(BaseCommand):
    help = "Evaluate care orchestration rules for active consultation cases."

    def handle(self, *args, **options):
        count = 0
        qs = ConsultationCase.objects.exclude(status__in=["resolved", "closed"]).select_related("patient", "assigned_clinician")
        for case in qs:
            evaluate_case_orchestration(case)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Evaluated orchestration for {count} active consultation cases."))
