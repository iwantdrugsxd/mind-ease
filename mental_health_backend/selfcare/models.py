from django.db import models
from screening.models import Patient


class SelfCareExercise(models.Model):
    EXERCISE_TYPES = [
        ('breathing', 'Breathing Exercise'),
        ('mindfulness', 'Mindfulness'),
        ('journaling', 'Journaling'),
        ('physical', 'Physical Activity'),
        ('cognitive', 'Cognitive Exercise'),
        ('social', 'Social Connection'),
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField()
    exercise_type = models.CharField(max_length=20, choices=EXERCISE_TYPES)
    duration_minutes = models.IntegerField()
    difficulty_level = models.CharField(max_length=20, choices=[
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ])
    instructions = models.TextField()
    benefits = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class SelfCarePathway(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField()
    target_symptoms = models.JSONField(default=list)  # List of symptoms this pathway addresses
    target_severity = models.CharField(max_length=20, choices=[
        ('minimal', 'Minimal'),
        ('mild', 'Mild'),
        ('moderate', 'Moderate'),
        ('severe', 'Severe'),
    ])
    exercises = models.ManyToManyField(SelfCareExercise, through='PathwayExercise')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class PathwayExercise(models.Model):
    pathway = models.ForeignKey(SelfCarePathway, on_delete=models.CASCADE)
    exercise = models.ForeignKey(SelfCareExercise, on_delete=models.CASCADE)
    order = models.IntegerField()
    is_required = models.BooleanField(default=False)
    unlock_condition = models.CharField(max_length=100, blank=True)  # e.g., "complete_previous", "score_threshold"
    
    class Meta:
        ordering = ['order']
        unique_together = ['pathway', 'exercise']


class PatientSelfCareProgress(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    pathway = models.ForeignKey(SelfCarePathway, on_delete=models.CASCADE)
    current_exercise = models.ForeignKey(SelfCareExercise, on_delete=models.CASCADE, null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    progress_percentage = models.FloatField(default=0.0)
    
    def __str__(self):
        return f"{self.patient} - {self.pathway}"


class ExerciseCompletion(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    exercise = models.ForeignKey(SelfCareExercise, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)
    duration_actual = models.IntegerField(null=True, blank=True)  # Actual time spent
    rating = models.IntegerField(null=True, blank=True)  # 1-5 rating
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['patient', 'exercise', 'completed_at']
    
    def __str__(self):
        return f"{self.patient} - {self.exercise} - {self.completed_at}"


class MoodEntry(models.Model):
    MOOD_LEVELS = [
        (1, 'Very Low'),
        (2, 'Low'),
        (3, 'Neutral'),
        (4, 'Good'),
        (5, 'Very Good'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    mood_level = models.IntegerField(choices=MOOD_LEVELS)
    energy_level = models.IntegerField(choices=MOOD_LEVELS)
    sleep_quality = models.IntegerField(choices=MOOD_LEVELS)
    stress_level = models.IntegerField(choices=MOOD_LEVELS)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.patient} - Mood: {self.mood_level} - {self.created_at}"


class CoachCheckIn(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('missed', 'Missed'),
        ('cancelled', 'Cancelled'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    scheduled_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    coach_notes = models.TextField(blank=True)
    patient_feedback = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Check-in - {self.patient} - {self.scheduled_date}"


class MotivationalMessage(models.Model):
    MESSAGE_TYPES = [
        ('encouragement', 'Encouragement'),
        ('reminder', 'Reminder'),
        ('celebration', 'Celebration'),
        ('support', 'Support'),
    ]
    
    title = models.CharField(max_length=200)
    message = models.TextField()
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES)
    target_audience = models.CharField(max_length=20, choices=[
        ('all', 'All Patients'),
        ('low_engagement', 'Low Engagement'),
        ('high_risk', 'High Risk'),
        ('progressing', 'Progressing'),
    ])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title


class PatientMessage(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    message = models.ForeignKey(MotivationalMessage, on_delete=models.CASCADE)
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.patient} - {self.message.title}"