"""
Triage Service Module
Implements the deterministic Rule Engine for PHQ-9 and GAD-7 assessments
Based on clinical guidelines and validated screening tools
"""

from django.utils import timezone
from datetime import timedelta
from .models import (
    Patient, PHQ9Screening, GAD7Screening, 
    ScreeningAlert, TeleconsultReferral
)
from .tasks import send_alert_notification


class TriageService:
    """
    Core Triage Service - A deterministic Rule Engine (NOT an ML model)
    Processes PHQ-9 and GAD-7 scores based on clinical guidelines
    """
    
    # PHQ-9 Severity Levels (Clinical Guidelines)
    PHQ9_SEVERITY = {
        'minimal': (0, 4),
        'mild': (5, 9),
        'moderate': (10, 14),
        'moderately_severe': (15, 19),
        'severe': (20, 27)
    }
    
    # GAD-7 Severity Levels (Clinical Guidelines)
    GAD7_SEVERITY = {
        'minimal': (0, 4),
        'mild': (5, 9),
        'moderate': (10, 14),
        'severe': (15, 21)
    }
    
    def calculate_phq9(self, answers):
        """
        Calculate PHQ-9 score and determine severity level
        
        Args:
            answers: List of 9 integers (0-3) representing responses to PHQ-9 questions
            
        Returns:
            dict: {
                'total_score': int,
                'severity_level': str,
                'severity_label': str
            }
        """
        if not answers or len(answers) != 9:
            raise ValueError("PHQ-9 requires exactly 9 answers (0-3 each)")
        
        # Validate answers are in range
        for i, answer in enumerate(answers):
            if not isinstance(answer, int) or answer < 0 or answer > 3:
                raise ValueError(f"PHQ-9 answer {i+1} must be between 0 and 3")
        
        # Calculate total score (sum of all answers)
        total_score = sum(answers)
        
        # Determine severity level
        severity_level = self._get_phq9_severity(total_score)
        
        return {
            'total_score': total_score,
            'severity_level': severity_level,
            'severity_label': self._get_severity_label(severity_level, 'phq9')
        }
    
    def calculate_gad7(self, answers):
        """
        Calculate GAD-7 score and determine severity level
        
        Args:
            answers: List of 7 integers (0-3) representing responses to GAD-7 questions
            
        Returns:
            dict: {
                'total_score': int,
                'severity_level': str,
                'severity_label': str
            }
        """
        if not answers or len(answers) != 7:
            raise ValueError("GAD-7 requires exactly 7 answers (0-3 each)")
        
        # Validate answers are in range
        for i, answer in enumerate(answers):
            if not isinstance(answer, int) or answer < 0 or answer > 3:
                raise ValueError(f"GAD-7 answer {i+1} must be between 0 and 3")
        
        # Calculate total score (sum of all answers)
        total_score = sum(answers)
        
        # Determine severity level
        severity_level = self._get_gad7_severity(total_score)
        
        return {
            'total_score': total_score,
            'severity_level': severity_level,
            'severity_label': self._get_severity_label(severity_level, 'gad7')
        }
    
    def process_triage(self, patient_id, survey_type, score, severity_level):
        """
        Process triage rules and determine appropriate actions
        
        Rule 1: If PHQ-9 score >= 15, trigger teleconsult referral
        Rule 2: If change in PHQ-9 score >= 5 within 2 weeks, trigger clinician alert
        Rule 3: Based on score and level, recommend self-care pathway
        
        Args:
            patient_id: ID of the patient
            survey_type: 'phq9' or 'gad7'
            score: Total score from the screening
            severity_level: Severity level (e.g., 'moderate', 'severe')
            
        Returns:
            dict: {
                'triageAction': str,
                'recommendedModule': str,
                'alertCreated': bool,
                'referralCreated': bool
            }
        """
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            raise ValueError(f"Patient with ID {patient_id} not found")
        
        triage_action = 'None'
        recommended_module = None
        alert_created = False
        referral_created = False
        
        # Rule 1: Referral for high scores (PHQ-9 >= 15 or GAD-7 >= 15)
        if survey_type == 'phq9' and score >= 15:
            self._create_teleconsult_referral(patient, survey_type, score, 
                                            f"PHQ-9 score of {score} indicates {severity_level} depression")
            triage_action = 'TriggerReferral'
            referral_created = True
        
        elif survey_type == 'gad7' and score >= 15:
            self._create_teleconsult_referral(patient, survey_type, score,
                                            f"GAD-7 score of {score} indicates {severity_level} anxiety")
            triage_action = 'TriggerReferral'
            referral_created = True
        
        # Rule 2: Clinician Alert for significant score increase
        if survey_type == 'phq9':
            score_increase = self._check_score_increase(patient, survey_type, score)
            if score_increase and score_increase >= 5:
                self._create_clinician_alert(patient, survey_type, score_increase)
                if triage_action == 'None':
                    triage_action = 'TriggerClinicianAlert'
                alert_created = True
        
        # Rule 3: Self-Care Recommendations
        if triage_action == 'None':
            recommended_module = self._get_self_care_recommendation(survey_type, score, severity_level)
            if recommended_module:
                triage_action = 'RecommendSelfCare'
        
        return {
            'triageAction': triage_action,
            'recommendedModule': recommended_module,
            'alertCreated': alert_created,
            'referralCreated': referral_created
        }
    
    def _get_phq9_severity(self, score):
        """Determine PHQ-9 severity level based on score"""
        if score <= 4:
            return 'minimal'
        elif score <= 9:
            return 'mild'
        elif score <= 14:
            return 'moderate'
        elif score <= 19:
            return 'moderately_severe'
        else:
            return 'severe'
    
    def _get_gad7_severity(self, score):
        """Determine GAD-7 severity level based on score"""
        if score <= 4:
            return 'minimal'
        elif score <= 9:
            return 'mild'
        elif score <= 14:
            return 'moderate'
        else:
            return 'severe'
    
    def _get_severity_label(self, severity_level, survey_type):
        """Get human-readable severity label"""
        labels = {
            'minimal': 'Minimal',
            'mild': 'Mild',
            'moderate': 'Moderate',
            'moderately_severe': 'Moderately Severe',
            'severe': 'Severe'
        }
        return labels.get(severity_level, 'Unknown')
    
    def _check_score_increase(self, patient, survey_type, current_score):
        """
        Check for significant score increase within 2 weeks
        Returns the score increase if >= 5, None otherwise
        """
        two_weeks_ago = timezone.now() - timedelta(days=14)
        
        if survey_type == 'phq9':
            previous_screening = PHQ9Screening.objects.filter(
                patient=patient,
                created_at__gte=two_weeks_ago
            ).order_by('-created_at').first()
            
            if previous_screening:
                score_increase = current_score - previous_screening.total_score
                return score_increase if score_increase >= 5 else None
        
        elif survey_type == 'gad7':
            previous_screening = GAD7Screening.objects.filter(
                patient=patient,
                created_at__gte=two_weeks_ago
            ).order_by('-created_at').first()
            
            if previous_screening:
                score_increase = current_score - previous_screening.total_score
                return score_increase if score_increase >= 5 else None
        
        return None
    
    def _create_clinician_alert(self, patient, survey_type, score_increase):
        """Create alert for significant score increase"""
        alert = ScreeningAlert.objects.create(
            patient=patient,
            alert_type='score_increase',
            message=f"Significant {survey_type.upper()} score increase of {score_increase} points within 2 weeks. Patient requires clinician review."
        )
        send_alert_notification.delay(alert.id, priority='high')
        return alert
    
    def _create_teleconsult_referral(self, patient, survey_type, score, reason):
        """Create teleconsult referral for high scores"""
        referral = TeleconsultReferral.objects.create(
            patient=patient,
            reason=reason,
            priority='high' if score >= 15 else 'medium',
            status='pending'
        )
        return referral
    
    def _get_self_care_recommendation(self, survey_type, score, severity_level):
        """
        Recommend self-care module based on scores and severity
        Returns module name like "4-7-8 Breathing" or "Journaling"
        """
        # Mild symptoms - recommend breathing exercises
        if severity_level in ['minimal', 'mild']:
            if survey_type == 'gad7':
                return "4-7-8 Breathing"  # Good for anxiety
            else:
                return "Mindfulness Meditation"  # Good for depression
        
        # Moderate symptoms - recommend journaling and activity
        elif severity_level == 'moderate':
            if survey_type == 'gad7':
                return "Progressive Muscle Relaxation"
            else:
                return "Journaling and Gratitude"
        
        # Severe symptoms should have referral, but still recommend self-care
        else:
            return "Guided Relaxation Exercises"
    
    def get_comprehensive_assessment(self, phq9_score=None, gad7_score=None, 
                                   suicidal_ideation=False):
        """
        Get comprehensive risk assessment based on multiple factors
        Used for overall patient risk evaluation
        """
        risk_level = 'low'
        
        # Critical risk factors
        if suicidal_ideation:
            risk_level = 'critical'
        elif (phq9_score and phq9_score >= 20) or (gad7_score and gad7_score >= 15):
            risk_level = 'critical'
        # High risk
        elif (phq9_score and phq9_score >= 15) or (gad7_score and gad7_score >= 10):
            risk_level = 'high'
        # Medium risk
        elif (phq9_score and phq9_score >= 10) or (gad7_score and gad7_score >= 7):
            risk_level = 'medium'
        
        return {
            'riskLevel': risk_level,
            'phq9Score': phq9_score,
            'gad7Score': gad7_score,
            'recommendations': self._get_treatment_recommendations(risk_level)
        }
    
    def _get_treatment_recommendations(self, risk_level):
        """Get treatment recommendations based on risk level"""
        recommendations = {
            'critical': [
                'Immediate crisis intervention',
                'Crisis hotline: 988',
                'Emergency services: 911',
                '24/7 monitoring required'
            ],
            'high': [
                'Urgent teleconsultation within 24 hours',
                'Consider medication evaluation',
                'Intensive therapy program',
                'Regular safety checks'
            ],
            'medium': [
                'Teleconsultation within 1 week',
                'Self-care pathway activation',
                'Regular mood monitoring',
                'Therapy referral'
            ],
            'low': [
                'Self-care pathway',
                'Regular screening',
                'Lifestyle modifications',
                'Preventive measures'
            ]
        }
        return recommendations.get(risk_level, [])


# Singleton instance
triage_service = TriageService()




