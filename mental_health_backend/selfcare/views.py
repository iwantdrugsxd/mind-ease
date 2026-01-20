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
        # Get patient's latest screening scores to recommend appropriate pathways
        try:
            patient = Patient.objects.get(user=request.user)
            
            # Get latest PHQ-9 and GAD-7 scores
            latest_phq9 = patient.phq9_screenings.first()
            latest_gad7 = patient.gad7_screenings.first()
            
            # Determine target severity level
            if latest_phq9 and latest_gad7:
                max_score = max(latest_phq9.total_score, latest_gad7.total_score)
                if max_score >= 15:
                    target_severity = 'severe'
                elif max_score >= 10:
                    target_severity = 'moderate'
                elif max_score >= 5:
                    target_severity = 'mild'
                else:
                    target_severity = 'minimal'
            else:
                target_severity = 'minimal'
            
            # Get recommended pathways
            pathways = self.queryset.filter(target_severity=target_severity)
            serializer = self.get_serializer(pathways, many=True)
            return Response(serializer.data)
            
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)


class PatientSelfCareProgressViewSet(viewsets.ModelViewSet):
    queryset = PatientSelfCareProgress.objects.all()
    serializer_class = PatientSelfCareProgressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        patient = Patient.objects.get(user=self.request.user)
        return PatientSelfCareProgress.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        patient = Patient.objects.get(user=self.request.user)
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
        patient = Patient.objects.get(user=self.request.user)
        return ExerciseCompletion.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        patient = Patient.objects.get(user=self.request.user)
        serializer.save(patient=patient)


class MoodEntryViewSet(viewsets.ModelViewSet):
    queryset = MoodEntry.objects.all()
    serializer_class = MoodEntrySerializer
    permission_classes = []  # Allow unauthenticated for firebase_uid access
    
    def get_queryset(self):
        firebase_uid = self.request.query_params.get('firebase_uid')
        if firebase_uid:
            try:
                patient = Patient.objects.get(firebase_uid=firebase_uid)
                return MoodEntry.objects.filter(patient=patient).order_by('-created_at')
            except Patient.DoesNotExist:
                return MoodEntry.objects.none()
        
        if self.request.user.is_authenticated:
            try:
                patient = Patient.objects.get(user=self.request.user)
                return MoodEntry.objects.filter(patient=patient).order_by('-created_at')
            except Patient.DoesNotExist:
                return MoodEntry.objects.none()
        
        return MoodEntry.objects.none()
    
    def create(self, request, *args, **kwargs):
        """Override create to handle patient creation and better error handling"""
        from django.contrib.auth.models import User
        import logging
        
        logger = logging.getLogger(__name__)
        logger.info(f"Creating mood entry - User authenticated: {request.user.is_authenticated}, Data: {request.data}")
        
        firebase_uid = request.data.get('firebase_uid', '')
        
        # Get or create patient
        patient = None
        if firebase_uid:
            try:
                patient = Patient.objects.get(firebase_uid=firebase_uid)
                logger.info(f"Found existing patient: {patient.id}")
            except Patient.DoesNotExist:
                logger.info(f"Patient not found, creating new one for firebase_uid: {firebase_uid}")
                # Create patient if doesn't exist
                if request.user.is_authenticated:
                    django_user = request.user
                else:
                    django_user, _ = User.objects.get_or_create(
                        username=f'firebase_{firebase_uid}',
                        defaults={
                            'email': f'{firebase_uid}@firebase.local',
                            'first_name': 'Firebase',
                            'last_name': 'User'
                        }
                    )
                patient, created = Patient.objects.get_or_create(
                    firebase_uid=firebase_uid,
                    defaults={'user': django_user}
                )
                logger.info(f"Patient {'created' if created else 'retrieved'}: {patient.id}")
        elif request.user.is_authenticated:
            try:
                patient = Patient.objects.get(user=request.user)
            except Patient.DoesNotExist:
                patient, _ = Patient.objects.get_or_create(
                    user=request.user,
                    defaults={'firebase_uid': request.user.username}
                )
        
        if not patient:
            logger.error("No patient found or created")
            return Response(
                {'error': 'firebase_uid or authentication required'},
                status=status.HTTP_400_BAD_REQUEST
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
        patient = Patient.objects.get(user=self.request.user)
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
        patient = Patient.objects.get(user=self.request.user)
        return CoachCheckIn.objects.filter(patient=patient).order_by('-scheduled_date')


class PatientMessageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PatientMessage.objects.all()
    serializer_class = PatientMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        patient = Patient.objects.get(user=self.request.user)
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
        patient = Patient.objects.get(user=self.request.user)
        count = PatientMessage.objects.filter(patient=patient, is_read=False).count()
        return Response({'unread_count': count})