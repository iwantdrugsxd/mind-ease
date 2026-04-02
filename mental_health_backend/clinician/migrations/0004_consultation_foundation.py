from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('clinician', '0003_approve_existing_pending_clinicians'),
        ('screening', '0003_onboarding'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConsultationCase',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(choices=[('screening', 'Screening'), ('chatbot', 'Chatbot'), ('selfcare_drift', 'Self-care drift'), ('scorecard_flag', 'Scorecard flag'), ('manual', 'Manual')], db_index=True, default='scorecard_flag', max_length=32)),
                ('trigger_reason', models.TextField(blank=True)),
                ('priority', models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')], db_index=True, default='medium', max_length=16)),
                ('status', models.CharField(choices=[('open', 'Open'), ('in_progress', 'In progress'), ('awaiting_patient', 'Awaiting patient'), ('scheduled', 'Scheduled'), ('resolved', 'Resolved'), ('closed', 'Closed')], db_index=True, default='open', max_length=20)),
                ('created_by_system', models.BooleanField(default=True)),
                ('requires_follow_up', models.BooleanField(db_index=True, default=True)),
                ('opened_at', models.DateTimeField(auto_now_add=True)),
                ('last_activity_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('resolution_notes', models.TextField(blank=True)),
                ('assigned_clinician', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultation_cases', to='clinician.clinician')),
                ('assignment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='consultation_cases', to='clinician.patientassignment')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultation_cases', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='ConsultationThread',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_active', models.BooleanField(default=True)),
                ('last_message_at', models.DateTimeField(blank=True, null=True)),
                ('last_message_preview', models.CharField(blank=True, max_length=280)),
                ('clinician_unread_count', models.PositiveIntegerField(default=0)),
                ('patient_unread_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('clinician', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultation_threads', to='clinician.clinician')),
                ('consultation_case', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='thread', to='clinician.consultationcase')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultation_threads', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='ConsultationMessage',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sender_type', models.CharField(choices=[('clinician', 'Clinician'), ('patient', 'Patient'), ('system', 'System')], max_length=16)),
                ('content', models.TextField()),
                ('message_type', models.CharField(choices=[('text', 'Text'), ('system_notice', 'System notice'), ('appointment_notice', 'Appointment notice'), ('followup_notice', 'Follow-up notice')], default='text', max_length=32)),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sender_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='auth.user')),
                ('thread', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='clinician.consultationthread')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='consultationcase',
            index=models.Index(fields=['assigned_clinician', 'status', 'priority'], name='clinician_c_assigne_4302db_idx'),
        ),
        migrations.AddConstraint(
            model_name='consultationcase',
            constraint=models.UniqueConstraint(condition=models.Q(models.Q(('status__in', ['open', 'in_progress', 'awaiting_patient', 'scheduled']), ('created_by_system', True)),), fields=('patient', 'assigned_clinician', 'status', 'created_by_system'), name='uniq_open_system_case_per_pair'),
        ),
    ]

