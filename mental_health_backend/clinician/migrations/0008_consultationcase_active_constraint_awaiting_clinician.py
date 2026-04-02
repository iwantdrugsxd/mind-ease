from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0007_consultationcase_awaiting_clinician"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="consultationcase",
            name="uniq_open_system_case_per_pair",
        ),
        migrations.AddConstraint(
            model_name="consultationcase",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("created_by_system", True),
                    ("status__in", ["open", "in_progress", "awaiting_clinician", "awaiting_patient", "scheduled"]),
                ),
                fields=("patient", "assigned_clinician", "status", "created_by_system"),
                name="uniq_open_system_case_per_pair",
            ),
        ),
    ]
