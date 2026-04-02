from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0010_careescalationevent"),
    ]

    operations = [
        migrations.CreateModel(
            name="CareOrchestrationPolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Default policy", max_length=120)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("patient_reply_overdue_hours_default", models.PositiveIntegerField(default=24)),
                ("patient_reply_overdue_hours_high", models.PositiveIntegerField(default=12)),
                ("patient_reply_overdue_hours_urgent", models.PositiveIntegerField(default=4)),
                ("clinician_response_overdue_hours_default", models.PositiveIntegerField(default=12)),
                ("clinician_response_overdue_hours_high", models.PositiveIntegerField(default=4)),
                ("clinician_response_overdue_hours_urgent", models.PositiveIntegerField(default=1)),
                ("reminder_cooldown_hours", models.PositiveIntegerField(default=24)),
                ("sms_for_urgent_reminders", models.BooleanField(default=True)),
                ("auto_resolve_delivery_failure_on_success", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Care orchestration policy",
                "verbose_name_plural": "Care orchestration policies",
            },
        ),
    ]
