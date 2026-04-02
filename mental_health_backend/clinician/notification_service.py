from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from twilio.rest import Client

from .models import Appointment, CareNotification, ConsultationCase, ConsultationMessage


def _safe_patient_email(case: ConsultationCase) -> str:
    email = (getattr(case.patient.user, "email", "") or "").strip()
    if not email or email.endswith("@firebase.local"):
        return ""
    return email


def _safe_patient_phone(case: ConsultationCase) -> str:
    return (getattr(case.patient, "phone_number", "") or "").strip()


def _create_notification_record(
    *,
    case: ConsultationCase,
    notification_type: str,
    channel: str,
    title: str,
    body: str,
    status: str,
    destination: str = "",
    error_message: str = "",
    related_message: ConsultationMessage = None,
    related_appointment: Appointment = None,
) -> CareNotification:
    delivered_at = timezone.now() if status == CareNotification.DeliveryStatus.SENT else None
    return CareNotification.objects.create(
        patient=case.patient,
        clinician=case.assigned_clinician,
        consultation_case=case,
        related_message=related_message,
        related_appointment=related_appointment,
        notification_type=notification_type,
        channel=channel,
        recipient_role=CareNotification.RecipientRole.PATIENT,
        title=title,
        body=body,
        status=status,
        destination=destination,
        error_message=error_message,
        delivered_at=delivered_at,
    )


def send_patient_care_notification(
    *,
    case: ConsultationCase,
    notification_type: str,
    title: str,
    body: str,
    related_message: ConsultationMessage = None,
    related_appointment: Appointment = None,
    send_email_delivery: bool = True,
    send_sms_delivery: bool = False,
    email_subject: str = "",
    email_body: str = "",
    sms_body: str = "",
):
    """
    Creates a durable in-app notification and best-effort outbound delivery records.
    Outbound messages remain privacy-safe: they should never include sensitive message bodies.
    """
    _create_notification_record(
        case=case,
        notification_type=notification_type,
        channel=CareNotification.Channel.IN_APP,
        title=title,
        body=body,
        status=CareNotification.DeliveryStatus.SENT,
        related_message=related_message,
        related_appointment=related_appointment,
    )

    patient_email = _safe_patient_email(case)
    if send_email_delivery:
        if not patient_email or not settings.EMAIL_HOST_USER:
            _create_notification_record(
                case=case,
                notification_type=notification_type,
                channel=CareNotification.Channel.EMAIL,
                title=title,
                body=email_body or body,
                status=CareNotification.DeliveryStatus.SKIPPED,
                destination=patient_email,
                error_message="Email delivery not configured or patient email unavailable.",
                related_message=related_message,
                related_appointment=related_appointment,
            )
        else:
            try:
                send_mail(
                    email_subject or title,
                    email_body or body,
                    settings.EMAIL_HOST_USER,
                    [patient_email],
                    fail_silently=False,
                )
                _create_notification_record(
                    case=case,
                    notification_type=notification_type,
                    channel=CareNotification.Channel.EMAIL,
                    title=title,
                    body=email_body or body,
                    status=CareNotification.DeliveryStatus.SENT,
                    destination=patient_email,
                    related_message=related_message,
                    related_appointment=related_appointment,
                )
            except Exception as exc:
                _create_notification_record(
                    case=case,
                    notification_type=notification_type,
                    channel=CareNotification.Channel.EMAIL,
                    title=title,
                    body=email_body or body,
                    status=CareNotification.DeliveryStatus.FAILED,
                    destination=patient_email,
                    error_message=str(exc),
                    related_message=related_message,
                    related_appointment=related_appointment,
                )

    patient_phone = _safe_patient_phone(case)
    if send_sms_delivery:
        if not patient_phone or not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
            _create_notification_record(
                case=case,
                notification_type=notification_type,
                channel=CareNotification.Channel.SMS,
                title=title,
                body=sms_body or body,
                status=CareNotification.DeliveryStatus.SKIPPED,
                destination=patient_phone,
                error_message="SMS delivery not configured or patient phone unavailable.",
                related_message=related_message,
                related_appointment=related_appointment,
            )
        else:
            try:
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                client.messages.create(
                    body=sms_body or body,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=patient_phone,
                )
                _create_notification_record(
                    case=case,
                    notification_type=notification_type,
                    channel=CareNotification.Channel.SMS,
                    title=title,
                    body=sms_body or body,
                    status=CareNotification.DeliveryStatus.SENT,
                    destination=patient_phone,
                    related_message=related_message,
                    related_appointment=related_appointment,
                )
            except Exception as exc:
                _create_notification_record(
                    case=case,
                    notification_type=notification_type,
                    channel=CareNotification.Channel.SMS,
                    title=title,
                    body=sms_body or body,
                    status=CareNotification.DeliveryStatus.FAILED,
                    destination=patient_phone,
                    error_message=str(exc),
                    related_message=related_message,
                    related_appointment=related_appointment,
                )


def retry_failed_notification(notification: CareNotification) -> CareNotification:
    if notification.channel == CareNotification.Channel.IN_APP:
        notification.status = CareNotification.DeliveryStatus.SENT
        notification.delivered_at = timezone.now()
        notification.error_message = ""
        notification.save(update_fields=["status", "delivered_at", "error_message", "updated_at"])
        return notification

    if notification.channel == CareNotification.Channel.EMAIL:
        if not notification.destination or not settings.EMAIL_HOST_USER:
            notification.status = CareNotification.DeliveryStatus.SKIPPED
            notification.error_message = "Email delivery not configured or destination unavailable."
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return notification
        try:
            send_mail(
                notification.title,
                notification.body,
                settings.EMAIL_HOST_USER,
                [notification.destination],
                fail_silently=False,
            )
            notification.status = CareNotification.DeliveryStatus.SENT
            notification.delivered_at = timezone.now()
            notification.error_message = ""
            notification.save(update_fields=["status", "delivered_at", "error_message", "updated_at"])
            return notification
        except Exception as exc:
            notification.status = CareNotification.DeliveryStatus.FAILED
            notification.error_message = str(exc)
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return notification

    if notification.channel == CareNotification.Channel.SMS:
        if not notification.destination or not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
            notification.status = CareNotification.DeliveryStatus.SKIPPED
            notification.error_message = "SMS delivery not configured or destination unavailable."
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return notification
        try:
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=notification.body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=notification.destination,
            )
            notification.status = CareNotification.DeliveryStatus.SENT
            notification.delivered_at = timezone.now()
            notification.error_message = ""
            notification.save(update_fields=["status", "delivered_at", "error_message", "updated_at"])
            return notification
        except Exception as exc:
            notification.status = CareNotification.DeliveryStatus.FAILED
            notification.error_message = str(exc)
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return notification

    return notification
