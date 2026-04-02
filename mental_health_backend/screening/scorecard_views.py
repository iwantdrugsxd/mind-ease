from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets

from .identity import resolve_identity
from .scorecard_service import build_patient_scorecard


class PatientScorecardViewSet(viewsets.ViewSet):
    """
    Read-only patient scorecard. Uses orchestration in readonly mode (no onboarding row creation on GET).
    Phase III: enriched continuity/mood summaries; clinician lists use build_clinician_patient_summary (same core).
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        _user, patient, _uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if patient is None:
            return Response(
                {"detail": "Patient profile not found for authenticated user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        payload = build_patient_scorecard(patient)
        return Response(payload)
