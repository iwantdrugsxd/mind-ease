from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clinician', '0004_consultation_foundation'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='consultation_case',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='appointments', to='clinician.consultationcase'),
        ),
        migrations.AddField(
            model_name='clinicalnote',
            name='consultation_case',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notes', to='clinician.consultationcase'),
        ),
    ]

