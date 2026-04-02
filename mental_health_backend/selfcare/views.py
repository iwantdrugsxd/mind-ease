from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Avg, Count, Q
from django.utils import timezone
from datetime import timedelta
from .models import (SelfCareExercise, SelfCarePathway, PatientSelfCareProgress,
                    ExerciseCompletion, MoodEntry, CoachCheckIn, PatientMessage)
from .serializers import (SelfCareExerciseSerializer, SelfCarePathwaySerializer,
                         PatientSelfCareProgressSerializer, ExerciseCompletionSerializer,
                         MoodEntrySerializer, CoachCheckInSerializer, PatientMessageSerializer)
from screening.models import Patient
from screening.identity import get_or_create_patient_for_request, resolve_identity
from screening.onboarding_service import build_initial_recommendation, build_user_state_summary


class SelfCareExerciseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SelfCareExercise.objects.filter(is_active=True)
    serializer_class = SelfCareExerciseSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        exercise_type = request.query_params.get('type')
        if exercise_type:
            exercises = self.queryset.filter(exercise_type=exercise_type)
            serializer = self.get_serializer(exercises, many=True)
            return Response(serializer.data)
        return Response({'error': 'Type parameter required'}, status=status.HTTP_400_BAD_REQUEST)


class SelfCarePathwayViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SelfCarePathway.objects.filter(is_active=True)
    serializer_class = SelfCarePathwaySerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def recommended(self, request):
        try:
            _, patient, _ = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
            if not patient:
                return Response([])

            rec = build_initial_recommendation(patient)
            risk_level = rec.get("risk_level", "low")
            if risk_level in ("high", "critical"):
                target_severity = "severe"
            elif risk_level == "medium":
                target_severity = "moderate"
            else:
                target_severity = "mild"

            pathways = self.queryset.filter(target_severity=target_severity)
            if not pathways.exists():
                pathways = self.queryset.filter(target_severity="minimal")
            serializer = self.get_serializer(pathways, many=True)
            return Response(serializer.data)
        except Exception:
            # Fallback for compatibility
            serializer = self.get_serializer(self.queryset.filter(target_severity="minimal"), many=True)
            return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='onboarding-recommended')
    def onboarding_recommended(self, request):
        _, patient, _ = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({"pathways": [], "recommendation": None, "recommended_exercises": [], "activity_summary": {}})
        rec = build_initial_recommendation(patient)
        state = build_user_state_summary(patient)
        risk_level = rec.get("risk_level", "low")
        if risk_level in ("high", "critical"):
            target_severity = "severe"
        elif risk_level == "medium":
            target_severity = "moderate"
        else:
            target_severity = "mild"
        pathways = self.queryset.filter(target_severity=target_severity)
        if not pathways.exists():
            pathways = self.queryset.filter(target_severity="minimal")
        exercise_type_hint = rec.get("exercise_type_hint")
        exercise_qs = SelfCareExercise.objects.filter(is_active=True)
        if exercise_type_hint:
            exercise_qs = exercise_qs.filter(exercise_type=exercise_type_hint)
        recommended_exercises = exercise_qs.order_by("duration_minutes")[:6]
        serializer = self.get_serializer(pathways, many=True)
        return Response({
            "pathways": serializer.data,
            "recommendation": rec,
            "recommended_exercises": SelfCareExerciseSerializer(recommended_exercises, many=True).data,
            "activity_summary": state.get("activity", {}),
            "continuity": state.get("continuity", {}),
            "reassessment": state.get("reassessment", {}),
            "next_best_action": state.get("next_best_action", {}),
            "readiness": state.get("readiness", {}),
            "lifestyle_insights": state.get("lifestyle_insights", {}),
        })


