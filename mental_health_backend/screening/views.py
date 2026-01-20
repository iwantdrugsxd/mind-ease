from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import Http404
from django.db.models import Q, Avg, Count
from django.utils import timezone
from datetime import timedelta
import uuid
from .models import (Patient, PHQ9Screening, GAD7Screening, ScreeningAlert, 
                    TeleconsultReferral, ChatbotConversation, ChatbotMessage)
from .serializers import (PatientSerializer, PHQ9ScreeningSerializer, GAD7ScreeningSerializer,
                         ScreeningAlertSerializer, TeleconsultReferralSerializer,
                         ScreeningSummarySerializer, ChatbotConversationSerializer,
                         ChatbotMessageSerializer)
from .triage_engine import TriageEngine
from .triage_service import triage_service
from .nlp_utils import emotion_detector
from .tasks import send_alert_notification
from .intent_recognizer import predict_intent, DEFAULT_CONFIDENCE_THRESHOLD


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = []  # Allow unauthenticated for patient creation via firebase_uid
    
    def get_queryset(self):
        # If authenticated, filter by user
        if self.request.user.is_authenticated:
            return Patient.objects.filter(user=self.request.user)
        # If firebase_uid provided in query params, filter by that
        firebase_uid = self.request.query_params.get('firebase_uid')
        if firebase_uid:
            return Patient.objects.filter(firebase_uid=firebase_uid)
        # If firebase_uid provided in request data (for POST), allow it
        if self.request.method == 'POST':
            firebase_uid = self.request.data.get('firebase_uid')
            if firebase_uid:
                return Patient.objects.filter(firebase_uid=firebase_uid)
        # For GET requests without firebase_uid, return empty queryset for security
        if self.request.method == 'GET':
            return Patient.objects.none()
        # For other methods, allow all (will be filtered in create method)
        return Patient.objects.all()
    
    def create(self, request, *args, **kwargs):
        """Override create to handle patient creation via firebase_uid"""
        from django.contrib.auth.models import User
        
        firebase_uid = request.data.get('firebase_uid', '')
        if not firebase_uid:
            return Response(
                {'error': 'firebase_uid is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if patient already exists
        try:
            patient = Patient.objects.get(firebase_uid=firebase_uid)
            serializer = self.get_serializer(patient)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Patient.DoesNotExist:
            pass
        
        # Create or get Django user
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
        
        # Create patient
        patient, created = Patient.objects.get_or_create(
            firebase_uid=firebase_uid,
            defaults={'user': django_user}
        )
        
        serializer = self.get_serializer(patient)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def screening_history(self, request, pk=None):
        patient = self.get_object()
        phq9_screenings = PHQ9Screening.objects.filter(patient=patient).order_by('-created_at')
        gad7_screenings = GAD7Screening.objects.filter(patient=patient).order_by('-created_at')
        
        return Response({
            'phq9_screenings': PHQ9ScreeningSerializer(phq9_screenings, many=True).data,
            'gad7_screenings': GAD7ScreeningSerializer(gad7_screenings, many=True).data
        })


class PHQ9ScreeningViewSet(viewsets.ModelViewSet):
    queryset = PHQ9Screening.objects.all()
    serializer_class = PHQ9ScreeningSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return PHQ9Screening.objects.filter(patient__user=self.request.user)
    
    def perform_create(self, serializer):
        # Get or create patient
        patient, created = Patient.objects.get_or_create(
            user=self.request.user,
            defaults={'firebase_uid': self.request.data.get('firebase_uid', '')}
        )
        serializer.save(patient=patient)
        
        # Run both triage engines (legacy and new)
        triage_engine = TriageEngine()
        triage_engine.process_phq9_screening(serializer.instance)
        
        # Also use new TriageService for enhanced processing
        if serializer.instance.total_score:
            triage_result = triage_service.process_triage(
                patient_id=patient.id,
                survey_type='phq9',
                score=serializer.instance.total_score,
                severity_level=serializer.instance.severity_level
            )
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        patient = Patient.objects.get(user=request.user)
        latest_screening = PHQ9Screening.objects.filter(patient=patient).first()
        if latest_screening:
            return Response(PHQ9ScreeningSerializer(latest_screening).data)
        return Response({'message': 'No screenings found'}, status=status.HTTP_404_NOT_FOUND)


class GAD7ScreeningViewSet(viewsets.ModelViewSet):
    queryset = GAD7Screening.objects.all()
    serializer_class = GAD7ScreeningSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return GAD7Screening.objects.filter(patient__user=self.request.user)
    
    def perform_create(self, serializer):
        # Get or create patient
        patient, created = Patient.objects.get_or_create(
            user=self.request.user,
            defaults={'firebase_uid': self.request.data.get('firebase_uid', '')}
        )
        serializer.save(patient=patient)
        
        # Run both triage engines (legacy and new)
        triage_engine = TriageEngine()
        triage_engine.process_gad7_screening(serializer.instance)
        
        # Also use new TriageService for enhanced processing
        if serializer.instance.total_score:
            triage_result = triage_service.process_triage(
                patient_id=patient.id,
                survey_type='gad7',
                score=serializer.instance.total_score,
                severity_level=serializer.instance.severity_level
            )
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        patient = Patient.objects.get(user=request.user)
        latest_screening = GAD7Screening.objects.filter(patient=patient).first()
        if latest_screening:
            return Response(GAD7ScreeningSerializer(latest_screening).data)
        return Response({'message': 'No screenings found'}, status=status.HTTP_404_NOT_FOUND)


class ScreeningAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScreeningAlert.objects.all()
    serializer_class = ScreeningAlertSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ScreeningAlert.objects.filter(patient__user=self.request.user)


class TeleconsultReferralViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TeleconsultReferral.objects.all()
    serializer_class = TeleconsultReferralSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TeleconsultReferral.objects.filter(patient__user=self.request.user)


class ScreeningSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        patient = Patient.objects.get(user=request.user)
        
        # Get latest screenings
        latest_phq9 = PHQ9Screening.objects.filter(patient=patient).first()
        latest_gad7 = GAD7Screening.objects.filter(patient=patient).first()
        
        # Calculate risk level
        risk_level = 'low'
        requires_attention = False
        
        if latest_phq9:
            if latest_phq9.risk_level == 'critical':
                risk_level = 'critical'
                requires_attention = True
            elif latest_phq9.risk_level == 'high':
                risk_level = 'high'
                requires_attention = True
            elif latest_phq9.risk_level == 'medium' and risk_level == 'low':
                risk_level = 'medium'
        
        if latest_gad7:
            if latest_gad7.risk_level == 'critical' and risk_level != 'critical':
                risk_level = 'critical'
                requires_attention = True
            elif latest_gad7.risk_level == 'high' and risk_level in ['low', 'medium']:
                risk_level = 'high'
                requires_attention = True
        
        summary = {
            'patient_id': patient.id,
            'patient_name': patient.user.get_full_name(),
            'latest_phq9_score': latest_phq9.total_score if latest_phq9 else None,
            'latest_gad7_score': latest_gad7.total_score if latest_gad7 else None,
            'risk_level': risk_level,
            'last_screening_date': latest_phq9.created_at if latest_phq9 else None,
            'requires_attention': requires_attention
        }
        
        return Response(summary)


class ChatbotConversationViewSet(viewsets.ModelViewSet):
    """Chatbot conversation management"""
    queryset = ChatbotConversation.objects.all()
    serializer_class = ChatbotConversationSerializer
    # Temporarily allow unauthenticated access for testing
    permission_classes = []  # AllowAny for testing
    
    def get_queryset(self):
        # Try to get Firebase UID from query params or request data
        firebase_uid = self.request.query_params.get('firebase_uid') or self.request.data.get('firebase_uid')
        
        # Determine patient (same logic as create method)
        from django.contrib.auth.models import User
        
        if firebase_uid and firebase_uid != 'anonymous':
            # Find patient by Firebase UID (most reliable)
            try:
                patient = Patient.objects.get(firebase_uid=firebase_uid)
            except Patient.DoesNotExist:
                # Create patient if doesn't exist
                if self.request.user.is_authenticated:
                    django_user = self.request.user
                else:
                    django_user, _ = User.objects.get_or_create(
                        username=f'firebase_{firebase_uid}',
                        defaults={'email': f'{firebase_uid}@firebase.local'}
                    )
                patient, _ = Patient.objects.get_or_create(
                    firebase_uid=firebase_uid,
                    defaults={'user': django_user}
                )
        elif self.request.user.is_authenticated:
            # Authenticated Django user - try to get patient
            try:
                patient = Patient.objects.get(user=self.request.user)
                # If patient has firebase_uid, prefer that
                if patient.firebase_uid and patient.firebase_uid != 'anonymous':
                    return ChatbotConversation.objects.filter(patient=patient)
            except Patient.DoesNotExist:
                # Create patient if doesn't exist
                patient, _ = Patient.objects.get_or_create(
                    user=self.request.user,
                    defaults={'firebase_uid': getattr(self.request.user, 'username', '')}
                )
        else:
            # Anonymous user
            default_user, _ = User.objects.get_or_create(
                username='anonymous_user',
                defaults={'email': 'anonymous@test.com'}
            )
            patient, _ = Patient.objects.get_or_create(
                user=default_user,
                defaults={'firebase_uid': 'anonymous'}
            )
        
        return ChatbotConversation.objects.filter(patient=patient)
    
    def create(self, request, *args, **kwargs):
        """Override create to handle patient creation properly"""
        from django.contrib.auth.models import User
        import logging
        
        logger = logging.getLogger(__name__)
        logger.info(f"Creating conversation - User authenticated: {request.user.is_authenticated}, Data: {request.data}")
        
        # Get Firebase UID from request
        firebase_uid = request.data.get('firebase_uid', 'anonymous')
        if not firebase_uid or firebase_uid == '':
            firebase_uid = 'anonymous'
        
        # Determine which user to use
        if request.user.is_authenticated:
            # Django authenticated user exists
            django_user = request.user
        else:
            # Create or get Django user for Firebase user
            if firebase_uid and firebase_uid != 'anonymous':
                # Firebase user - create Django user with Firebase UID
                django_user, _ = User.objects.get_or_create(
                    username=f'firebase_{firebase_uid}',
                    defaults={
                        'email': f'{firebase_uid}@firebase.local',
                        'first_name': 'Firebase',
                        'last_name': 'User'
                    }
                )
            else:
                # Anonymous user
                django_user, _ = User.objects.get_or_create(
                    username='anonymous_user',
                    defaults={'email': 'anonymous@test.com'}
                )
        
        # Get or create patient
        try:
            # Try to find by Firebase UID first (most reliable)
            if firebase_uid and firebase_uid != 'anonymous':
                patient, _ = Patient.objects.get_or_create(
                    firebase_uid=firebase_uid,
                    defaults={'user': django_user}
                )
            else:
                # Fallback to user lookup
                patient, _ = Patient.objects.get_or_create(
                    user=django_user,
                    defaults={'firebase_uid': firebase_uid}
                )
        except Patient.MultipleObjectsReturned:
            # If multiple patients exist, get the first one
            patient = Patient.objects.filter(firebase_uid=firebase_uid).first() if firebase_uid != 'anonymous' else Patient.objects.filter(user=django_user).first()
        
        session_id = str(uuid.uuid4())
        serializer = self.get_serializer(data={})  # Empty data, we set everything manually
        serializer.is_valid(raise_exception=True)
        serializer.save(patient=patient, session_id=session_id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='send-message')
    def send_message(self, request, pk=None):
        """Send a message to the chatbot and get a response"""
        # Get Firebase UID from request (same logic as create method)
        firebase_uid = request.data.get('firebase_uid') or request.query_params.get('firebase_uid')
        if not firebase_uid and request.user.is_authenticated:
            # Try to get from user's patient if authenticated
            try:
                patient = Patient.objects.get(user=request.user)
                firebase_uid = patient.firebase_uid
            except Patient.DoesNotExist:
                pass
        
        # Try to get conversation - first by get_object(), then by direct lookup
        conversation = None
        try:
            conversation = self.get_object()
        except Http404:
            # If get_object() fails, try direct lookup and match by patient
            try:
                conversation = ChatbotConversation.objects.get(pk=pk)
                
                # Determine expected patient (same logic as create method)
                from django.contrib.auth.models import User
                if firebase_uid and firebase_uid != 'anonymous':
                    # Try to find patient by Firebase UID
                    try:
                        expected_patient = Patient.objects.get(firebase_uid=firebase_uid)
                    except Patient.DoesNotExist:
                        # Create patient if doesn't exist
                        if request.user.is_authenticated:
                            django_user = request.user
                        else:
                            django_user, _ = User.objects.get_or_create(
                                username=f'firebase_{firebase_uid}',
                                defaults={'email': f'{firebase_uid}@firebase.local'}
                            )
                        expected_patient, _ = Patient.objects.get_or_create(
                            firebase_uid=firebase_uid,
                            defaults={'user': django_user}
                        )
                else:
                    # Anonymous user
                    default_user, _ = User.objects.get_or_create(
                        username='anonymous_user',
                        defaults={'email': 'anonymous@test.com'}
                    )
                    expected_patient, _ = Patient.objects.get_or_create(
                        user=default_user,
                        defaults={'firebase_uid': 'anonymous'}
                    )
                
                # Check if conversation belongs to expected patient
                if conversation.patient != expected_patient:
                    return Response({
                        'error': 'Conversation not found or access denied'
                    }, status=status.HTTP_404_NOT_FOUND)
                    
            except ChatbotConversation.DoesNotExist:
                return Response({
                    'error': 'Conversation not found',
                    'conversation_id': pk
                }, status=status.HTTP_404_NOT_FOUND)
        
        if not conversation:
            return Response({
                'error': 'Conversation not found',
                'conversation_id': pk
            }, status=status.HTTP_404_NOT_FOUND)
        user_message = request.data.get('message', '').strip()
        
        if not user_message:
            return Response({'error': 'Message cannot be empty'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Analyze user message with NLP
        emotional_context = emotion_detector.get_emotional_context(user_message)
        primary_emotion, confidence = emotion_detector.get_primary_emotion(user_message)
        risk_level = emotional_context['risk_level']
        risk_keywords = emotional_context['risk_keywords']
        
        # Get patient's latest screening data for context-aware responses
        patient = conversation.patient
        latest_phq9 = PHQ9Screening.objects.filter(patient=patient).order_by('-created_at').first()
        latest_gad7 = GAD7Screening.objects.filter(patient=patient).order_by('-created_at').first()
        
        # Get triage recommendations if available
        triage_recommendation = None
        if latest_phq9 or latest_gad7:
            phq9_score = latest_phq9.total_score if latest_phq9 else None
            gad7_score = latest_gad7.total_score if latest_gad7 else None
            assessment = triage_service.get_comprehensive_assessment(
                phq9_score=phq9_score,
                gad7_score=gad7_score,
                suicidal_ideation=(latest_phq9.q9_suicidal >= 2 if latest_phq9 else False)
            )
            if assessment['recommendations']:
                triage_recommendation = assessment['recommendations'][0]
        
        # Save user message
        user_msg = ChatbotMessage.objects.create(
            conversation=conversation,
            message_type='user',
            content=user_message,
            detected_emotion=primary_emotion,
            emotion_confidence=confidence,
            risk_level=risk_level,
            risk_keywords=risk_keywords
        )
        
        # Generate bot response based on emotion, risk, and triage data
        bot_response = self._generate_bot_response(
            user_message, primary_emotion, risk_level, risk_keywords, triage_recommendation
        )
        
        # Save bot response
        bot_msg = ChatbotMessage.objects.create(
            conversation=conversation,
            message_type='bot',
            content=bot_response
        )
        
        # Check for critical risk and create alert if needed
        if risk_level == 'critical':
            alert = ScreeningAlert.objects.create(
                patient=patient,
                alert_type='crisis',
                message=f"Critical risk detected in chatbot conversation: {user_message[:100]}"
            )
            send_alert_notification.delay(alert.id, priority='critical')
        
        return Response({
            'user_message': ChatbotMessageSerializer(user_msg).data,
            'bot_response': ChatbotMessageSerializer(bot_msg).data,
            'emotional_context': emotional_context,
            'triage_recommendation': triage_recommendation
        })
    
    def _generate_bot_response(self, user_message, emotion, risk_level, risk_keywords, triage_recommendation=None):
        """Generate appropriate bot response based on user input, emotion, risk, intent, and triage data"""
        message_lower = user_message.lower()
        
        # Crisis response - Priority 1 (highest priority)
        if risk_level == 'critical' or risk_keywords:
            return (
                "I'm concerned about what you're sharing. Your safety is important. "
                "Please reach out for immediate help:\n\n"
                "• Crisis Hotline: 988 (available 24/7)\n"
                "• Text HOME to: 741741\n"
                "• Emergency: 911\n\n"
                "Would you like me to help you connect with a mental health professional? "
                "I'm here to support you."
            )
        
        # Intent-based routing (Priority 2)
        try:
            intent_tag, confidence = predict_intent(
                user_message, 
                return_confidence=True,
                # Slightly lower threshold to make navigation snappier
                confidence_threshold=max(0.0, DEFAULT_CONFIDENCE_THRESHOLD - 0.2)
            )
            
            # Handle out-of-scope queries
            if intent_tag == "out_of_scope":
                # Heuristic keyword router for common navigation words
                if any(k in message_lower for k in ["screen", "phq", "gad", "assessment", "test"]):
                    return (
                        "Great — let's get you to the screenings. We have PHQ-9 (depression) and GAD-7 (anxiety).\n\n"
                        "You can start from the Screening section. Would you like me to take you there now?"
                    )
                if any(k in message_lower for k in ["self care", "self-care", "breath", "breathing", "meditation", "mindful", "exercise"]):
                    return (
                        "Self-care coming right up. We offer guided breathing, mindfulness, journaling and more.\n\n"
                        "Open the Self-Care section and I can recommend something to match your current mood."
                    )
                if any(k in message_lower for k in ["dashboard", "progress", "results", "report"]):
                    return (
                        "Your dashboard shows trends, latest PHQ-9/GAD-7 results, and recommendations.\n\n"
                        "Shall I open the Dashboard for you?"
                    )
                return (
                    "I'm focused on supporting your mental health journey. I can help you with:\n"
                    "• Screening tests (PHQ-9, GAD-7)\n"
                    "• Self-care exercises\n"
                    "• Your dashboard and progress\n\n"
                    "Which would you like to open?"
                )
            
            # Intent-specific responses
            if intent_tag == "greeting":
                greeting = (
                    "Hello! I'm here to support you. How are you feeling today? "
                    "You can share what's on your mind, or I can help you navigate the app."
                )
                if triage_recommendation:
                    greeting += f"\n\nBased on your recent assessment, I'd recommend trying: {triage_recommendation}"
                return greeting
            
            elif intent_tag == "find_screening":
                return (
                    "I can help you take a screening test! We have:\n"
                    "• PHQ-9: For depression symptoms\n"
                    "• GAD-7: For anxiety symptoms\n\n"
                    "These take just a few minutes and give you clear next steps.\n\n"
                    "[Go to Screening]"
                )
            
            elif intent_tag == "find_self_care":
                response = (
                    "Great! I can help you find self-care exercises. We have:\n"
                    "• Breathing exercises\n"
                    "• Mindfulness meditation\n"
                    "• Journaling prompts\n"
                    "• Stress management techniques\n\n"
                )
                if triage_recommendation:
                    response += f"Based on your recent assessment, I'd especially recommend: {triage_recommendation}.\n\n"
                response += "[Open Self-Care]"
                return response
            
            elif intent_tag == "view_dashboard":
                return (
                    "Your dashboard shows your mental health journey, including:\n"
                    "• Your screening test results\n"
                    "• Progress over time\n"
                    "• Personalized recommendations\n\n"
                    "[Open Dashboard]"
                )
            
            elif intent_tag == "need_help":
                return (
                    "I'm here to help! Here's what I can assist you with:\n\n"
                    "🔍 **Screening Tests**: Take PHQ-9 or GAD-7 assessments\n"
                    "🧘 **Self-Care**: Access mindfulness, breathing, and wellness exercises\n"
                    "📊 **Dashboard**: View your progress and test results\n"
                    "💬 **Chat**: Talk about what's on your mind\n\n"
                    "What would you like to explore?"
                )
            
            elif intent_tag == "goodbye":
                return (
                    "Take care! Remember, I'm here whenever you need support. "
                    "Don't hesitate to come back if you need help with your mental health journey."
                )
            
            elif intent_tag == "thanks":
                return (
                    "You're very welcome! I'm glad I could help. "
                    "Feel free to reach out anytime you need support."
                )
                
        except Exception as e:
            # Fallback if intent recognition fails
            print(f"Warning: Intent recognition error: {e}")
            # Continue with emotion-based responses below
        
        # Emotion-based responses (Priority 3) - fallback if intent not recognized
        if emotion == 'sad':
            response = (
                "I understand you're feeling down. It's okay to feel this way. "
                "Would you like to talk about what's making you feel sad? "
                "Sometimes sharing can help."
            )
            if triage_recommendation:
                response += f" I'd also recommend trying: {triage_recommendation}."
            else:
                response += " You might also consider trying one of our self-care exercises."
            return response
            
        elif emotion == 'anxious':
            response = (
                "I hear that you're feeling anxious. That can be really challenging. "
            )
            if triage_recommendation:
                response += f"I'd recommend trying: {triage_recommendation}. "
            else:
                response += "Would it help to try a breathing exercise together? "
            response += "Or would you prefer to talk about what's causing your anxiety?"
            return response
            
        elif emotion == 'happy':
            return (
                "I'm glad to hear you're feeling positive! It's great that you're doing well. "
                "Is there anything specific you'd like to discuss or work on today?"
            )
        
        # General supportive responses with triage recommendations
        if triage_recommendation and any(word in message_lower for word in ['help', 'suggest', 'recommend', 'what should']):
            return (
                f"Based on your recent assessment, I'd recommend trying: {triage_recommendation}. "
                "This can help manage your symptoms. Would you like me to guide you through it?"
            )
        
        # General supportive responses (fallback)
        if len(user_message) < 20:
            return (
                "I'd like to understand better. Can you tell me more about what you're experiencing? "
                "Or if you're looking for something specific, I can help you with:\n"
                "• Screening tests\n"
                "• Self-care exercises\n"
                "• Your dashboard"
            )
        else:
            response = "I appreciate you sharing that. What would be most helpful for you right now?"
            if triage_recommendation:
                response += f" You might also find '{triage_recommendation}' helpful."
            return response
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get all messages in a conversation"""
        conversation = self.get_object()
        messages = conversation.messages.all()
        return Response(ChatbotMessageSerializer(messages, many=True).data)