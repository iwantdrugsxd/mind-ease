from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0006_remove_consultationcase_uniq_open_system_case_per_pair_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="consultationcase",
            name="status",
            field=models.CharField(
                choices=[
                    ("open", "Open"),
                    ("in_progress", "In progress"),
                    ("awaiting_clinician", "Awaiting clinician"),
                    ("awaiting_patient", "Awaiting patient"),
                    ("scheduled", "Scheduled"),
                    ("resolved", "Resolved"),
                    ("closed", "Closed"),
                ],
                db_index=True,
                default="open",
                max_length=20,
            ),
        ),
    ]
