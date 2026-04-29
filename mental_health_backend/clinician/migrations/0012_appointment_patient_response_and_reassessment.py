from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0011_careorchestrationpolicy"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="patient_responded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="appointment",
            name="patient_response",
            field=models.CharField(
                choices=[("pending", "Pending"), ("accepted", "Accepted"), ("rejected", "Rejected")],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
    ]
