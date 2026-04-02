from django.db import migrations


def approve_pending(apps, schema_editor):
    Clinician = apps.get_model("clinician", "Clinician")
    Clinician.objects.filter(status="pending").update(status="approved")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("clinician", "0002_clinician_registration_phase1"),
    ]

    operations = [
        migrations.RunPython(approve_pending, noop),
    ]
