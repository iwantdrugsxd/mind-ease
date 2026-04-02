from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clinician", "0008_consultationcase_active_constraint_awaiting_clinician"),
    ]

    operations = [
        migrations.CreateModel(
            name="CareNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_type", models.CharField(choices=[("care_team_message", "Care team message"), ("follow_up_scheduled", "Follow-up scheduled"), ("follow_up_resolved", "Follow-up resolved")], db_index=True, max_length=40)),
                ("channel", models.CharField(choices=[("in_app", "In app"), ("email", "Email"), ("sms", "SMS")], db_index=True, max_length=20)),
                ("recipient_role", models.CharField(choices=[("patient", "Patient"), ("clinician", "Clinician")], db_index=True, default="patient", max_length=20)),
                ("title", models.CharField(max_length=160)),
                ("body", models.TextField()),
                ("status", models.CharField(choices=[("sent", "Sent"), ("failed", "Failed"), ("skipped", "Skipped")], db_index=True, default="sent", max_length=20)),
                ("destination", models.CharField(blank=True, max_length=255)),
                ("error_message", models.TextField(blank=True)),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("clinician", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="care_notifications", to="clinician.clinician")),
                ("consultation_case", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="clinician.consultationcase")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="care_notifications", to="screening.patient")),
                ("related_appointment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="clinician.appointment")),
                ("related_message", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="clinician.consultationmessage")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="carenotification",
            index=models.Index(fields=["patient", "recipient_role", "channel", "is_read"], name="clinician_c_patient__931cb6_idx"),
        ),
        migrations.AddIndex(
            model_name="carenotification",
            index=models.Index(fields=["consultation_case", "created_at"], name="clinician_c_consult_4d30be_idx"),
        ),
    ]
