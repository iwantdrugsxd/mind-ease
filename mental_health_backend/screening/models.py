from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    firebase_uid = models.CharField(max_length=255, unique=True)
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"


class PHQ9Screening(models.Model):
    SEVERITY_CHOICES = [
        ('minimal', 'Minimal'),
        ('mild', 'Mild'),
        ('moderate', 'Moderate'),
        ('moderately_severe', 'Moderately Severe'),
        ('severe', 'Severe'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='phq9_screenings')
    
    # PHQ-9 Questions (0-3 scale)
    q1_interest = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q2_depressed = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q3_sleep = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q4_energy = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q5_appetite = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q6_self_esteem = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q7_concentration = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q8_psychomotor = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q9_suicidal = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    
    total_score = models.IntegerField()
    severity_level = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    
    # Risk assessment
    requires_immediate_attention = models.BooleanField(default=False)
    requires_teleconsult = models.BooleanField(default=False)
    risk_level = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ])
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        # Calculate total score
        self.total_score = (
            self.q1_interest + self.q2_depressed + self.q3_sleep + 
            self.q4_energy + self.q5_appetite + self.q6_self_esteem + 
            self.q7_concentration + self.q8_psychomotor + self.q9_suicidal
        )
        
        # Determine severity level
        if self.total_score <= 4:
            self.severity_level = 'minimal'
        elif self.total_score <= 9:
            self.severity_level = 'mild'
        elif self.total_score <= 14:
            self.severity_level = 'moderate'
        elif self.total_score <= 19:
            self.severity_level = 'moderately_severe'
        else:
            self.severity_level = 'severe'
        
        # Risk assessment
        if self.total_score >= 15 or self.q9_suicidal >= 2:
            self.requires_immediate_attention = True
            self.requires_teleconsult = True
            self.risk_level = 'critical'
        elif self.total_score >= 10:
            self.requires_teleconsult = True
            self.risk_level = 'high'
        elif self.total_score >= 5:
            self.risk_level = 'medium'
        else:
            self.risk_level = 'low'
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"PHQ-9 Screening - {self.patient} - Score: {self.total_score}"


class GAD7Screening(models.Model):
    SEVERITY_CHOICES = [
        ('minimal', 'Minimal'),
        ('mild', 'Mild'),
        ('moderate', 'Moderate'),
        ('severe', 'Severe'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='gad7_screenings')
    
    # GAD-7 Questions (0-3 scale)
    q1_nervous = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q2_worry = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q3_worry_control = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q4_trouble_relaxing = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q5_restless = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q6_irritable = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    q7_afraid = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(3)])
    
    total_score = models.IntegerField()
    severity_level = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    
    # Risk assessment
    requires_immediate_attention = models.BooleanField(default=False)
    requires_teleconsult = models.BooleanField(default=False)
    risk_level = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ])
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        # Calculate total score
        self.total_score = (
            self.q1_nervous + self.q2_worry + self.q3_worry_control + 
            self.q4_trouble_relaxing + self.q5_restless + self.q6_irritable + 
            self.q7_afraid
        )
        
        # Determine severity level
        if self.total_score <= 4:
            self.severity_level = 'minimal'
        elif self.total_score <= 9:
            self.severity_level = 'mild'
        elif self.total_score <= 14:
            self.severity_level = 'moderate'
        else:
            self.severity_level = 'severe'
        
        # Risk assessment
        if self.total_score >= 15:
            self.requires_immediate_attention = True
            self.requires_teleconsult = True
            self.risk_level = 'critical'
        elif self.total_score >= 10:
            self.requires_teleconsult = True
            self.risk_level = 'high'
        elif self.total_score >= 5:
            self.risk_level = 'medium'
        else:
            self.risk_level = 'low'
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"GAD-7 Screening - {self.patient} - Score: {self.total_score}"


class ScreeningAlert(models.Model):
    ALERT_TYPES = [
        ('phq9_high_score', 'PHQ-9 High Score'),
        ('gad7_high_score', 'GAD-7 High Score'),
        ('suicidal_ideation', 'Suicidal Ideation'),
        ('score_increase', 'Significant Score Increase'),
        ('crisis', 'Crisis Situation'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Alert - {self.patient} - {self.alert_type}"


class TeleconsultReferral(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    phq9_screening = models.ForeignKey(PHQ9Screening, on_delete=models.CASCADE, null=True, blank=True)
    gad7_screening = models.ForeignKey(GAD7Screening, on_delete=models.CASCADE, null=True, blank=True)
    reason = models.TextField()
    priority = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    scheduled_date = models.DateTimeField(null=True, blank=True)
    clinician_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Teleconsult - {self.patient} - {self.status}"


class ChatbotConversation(models.Model):
    """Stores chatbot conversation sessions"""
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='chatbot_conversations')
    session_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Conversation - {self.patient} - {self.session_id}"


class ChatbotMessage(models.Model):
    """Stores individual messages in chatbot conversations"""
    MESSAGE_TYPES = [
        ('user', 'User Message'),
        ('bot', 'Bot Response'),
    ]
    
    conversation = models.ForeignKey(ChatbotConversation, on_delete=models.CASCADE, related_name='messages')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES)
    content = models.TextField()
    
    # NLP analysis results
    detected_emotion = models.CharField(max_length=50, blank=True)
    emotion_confidence = models.FloatField(null=True, blank=True)
    risk_level = models.CharField(max_length=20, blank=True)
    risk_keywords = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.message_type} - {self.conversation} - {self.created_at}"