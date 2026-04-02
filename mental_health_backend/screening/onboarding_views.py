from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .identity import get_or_create_patient_for_request, resolve_identity
from .onboarding_service import (
    build_user_state_summary,
    complete_onboarding_if_ready,
    get_onboarding_summary,
    mark_account_step_completed,
    mark_assessment_completed,
    offer_assessment,
    update_baseline,
    update_consent,
    update_preferences,
    update_profile,
)
from .serializers import (
    OnboardingSummarySerializer,
    PatientBaselineSerializer,
    PatientConsentSerializer,
    PatientPreferencesSerializer,
    PatientProfileSerializer,
)
from .models import Patient


class OnboardingViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _require_patient(self, request) -> Patient:
        user, patient, _ = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if patient is None:
            raise ValueError("Unable to resolve patient for onboarding.")
        # Mark account step done after login/creation
        mark_account_step_completed(patient)
        return patient

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        patient = self._require_patient(request)
        summary = get_onboarding_summary(patient)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['get'], url_path='state')
    def state(self, request):
        patient = self._require_patient(request)
        return Response(build_user_state_summary(patient))

    @action(detail=False, methods=['patch'], url_path='profile')
    def profile(self, request):
        patient = self._require_patient(request)
        serializer = PatientProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        summary = update_profile(patient, serializer.validated_data)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['patch'], url_path='baseline')
    def baseline(self, request):
        patient = self._require_patient(request)
        serializer = PatientBaselineSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        summary = update_baseline(patient, serializer.validated_data)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['patch'], url_path='consent')
    def consent(self, request):
        patient = self._require_patient(request)
        serializer = PatientConsentSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Require both required consents to be true when present
        if 'data_usage_consent_given' in data and not data['data_usage_consent_given']:
            return Response({'error': 'Data usage consent is required'}, status=status.HTTP_400_BAD_REQUEST)
        if 'emergency_disclaimer_acknowledged' in data and not data['emergency_disclaimer_acknowledged']:
            return Response({'error': 'Emergency disclaimer acknowledgement is required'}, status=status.HTTP_400_BAD_REQUEST)
        summary = update_consent(patient, data)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['patch'], url_path='preferences')
    def preferences(self, request):
        patient = self._require_patient(request)
        serializer = PatientPreferencesSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        summary = update_preferences(patient, serializer.validated_data)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['patch'], url_path='advanced')
    def advanced(self, request):
        """
        Persist optional advanced details across Patient and Preferences.
        """
        patient = self._require_patient(request)
        preferred_time = request.data.get('preferred_time_of_day')
        if preferred_time:
            pref_serializer = PatientPreferencesSerializer(data={"preferred_time_of_day": preferred_time}, partial=True)
            pref_serializer.is_valid(raise_exception=True)
            update_preferences(patient, pref_serializer.validated_data)

        # Optional emergency contact fields live on Patient in current schema.
        updated = False
        if 'emergency_contact' in request.data:
            patient.emergency_contact = request.data.get('emergency_contact') or ''
            updated = True
        if 'emergency_phone' in request.data:
            patient.emergency_phone = request.data.get('emergency_phone') or ''
            updated = True
        if updated:
            patient.save(update_fields=['emergency_contact', 'emergency_phone', 'updated_at'])

        summary = get_onboarding_summary(patient)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['post'], url_path='assessment/offer')
    def assessment_offer(self, request):
        patient = self._require_patient(request)
        offered = bool(request.data.get('offered', True))
        summary = offer_assessment(patient, offered=offered)
        return Response(OnboardingSummarySerializer(summary).data)

    @action(detail=False, methods=['post'], url_path='assessment/phq9')
    def assessment_phq9(self, request):
        """
        Reuse existing PHQ9 creation by proxying to existing ViewSet logic via serializer expectation.
        Expected keys: q1_interest..q9_suicidal (0-3 each)
        """
        from .serializers import PHQ9ScreeningSerializer
        from .models import PHQ9Screening

        patient = self._require_patient(request)
        payload = request.data.copy()
        payload['patient'] = patient.id  # serializer requires patient id

        serializer = PHQ9ScreeningSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        screening = PHQ9Screening.objects.create(
            patient=patient,
            **{k: serializer.validated_data[k] for k in [
                'q1_interest','q2_depressed','q3_sleep','q4_energy','q5_appetite',
                'q6_self_esteem','q7_concentration','q8_psychomotor','q9_suicidal'
            ]}
        )
        # Save triggers score/severity
        screening.save()
        summary = mark_assessment_completed(patient)
        return Response(OnboardingSummarySerializer(summary).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='assessment/gad7')
    def assessment_gad7(self, request):
        """
        Reuse existing GAD7 creation by proxying to existing ViewSet logic via serializer expectation.
        Expected keys: q1_nervous..q7_afraid (0-3 each)
        """
        from .serializers import GAD7ScreeningSerializer
        from .models import GAD7Screening

        patient = self._require_patient(request)
        payload = request.data.copy()
        payload['patient'] = patient.id

        serializer = GAD7ScreeningSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        screening = GAD7Screening.objects.create(
            patient=patient,
            **{k: serializer.validated_data[k] for k in [
                'q1_nervous','q2_worry','q3_worry_control','q4_trouble_relaxing',
                'q5_restless','q6_irritable','q7_afraid'
            ]}
        )
        screening.save()
        summary = mark_assessment_completed(patient)
        return Response(OnboardingSummarySerializer(summary).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='complete')
    def complete(self, request):
        patient = self._require_patient(request)
        summary = complete_onboarding_if_ready(patient)
        return Response(OnboardingSummarySerializer(summary).data)

