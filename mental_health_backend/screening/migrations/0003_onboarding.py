from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('screening', '0002_chatbotconversation_chatbotmessage'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('preferred_name', models.CharField(blank=True, max_length=100)),
                ('birth_year', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1900), django.core.validators.MaxValueValidator(2100)])),
                ('gender', models.CharField(choices=[('unspecified', 'Unspecified'), ('male', 'Male'), ('female', 'Female'), ('nonbinary', 'Non-binary'), ('prefer_not_say', 'Prefer not to say')], default='unspecified', max_length=20)),
                ('occupation', models.CharField(blank=True, max_length=120)),
                ('city', models.CharField(blank=True, max_length=120)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='PatientBaseline',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mood_baseline', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('sleep_quality_baseline', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('stress_level_baseline', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('main_concerns', models.JSONField(blank=True, default=list)),
                ('goals', models.JSONField(blank=True, default=list)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='baseline', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='PatientConsent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_usage_consent_given', models.BooleanField(default=False)),
                ('data_usage_consent_at', models.DateTimeField(blank=True, null=True)),
                ('emergency_disclaimer_acknowledged', models.BooleanField(default=False)),
                ('emergency_disclaimer_acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('clinician_access_opt_in', models.BooleanField(default=False)),
                ('consent_version', models.CharField(default='v1', max_length=20)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='consent', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='PatientPreferences',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('preferred_time_of_day', models.CharField(choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('evening', 'Evening'), ('night', 'Night'), ('unspecified', 'Unspecified')], default='unspecified', max_length=20)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='preferences', to='screening.patient')),
            ],
        ),
        migrations.CreateModel(
            name='PatientOnboardingStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('account_step_completed', models.BooleanField(default=False)),
                ('profile_step_completed', models.BooleanField(default=False)),
                ('baseline_step_completed', models.BooleanField(default=False)),
                ('consent_step_completed', models.BooleanField(default=False)),
                ('assessment_offered', models.BooleanField(default=False)),
                ('assessment_completed', models.BooleanField(default=False)),
                ('advanced_step_completed', models.BooleanField(default=False)),
                ('onboarding_completed_at', models.DateTimeField(blank=True, null=True)),
                ('onboarding_version', models.CharField(default='v1', max_length=20)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='onboarding_status', to='screening.patient')),
            ],
        ),
    ]

