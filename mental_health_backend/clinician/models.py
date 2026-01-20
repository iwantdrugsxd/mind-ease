from django.db import models
from django.contrib.auth.models import User
from screening.models import Patient, PHQ9Screening, GAD7Screening


class Clinician(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    license_number = models.CharField(max_length=100, unique=True)
    specialization = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Dr. {self.user.first_name} {self.user.last_name}"


class PatientAssignment(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['patient', 'clinician']
    
    def __str__(self):
        return f"{self.patient} - {self.clinician}"


class ClinicianDashboard(models.Model):
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    date = models.DateField()
    
    # Aggregated data for the day
    total_patients = models.IntegerField(default=0)
    high_risk_patients = models.IntegerField(default=0)
    new_screenings = models.IntegerField(default=0)
    alerts_generated = models.IntegerField(default=0)
    teleconsults_scheduled = models.IntegerField(default=0)
    
    # Risk level breakdown
    low_risk_count = models.IntegerField(default=0)
    medium_risk_count = models.IntegerField(default=0)
    high_risk_count = models.IntegerField(default=0)
    critical_risk_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['clinician', 'date']
    
    def __str__(self):
        return f"Dashboard - {self.clinician} - {self.date}"


class PatientTrend(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    date = models.DateField()
    
    # PHQ-9 trends
    phq9_score = models.IntegerField(null=True, blank=True)
    phq9_severity = models.CharField(max_length=20, null=True, blank=True)
    
    # GAD-7 trends
    gad7_score = models.IntegerField(null=True, blank=True)
    gad7_severity = models.CharField(max_length=20, null=True, blank=True)
    
    # Mood indicators
    mood_level = models.IntegerField(null=True, blank=True)
    energy_level = models.IntegerField(null=True, blank=True)
    sleep_quality = models.IntegerField(null=True, blank=True)
    stress_level = models.IntegerField(null=True, blank=True)
    
    # Risk indicators
    risk_level = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ])
    
    # Engagement metrics
    exercises_completed = models.IntegerField(default=0)
    check_ins_completed = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['patient', 'date']
    
    def __str__(self):
        return f"Trend - {self.patient} - {self.date}"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    
    APPOINTMENT_TYPES = [
        ('initial', 'Initial Consultation'),
        ('follow_up', 'Follow-up'),
        ('teleconsult', 'Teleconsultation'),
        ('crisis', 'Crisis Intervention'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    appointment_type = models.CharField(max_length=20, choices=APPOINTMENT_TYPES)
    scheduled_date = models.DateTimeField()
    duration_minutes = models.IntegerField(default=60)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    
    # FHIR integration
    fhir_appointment_id = models.CharField(max_length=100, blank=True)
    fhir_patient_id = models.CharField(max_length=100, blank=True)
    fhir_practitioner_id = models.CharField(max_length=100, blank=True)
    
    # Notes
    reason = models.TextField(blank=True)
    clinician_notes = models.TextField(blank=True)
    patient_notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Appointment - {self.patient} - {self.scheduled_date}"


class TreatmentPlan(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    
    # Treatment details
    diagnosis = models.TextField()
    treatment_goals = models.TextField()
    recommended_interventions = models.TextField()
    medication_notes = models.TextField(blank=True)
    
    # Timeline
    start_date = models.DateField()
    review_date = models.DateField()
    is_active = models.BooleanField(default=True)
    
    # Progress tracking
    progress_notes = models.TextField(blank=True)
    last_reviewed = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Treatment Plan - {self.patient} - {self.start_date}"


class ClinicalNote(models.Model):
    NOTE_TYPES = [
        ('assessment', 'Assessment'),
        ('progress', 'Progress Note'),
        ('treatment', 'Treatment Note'),
        ('crisis', 'Crisis Note'),
        ('discharge', 'Discharge Note'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    note_type = models.CharField(max_length=20, choices=NOTE_TYPES)
    content = models.TextField()
    
    # Associated screenings
    phq9_screening = models.ForeignKey(PHQ9Screening, on_delete=models.SET_NULL, null=True, blank=True)
    gad7_screening = models.ForeignKey(GAD7Screening, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Note - {self.patient} - {self.note_type} - {self.created_at}"


class AlertResponse(models.Model):
    alert = models.ForeignKey('screening.ScreeningAlert', on_delete=models.CASCADE)
    clinician = models.ForeignKey(Clinician, on_delete=models.CASCADE)
    response = models.TextField()
    action_taken = models.CharField(max_length=100)
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Response - {self.alert} - {self.clinician}"