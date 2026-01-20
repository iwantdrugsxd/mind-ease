from rest_framework import serializers
from .models import (SelfCareExercise, SelfCarePathway, PathwayExercise, 
                    PatientSelfCareProgress, ExerciseCompletion, MoodEntry,
                    CoachCheckIn, MotivationalMessage, PatientMessage)
from screening.models import Patient


class SelfCareExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SelfCareExercise
        fields = ['id', 'name', 'description', 'exercise_type', 'duration_minutes',
                 'difficulty_level', 'instructions', 'benefits', 'is_active']


class PathwayExerciseSerializer(serializers.ModelSerializer):
    exercise = SelfCareExerciseSerializer(read_only=True)
    
    class Meta:
        model = PathwayExercise
        fields = ['id', 'exercise', 'order', 'is_required', 'unlock_condition']


class SelfCarePathwaySerializer(serializers.ModelSerializer):
    exercises = PathwayExerciseSerializer(source='pathwayexercise_set', many=True, read_only=True)
    
    class Meta:
        model = SelfCarePathway
        fields = ['id', 'name', 'description', 'target_symptoms', 'target_severity',
                 'exercises', 'is_active']


class PatientSelfCareProgressSerializer(serializers.ModelSerializer):
    pathway_name = serializers.CharField(source='pathway.name', read_only=True)
    current_exercise_name = serializers.CharField(source='current_exercise.name', read_only=True)
    
    class Meta:
        model = PatientSelfCareProgress
        fields = ['id', 'patient', 'pathway', 'pathway_name', 'current_exercise',
                 'current_exercise_name', 'is_completed', 'started_at', 'completed_at',
                 'progress_percentage']


class ExerciseCompletionSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    
    class Meta:
        model = ExerciseCompletion
        fields = ['id', 'patient', 'exercise', 'exercise_name', 'completed_at',
                 'duration_actual', 'rating', 'notes']


class MoodEntrySerializer(serializers.ModelSerializer):
    patient = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = MoodEntry
        fields = ['id', 'patient', 'mood_level', 'energy_level', 'sleep_quality',
                 'stress_level', 'notes', 'created_at']
        read_only_fields = ['id', 'patient', 'created_at']


class CoachCheckInSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    
    class Meta:
        model = CoachCheckIn
        fields = ['id', 'patient', 'patient_name', 'scheduled_date', 'status',
                 'coach_notes', 'patient_feedback', 'completed_at', 'created_at']


class MotivationalMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivationalMessage
        fields = ['id', 'title', 'message', 'message_type', 'target_audience',
                 'is_active', 'created_at']


class PatientMessageSerializer(serializers.ModelSerializer):
    message_title = serializers.CharField(source='message.title', read_only=True)
    message_content = serializers.CharField(source='message.message', read_only=True)
    
    class Meta:
        model = PatientMessage
        fields = ['id', 'patient', 'message', 'message_title', 'message_content',
                 'sent_at', 'is_read', 'read_at']


class MoodTrendSerializer(serializers.Serializer):
    date = serializers.DateField()
    mood_level = serializers.IntegerField()
    energy_level = serializers.IntegerField()
    sleep_quality = serializers.IntegerField()
    stress_level = serializers.IntegerField()


class ExerciseProgressSerializer(serializers.Serializer):
    exercise_id = serializers.IntegerField()
    exercise_name = serializers.CharField()
    completed_count = serializers.IntegerField()
    last_completed = serializers.DateTimeField()
    average_rating = serializers.FloatField()

