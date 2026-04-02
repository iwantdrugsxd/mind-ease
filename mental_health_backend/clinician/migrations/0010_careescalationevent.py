from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0009_carenotification"),
    ]

    operations = [
        migrations.CreateModel(
            name="CareEscalationEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("escalation_type", models.CharField(choices=[("patient_reply_overdue", "Patient reply overdue"), ("clinician_response_overdue", "Clinician response overdue"), ("delivery_failure", "Delivery failure")], db_index=True, max_length=40)),
                ("severity", models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("urgent", "Urgent")], db_index=True, default="medium", max_length=16)),
                ("status", models.CharField(choices=[("open", "Open"), ("acknowledged", "Acknowledged"), ("resolved", "Resolved")], db_index=True, default="open", max_length=20)),
                ("title", models.CharField(max_length=180)),
                ("summary", models.TextField()),
                ("due_at", models.DateTimeField(blank=True, null=True)),
                ("triggered_at", models.DateTimeField(auto_now_add=True)),
                ("last_evaluated_at", models.DateTimeField(auto_now=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("clinician", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="care_escalations", to="clinician.clinician")),
                ("consultation_case", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="escalations", to="clinician.consultationcase")),
                ("latest_notification", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="escalations", to="clinician.carenotification")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="care_escalations", to="screening.patient")),
            ],
        ),
        migrations.AddIndex(
            model_name="careescalationevent",
            index=models.Index(fields=["clinician", "status", "severity"], name="clinician_c_clinici_63d797_idx"),
        ),
        migrations.AddIndex(
            model_name="careescalationevent",
            index=models.Index(fields=["escalation_type", "status"], name="clinician_c_escalat_2d9d20_idx"),
        ),
    ]
