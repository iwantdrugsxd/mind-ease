from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from twilio.rest import Client
from .models import ScreeningAlert, TeleconsultReferral
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_alert_notification(alert_id, priority='normal'):
    """Send alert notification via email and SMS"""
    try:
        alert = ScreeningAlert.objects.get(id=alert_id)
        patient = alert.patient
        
        # Email notification
        subject = f"Mental Health Alert - {alert.alert_type.replace('_', ' ').title()}"
        message = f"""
        Alert for {patient.user.get_full_name()}:
        
        Type: {alert.alert_type.replace('_', ' ').title()}
        Message: {alert.message}
        Time: {alert.created_at}
        
        Please review and take appropriate action.
        """
        
        # Send to clinicians (in real app, would query assigned clinicians)
        send_mail(
            subject,
            message,
            settings.EMAIL_HOST_USER,
            ['clinician@example.com'],  # Replace with actual clinician emails
            fail_silently=False,
        )
        
        # SMS notification for critical alerts
        if priority == 'critical' and patient.phone_number:
            send_sms_notification.delay(
                patient.phone_number,
                f"URGENT: Mental health alert requires immediate attention. Please contact your healthcare provider or call 988."
            )
        
        logger.info(f"Alert notification sent for alert {alert_id}")
        
    except Exception as e:
        logger.error(f"Failed to send alert notification: {str(e)}")


@shared_task
def send_sms_notification(phone_number, message):
    """Send SMS notification via Twilio"""
    try:
        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
            logger.warning("Twilio credentials not configured")
            return
        
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        
        logger.info(f"SMS sent to {phone_number}")
        
    except Exception as e:
        logger.error(f"Failed to send SMS: {str(e)}")


@shared_task
def schedule_teleconsult(referral_id):
    """Schedule teleconsultation appointment"""
    try:
        referral = TeleconsultReferral.objects.get(id=referral_id)
        
        # In a real implementation, this would:
        # 1. Find available clinicians
        # 2. Schedule appointment
        # 3. Send calendar invites
        # 4. Notify patient and clinician
        
        # For now, just log the action
        logger.info(f"Teleconsult scheduled for referral {referral_id}")
        
        # Update referral status
        referral.status = 'scheduled'
        referral.save()
        
    except Exception as e:
        logger.error(f"Failed to schedule teleconsult: {str(e)}")


@shared_task
def send_weekly_check_in(patient_id):
    """Send weekly check-in message to patient"""
    try:
        from screening.models import Patient
        from selfcare.models import MotivationalMessage, PatientMessage
        
        patient = Patient.objects.get(id=patient_id)
        
        # Get appropriate motivational message
        message = MotivationalMessage.objects.filter(
            is_active=True,
            target_audience__in=['all', 'low_engagement']
        ).order_by('?').first()
        
        if message:
            PatientMessage.objects.create(
                patient=patient,
                message=message
            )
            
            # Send email notification
            send_mail(
                f"Weekly Check-in: {message.title}",
                message.message,
                settings.EMAIL_HOST_USER,
                [patient.user.email],
                fail_silently=False,
            )
        
        logger.info(f"Weekly check-in sent to patient {patient_id}")
        
    except Exception as e:
        logger.error(f"Failed to send weekly check-in: {str(e)}")


@shared_task
def process_score_trends():
    """Process patient score trends and generate insights"""
    try:
        from screening.models import PHQ9Screening, GAD7Screening
        from clinician.models import PatientTrend
        from datetime import date, timedelta
        
        # Get all patients with recent screenings
        recent_date = date.today() - timedelta(days=7)
        
        # Process PHQ-9 trends
        phq9_screenings = PHQ9Screening.objects.filter(
            created_at__date__gte=recent_date
        ).select_related('patient')
        
        for screening in phq9_screenings:
            PatientTrend.objects.update_or_create(
                patient=screening.patient,
                date=screening.created_at.date(),
                defaults={
                    'phq9_score': screening.total_score,
                    'phq9_severity': screening.severity_level,
                    'risk_level': screening.risk_level
                }
            )
        
        # Process GAD-7 trends
        gad7_screenings = GAD7Screening.objects.filter(
            created_at__date__gte=recent_date
        ).select_related('patient')
        
        for screening in gad7_screenings:
            PatientTrend.objects.update_or_create(
                patient=screening.patient,
                date=screening.created_at.date(),
                defaults={
                    'gad7_score': screening.total_score,
                    'gad7_severity': screening.severity_level,
                    'risk_level': screening.risk_level
                }
            )
        
        logger.info("Score trends processed successfully")
        
    except Exception as e:
        logger.error(f"Failed to process score trends: {str(e)}")