class PatientSelfCareProgressViewSet(viewsets.ModelViewSet):
    queryset = PatientSelfCareProgress.objects.all()
    serializer_class = PatientSelfCareProgressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return PatientSelfCareProgress.objects.none()
        return PatientSelfCareProgress.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        _, patient, _ = get_or_create_patient_for_request(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            raise serializers.ValidationError({'error': 'Unable to resolve patient'})
        serializer.save(patient=patient)
    
    @action(detail=True, methods=['post'])
    def complete_exercise(self, request, pk=None):
        progress = self.get_object()
        exercise_id = request.data.get('exercise_id')
        
        if not exercise_id:
            return Response({'error': 'Exercise ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            exercise = SelfCareExercise.objects.get(id=exercise_id)
            
            # Create completion record
            completion = ExerciseCompletion.objects.create(
                patient=progress.patient,
                exercise=exercise,
                duration_actual=request.data.get('duration_actual'),
                rating=request.data.get('rating'),
                notes=request.data.get('notes', '')
            )
            
            # Update progress
            progress.progress_percentage = min(100.0, progress.progress_percentage + 10.0)
            if progress.progress_percentage >= 100.0:
                progress.is_completed = True
                progress.completed_at = timezone.now()
            
            progress.save()
            
            return Response({'message': 'Exercise completed successfully'})
            
        except SelfCareExercise.DoesNotExist:
            return Response({'error': 'Exercise not found'}, status=status.HTTP_404_NOT_FOUND)


class ExerciseCompletionViewSet(viewsets.ModelViewSet):
    queryset = ExerciseCompletion.objects.all()
    serializer_class = ExerciseCompletionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return ExerciseCompletion.objects.none()
        return ExerciseCompletion.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        _, patient, _ = get_or_create_patient_for_request(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            raise serializers.ValidationError({'error': 'Unable to resolve patient'})
        serializer.save(patient=patient)


class MoodEntryViewSet(viewsets.ModelViewSet):
    queryset = MoodEntry.objects.all()
    serializer_class = MoodEntrySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if patient:
            return MoodEntry.objects.filter(patient=patient).order_by('-created_at')
        return MoodEntry.objects.none()
    
    def create(self, request, *args, **kwargs):
        """Override create to handle patient creation and better error handling"""
        import logging
        
        logger = logging.getLogger(__name__)
        logger.info(f"Creating mood entry - User authenticated: {request.user.is_authenticated}, Data: {request.data}")
        
        _, patient, firebase_uid = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if patient:
            logger.info(f"Resolved patient {patient.id} for mood entry; firebase_uid={firebase_uid or 'n/a'}")
        
        if not patient:
            logger.error("No patient found or created")
            return Response(
                {'error': 'Authenticated patient identity is required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Prepare data for serializer (exclude firebase_uid as it's not a model field)
        serializer_data = {
            'mood_level': request.data.get('mood_level'),
            'energy_level': request.data.get('energy_level', 3),
            'sleep_quality': request.data.get('sleep_quality', 3),
            'stress_level': request.data.get('stress_level', 3),
            'notes': request.data.get('notes', ''),
        }
        
        # Create serializer with patient
        serializer = self.get_serializer(data=serializer_data)
        if serializer.is_valid():
            mood_entry = serializer.save(patient=patient)
            logger.info(f"Mood entry created successfully: ID={mood_entry.id}, Patient={patient.id}, Mood={mood_entry.mood_level}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            logger.error(f"Serializer validation errors: {serializer.errors}")
            return Response({'error': 'Validation failed', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        days = int(request.query_params.get('days', 30))
        
        start_date = timezone.now() - timedelta(days=days)
        entries = self.get_queryset().filter(created_at__gte=start_date)
        
        # Calculate trends
        trends = []
        for entry in entries:
            trends.append({
                'date': entry.created_at.date(),
                'mood_level': entry.mood_level,
                'energy_level': entry.energy_level,
                'sleep_quality': entry.sleep_quality,
                'stress_level': entry.stress_level
            })
        
        return Response(trends)


class CoachCheckInViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CoachCheckIn.objects.all()
    serializer_class = CoachCheckInSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return CoachCheckIn.objects.none()
        return CoachCheckIn.objects.filter(patient=patient).order_by('-scheduled_date')


class PatientMessageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PatientMessage.objects.all()
    serializer_class = PatientMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return PatientMessage.objects.none()
        return PatientMessage.objects.filter(patient=patient).order_by('-sent_at')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        message.is_read = True
        message.read_at = timezone.now()
        message.save()
        return Response({'message': 'Message marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'unread_count': 0})
        count = PatientMessage.objects.filter(patient=patient, is_read=False).count()
        return Response({'unread_count': count})
