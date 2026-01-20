from rest_framework import serializers
from .models import (Clinician, PatientAssignment, ClinicianDashboard, PatientTrend,
                    Appointment, TreatmentPlan, ClinicalNote, AlertResponse)
from screening.models import Patient, PHQ9Screening, GAD7Screening, ScreeningAlert
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class ClinicianSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Clinician
        fields = ['id', 'user', 'license_number', 'specialization', 'phone_number',
                 'is_active', 'created_at']


class PatientAssignmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = PatientAssignment
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'assigned_at', 'is_active', 'notes']


class ClinicianDashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicianDashboard
        fields = ['id', 'clinician', 'date', 'total_patients', 'high_risk_patients',
                 'new_screenings', 'alerts_generated', 'teleconsults_scheduled',
                 'low_risk_count', 'medium_risk_count', 'high_risk_count',
                 'critical_risk_count', 'created_at']


class PatientTrendSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    
    class Meta:
        model = PatientTrend
        fields = ['id', 'patient', 'patient_name', 'date', 'phq9_score', 'phq9_severity',
                 'gad7_score', 'gad7_severity', 'mood_level', 'energy_level',
                 'sleep_quality', 'stress_level', 'risk_level', 'exercises_completed',
                 'check_ins_completed', 'created_at']


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'appointment_type', 'scheduled_date', 'duration_minutes', 'status',
                 'fhir_appointment_id', 'fhir_patient_id', 'fhir_practitioner_id',
                 'reason', 'clinician_notes', 'patient_notes', 'created_at',
                 'updated_at', 'completed_at']


class TreatmentPlanSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = TreatmentPlan
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'diagnosis', 'treatment_goals', 'recommended_interventions',
                 'medication_notes', 'start_date', 'review_date', 'is_active',
                 'progress_notes', 'last_reviewed', 'created_at', 'updated_at']


class ClinicalNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = ClinicalNote
        fields = ['id', 'patient', 'patient_name', 'clinician', 'clinician_name',
                 'note_type', 'content', 'phq9_screening', 'gad7_screening',
                 'created_at', 'updated_at']


class AlertResponseSerializer(serializers.ModelSerializer):
    alert_type = serializers.CharField(source='alert.alert_type', read_only=True)
    patient_name = serializers.CharField(source='alert.patient.user.get_full_name', read_only=True)
    clinician_name = serializers.CharField(source='clinician.user.get_full_name', read_only=True)
    
    class Meta:
        model = AlertResponse
        fields = ['id', 'alert', 'alert_type', 'patient_name', 'clinician',
                 'clinician_name', 'response', 'action_taken', 'follow_up_required',
                 'follow_up_date', 'created_at']


class PatientSummarySerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    patient_name = serializers.CharField()
    latest_phq9_score = serializers.IntegerField()
    latest_gad7_score = serializers.IntegerField()
    risk_level = serializers.CharField()
    last_screening_date = serializers.DateTimeField()
    exercises_completed = serializers.IntegerField()
    check_ins_completed = serializers.IntegerField()
    last_appointment = serializers.DateTimeField()
    requires_attention = serializers.BooleanField()


class DashboardStatsSerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    high_risk_patients = serializers.IntegerField()
    new_screenings_today = serializers.IntegerField()
    alerts_pending = serializers.IntegerField()
    appointments_today = serializers.IntegerField()
    risk_distribution = serializers.DictField()
    screening_trends = serializers.DictField()

