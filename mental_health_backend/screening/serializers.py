from rest_framework import serializers
from .models import (Patient, PHQ9Screening, GAD7Screening, ScreeningAlert, 
                    TeleconsultReferral, ChatbotConversation, ChatbotMessage,
                    PatientProfile, PatientBaseline, PatientConsent, PatientPreferences, PatientOnboardingStatus)
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class PatientSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Patient
        fields = ['id', 'user', 'firebase_uid', 'date_of_birth', 'phone_number', 
                 'emergency_contact', 'emergency_phone', 'created_at', 'updated_at']


class PHQ9ScreeningSerializer(serializers.ModelSerializer):
    class Meta:
        model = PHQ9Screening
        fields = ['id', 'patient', 'q1_interest', 'q2_depressed', 'q3_sleep', 
                 'q4_energy', 'q5_appetite', 'q6_self_esteem', 'q7_concentration', 
                 'q8_psychomotor', 'q9_suicidal', 'total_score', 'severity_level',
                 'requires_immediate_attention', 'requires_teleconsult', 'risk_level',
                 'created_at']
        read_only_fields = ['patient', 'total_score', 'severity_level', 'requires_immediate_attention',
                           'requires_teleconsult', 'risk_level']


class GAD7ScreeningSerializer(serializers.ModelSerializer):
    class Meta:
        model = GAD7Screening
        fields = ['id', 'patient', 'q1_nervous', 'q2_worry', 'q3_worry_control',
                 'q4_trouble_relaxing', 'q5_restless', 'q6_irritable', 'q7_afraid',
                 'total_score', 'severity_level', 'requires_immediate_attention',
                 'requires_teleconsult', 'risk_level', 'created_at']
        read_only_fields = ['patient', 'total_score', 'severity_level', 'requires_immediate_attention',
                           'requires_teleconsult', 'risk_level']


class ScreeningAlertSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    
    class Meta:
        model = ScreeningAlert
        fields = ['id', 'patient', 'patient_name', 'alert_type', 'message',
                 'is_resolved', 'created_at', 'resolved_at']


class TeleconsultReferralSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    
    class Meta:
        model = TeleconsultReferral
        fields = ['id', 'patient', 'patient_name', 'phq9_screening', 'gad7_screening',
                 'reason', 'priority', 'status', 'scheduled_date', 'clinician_notes',
                 'created_at']


class ScreeningSummarySerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    patient_name = serializers.CharField()
    latest_phq9_score = serializers.IntegerField()
    latest_gad7_score = serializers.IntegerField()
    risk_level = serializers.CharField()
    last_screening_date = serializers.DateTimeField()
    requires_attention = serializers.BooleanField()


class ChatbotMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotMessage
        fields = ['id', 'message_type', 'content', 'detected_emotion', 
                 'emotion_confidence', 'risk_level', 'risk_keywords', 'created_at']
        read_only_fields = ['detected_emotion', 'emotion_confidence', 'risk_level', 'risk_keywords']


class ChatbotConversationSerializer(serializers.ModelSerializer):
    messages = ChatbotMessageSerializer(many=True, read_only=True)
    patient = serializers.PrimaryKeyRelatedField(read_only=True)
    session_id = serializers.CharField(read_only=True)
    
    class Meta:
        model = ChatbotConversation
        fields = ['id', 'session_id', 'patient', 'messages', 'created_at', 'updated_at']
        read_only_fields = ['id', 'patient', 'session_id', 'created_at', 'updated_at']


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ['preferred_name', 'birth_year', 'gender', 'occupation', 'city']


class PatientBaselineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientBaseline
        fields = ['mood_baseline', 'sleep_quality_baseline', 'stress_level_baseline', 'main_concerns', 'goals']


class PatientConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientConsent
        fields = ['data_usage_consent_given', 'data_usage_consent_at',
                  'emergency_disclaimer_acknowledged', 'emergency_disclaimer_acknowledged_at',
                  'clinician_access_opt_in', 'consent_version']
        read_only_fields = ['data_usage_consent_at', 'emergency_disclaimer_acknowledged_at']


class PatientPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientPreferences
        fields = ['preferred_time_of_day']


class PatientOnboardingStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientOnboardingStatus
        fields = ['account_step_completed', 'profile_step_completed', 'baseline_step_completed',
                  'consent_step_completed', 'assessment_offered', 'assessment_completed',
                  'advanced_step_completed', 'onboarding_completed_at', 'onboarding_version']


class OnboardingSummarySerializer(serializers.Serializer):
    profile = PatientProfileSerializer()
    baseline = PatientBaselineSerializer()
    consent = PatientConsentSerializer()
    preferences = PatientPreferencesSerializer()
    status = PatientOnboardingStatusSerializer()
