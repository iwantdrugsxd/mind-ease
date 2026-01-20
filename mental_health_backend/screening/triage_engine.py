from django.utils import timezone
from datetime import timedelta
from .models import ScreeningAlert, TeleconsultReferral, PHQ9Screening, GAD7Screening
from .tasks import send_alert_notification, schedule_teleconsult
from .nlp_utils import emotion_detector


class TriageEngine:
    """
    Triage engine for mental health screening assessments
    Implements PHQ-9 and GAD-7 scoring and risk assessment logic
    """
    
    def process_phq9_screening(self, screening):
        """Process PHQ-9 screening and generate alerts/referrals as needed"""
        patient = screening.patient
        
        # Check for immediate crisis (suicidal ideation)
        if screening.q9_suicidal >= 2:
            self._create_crisis_alert(patient, screening, 'suicidal_ideation')
            self._create_urgent_referral(patient, screening, 'Suicidal ideation detected')
            return
        
        # Check for high PHQ-9 score
        if screening.total_score >= 15:
            self._create_alert(patient, screening, 'phq9_high_score', 
                             f'PHQ-9 score of {screening.total_score} indicates severe depression')
            self._create_teleconsult_referral(patient, screening, 'High PHQ-9 score')
        
        # Check for significant score increase
        self._check_score_increase(patient, screening, 'phq9')
    
    def process_gad7_screening(self, screening):
        """Process GAD-7 screening and generate alerts/referrals as needed"""
        patient = screening.patient
        
        # Check for high GAD-7 score
        if screening.total_score >= 15:
            self._create_alert(patient, screening, 'gad7_high_score',
                             f'GAD-7 score of {screening.total_score} indicates severe anxiety')
            self._create_teleconsult_referral(patient, screening, 'High GAD-7 score')
        
        # Check for significant score increase
        self._check_score_increase(patient, screening, 'gad7')
    
    def _create_crisis_alert(self, patient, screening, alert_type):
        """Create immediate crisis alert"""
        alert = ScreeningAlert.objects.create(
            patient=patient,
            alert_type=alert_type,
            message="CRISIS ALERT: Immediate attention required. Patient needs urgent intervention."
        )
        
        # Send immediate notification
        send_alert_notification.delay(alert.id, priority='critical')
    
    def _create_alert(self, patient, screening, alert_type, message):
        """Create standard alert"""
        alert = ScreeningAlert.objects.create(
            patient=patient,
            alert_type=alert_type,
            message=message
        )
        
        # Send notification
        send_alert_notification.delay(alert.id, priority='high')
    
    def _create_urgent_referral(self, patient, screening, reason):
        """Create urgent teleconsult referral"""
        referral = TeleconsultReferral.objects.create(
            patient=patient,
            phq9_screening=screening if hasattr(screening, 'q1_interest') else None,
            gad7_screening=screening if hasattr(screening, 'q1_nervous') else None,
            reason=reason,
            priority='urgent',
            status='pending'
        )
        
        # Schedule immediate teleconsult
        schedule_teleconsult.delay(referral.id)
    
    def _create_teleconsult_referral(self, patient, screening, reason):
        """Create standard teleconsult referral"""
        referral = TeleconsultReferral.objects.create(
            patient=patient,
            phq9_screening=screening if hasattr(screening, 'q1_interest') else None,
            gad7_screening=screening if hasattr(screening, 'q1_nervous') else None,
            reason=reason,
            priority='high',
            status='pending'
        )
    
    def _check_score_increase(self, patient, current_screening, screening_type):
        """Check for significant score increase over time"""
        # Look for previous screening within last 2 weeks
        two_weeks_ago = timezone.now() - timedelta(days=14)
        
        if screening_type == 'phq9':
            previous_screening = PHQ9Screening.objects.filter(
                patient=patient,
                created_at__gte=two_weeks_ago
            ).exclude(id=current_screening.id).order_by('-created_at').first()
        else:  # gad7
            previous_screening = GAD7Screening.objects.filter(
                patient=patient,
                created_at__gte=two_weeks_ago
            ).exclude(id=current_screening.id).order_by('-created_at').first()
        
        if previous_screening:
            score_increase = current_screening.total_score - previous_screening.total_score
            
            # Alert if score increased by 5 or more points
            if score_increase >= 5:
                self._create_alert(
                    patient, 
                    current_screening, 
                    'score_increase',
                    f'Significant {screening_type.upper()} score increase of {score_increase} points in 2 weeks'
                )
    
    def assess_risk_level(self, phq9_score, gad7_score, suicidal_ideation=False):
        """Assess overall risk level based on multiple factors"""
        if suicidal_ideation or phq9_score >= 20 or gad7_score >= 15:
            return 'critical'
        elif phq9_score >= 15 or gad7_score >= 10:
            return 'high'
        elif phq9_score >= 10 or gad7_score >= 7:
            return 'medium'
        else:
            return 'low'
    
    def get_recommendations(self, phq9_score, gad7_score, risk_level):
        """Get treatment recommendations based on scores and risk level"""
        recommendations = []
        
        if risk_level == 'critical':
            recommendations.extend([
                'Immediate crisis intervention required',
                'Consider hospitalization',
                '24/7 monitoring',
                'Crisis hotline contact'
            ])
        elif risk_level == 'high':
            recommendations.extend([
                'Urgent teleconsultation within 24 hours',
                'Consider medication evaluation',
                'Intensive therapy program',
                'Regular safety checks'
            ])
        elif risk_level == 'medium':
            recommendations.extend([
                'Teleconsultation within 1 week',
                'Self-care pathway activation',
                'Regular mood monitoring',
                'Therapy referral'
            ])
        else:
            recommendations.extend([
                'Self-care pathway',
                'Regular screening',
                'Lifestyle modifications',
                'Preventive measures'
            ])
        
        return recommendations






