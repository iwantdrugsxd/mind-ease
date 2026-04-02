from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
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
from .tasks import dispatch_background_task, send_alert_notification
from .intent_recognizer import predict_intent, DEFAULT_CONFIDENCE_THRESHOLD
from .identity import get_or_create_patient_for_request, resolve_identity
from clinician.consultation_service import auto_assign_high_risk_patient_to_all_clinicians
from .onboarding_service import build_user_state_summary_readonly


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Prefer verified/authenticated identity first.
        resolved_user, resolved_patient, resolved_uid = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if resolved_patient:
            return Patient.objects.filter(id=resolved_patient.id)
        if resolved_user:
            return Patient.objects.filter(user=resolved_user)

        # Keep patient surface scoped to authenticated identity only.
        return Patient.objects.none()
    
    def create(self, request, *args, **kwargs):
        """
        Create/resolve patient with verified identity first.
        Legacy raw firebase_uid remains as fallback during migration.
        """
        existing_patient = None
        _, resolved_patient, resolved_uid = resolve_identity(request, allow_legacy_firebase_uid=False)
        if resolved_uid:
            existing_patient = Patient.objects.filter(firebase_uid=resolved_uid).first()

        _, patient, firebase_uid = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response(
                {'error': 'Unable to resolve authenticated patient identity'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = existing_patient is None
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
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return PHQ9Screening.objects.none()
        return PHQ9Screening.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        _, patient, firebase_uid = get_or_create_patient_for_request(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            raise ValidationError({"error": "Unable to resolve patient for screening submission."})
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
        if serializer.instance.risk_level in ("high", "critical"):
            auto_assign_high_risk_patient_to_all_clinicians(patient)
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        _, patient, _ = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'message': 'No patient found'}, status=status.HTTP_404_NOT_FOUND)
        latest_screening = PHQ9Screening.objects.filter(patient=patient).first()
        if latest_screening:
            return Response(PHQ9ScreeningSerializer(latest_screening).data)
        return Response({'message': 'No screenings found'}, status=status.HTTP_404_NOT_FOUND)


class GAD7ScreeningViewSet(viewsets.ModelViewSet):
    queryset = GAD7Screening.objects.all()
    serializer_class = GAD7ScreeningSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return GAD7Screening.objects.none()
        return GAD7Screening.objects.filter(patient=patient)
    
    def perform_create(self, serializer):
        _, patient, firebase_uid = get_or_create_patient_for_request(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            raise ValidationError({"error": "Unable to resolve patient for screening submission."})
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
        if serializer.instance.risk_level in ("high", "critical"):
            auto_assign_high_risk_patient_to_all_clinicians(patient)
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        _, patient, _ = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'message': 'No patient found'}, status=status.HTTP_404_NOT_FOUND)
        latest_screening = GAD7Screening.objects.filter(patient=patient).first()
        if latest_screening:
            return Response(GAD7ScreeningSerializer(latest_screening).data)
        return Response({'message': 'No screenings found'}, status=status.HTTP_404_NOT_FOUND)


class ScreeningAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScreeningAlert.objects.all()
    serializer_class = ScreeningAlertSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return ScreeningAlert.objects.none()
        return ScreeningAlert.objects.filter(patient=patient)


class TeleconsultReferralViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TeleconsultReferral.objects.all()
    serializer_class = TeleconsultReferralSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = resolve_identity(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return TeleconsultReferral.objects.none()
        return TeleconsultReferral.objects.filter(patient=patient)


class ScreeningSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        _, patient, _ = resolve_identity(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
        
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
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        _, patient, _ = get_or_create_patient_for_request(self.request, allow_legacy_firebase_uid=False)
        if not patient:
            return ChatbotConversation.objects.none()
        return ChatbotConversation.objects.filter(patient=patient)
    
    def create(self, request, *args, **kwargs):
        """Override create to handle patient creation properly"""
        import logging
        
        logger = logging.getLogger(__name__)
        logger.info(f"Creating conversation - User authenticated: {request.user.is_authenticated}, Data: {request.data}")
        
        _, patient, _ = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'error': 'Unable to resolve authenticated patient identity'}, status=status.HTTP_400_BAD_REQUEST)
        
        session_id = str(uuid.uuid4())
        serializer = self.get_serializer(data={})  # Empty data, we set everything manually
        serializer.is_valid(raise_exception=True)
        serializer.save(patient=patient, session_id=session_id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='send-message')
    def send_message(self, request, pk=None):
        """Send a message to the chatbot and get a response"""
        _, patient, _ = get_or_create_patient_for_request(request, allow_legacy_firebase_uid=False)
        if not patient:
            return Response({'error': 'Unable to resolve authenticated patient identity'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Try to get conversation - first by get_object(), then by direct lookup
        conversation = None
        try:
            conversation = self.get_object()
        except Http404:
            # If get_object() fails, try direct lookup and match by patient
            try:
                conversation = ChatbotConversation.objects.get(pk=pk)
                
                # Check if conversation belongs to expected patient
                if conversation.patient != patient:
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
        
        # Get patient state for guided assistant behavior
        patient_context = self._build_patient_context(patient)

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
            user_message,
            primary_emotion,
            risk_level,
            risk_keywords,
            triage_recommendation,
            patient_context,
        )
        
        # Save bot response
        bot_msg = ChatbotMessage.objects.create(
            conversation=conversation,
            message_type='bot',
            content=bot_response
        )
        assistant_guidance = self._build_assistant_guidance(
            user_message=user_message,
            bot_response=bot_response,
            emotion=primary_emotion,
            risk_level=risk_level,
            risk_keywords=risk_keywords,
            triage_recommendation=triage_recommendation,
            patient_context=patient_context,
        )
        workflow_state = self._orchestrate_assistant_workflow(
            patient=patient,
            user_message=user_message,
            risk_level=risk_level,
            triage_recommendation=triage_recommendation,
            patient_context=patient_context,
            assistant_guidance=assistant_guidance,
            latest_phq9=latest_phq9,
            latest_gad7=latest_gad7,
        )
        
        # Check for critical risk and create alert if needed
        if risk_level == 'critical':
            alert = ScreeningAlert.objects.create(
                patient=patient,
                alert_type='crisis',
                message=f"Critical risk detected in chatbot conversation: {user_message[:100]}"
            )
            dispatch_background_task(send_alert_notification, alert.id, priority='critical')
        
        return Response({
            'user_message': ChatbotMessageSerializer(user_msg).data,
            'bot_response': ChatbotMessageSerializer(bot_msg).data,
            'emotional_context': emotional_context,
            'triage_recommendation': triage_recommendation,
            'patient_context': patient_context,
            'assistant_guidance': assistant_guidance,
            'workflow_state': workflow_state,
        })

    def _build_patient_context(self, patient):
        latest_phq9 = PHQ9Screening.objects.filter(patient=patient).order_by('-created_at').first()
        latest_gad7 = GAD7Screening.objects.filter(patient=patient).order_by('-created_at').first()
        onboarding_state = build_user_state_summary_readonly(patient)
        activity = onboarding_state.get("activity") or {}
        next_best_action = onboarding_state.get("next_best_action") or {}
        recommendation = onboarding_state.get("recommendation") or {}

        overall_risk = "unknown"
        levels = [lvl for lvl in [getattr(latest_phq9, "risk_level", None), getattr(latest_gad7, "risk_level", None)] if lvl]
        if "critical" in levels:
            overall_risk = "critical"
        elif "high" in levels:
            overall_risk = "high"
        elif "medium" in levels:
            overall_risk = "medium"
        elif "low" in levels:
            overall_risk = "low"

        return {
            "overall_risk_level": overall_risk,
            "latest_phq9_score": getattr(latest_phq9, "total_score", None),
            "latest_gad7_score": getattr(latest_gad7, "total_score", None),
            "latest_phq9_severity": getattr(latest_phq9, "severity_level", None),
            "latest_gad7_severity": getattr(latest_gad7, "severity_level", None),
            "has_recent_screening": bool(latest_phq9 or latest_gad7),
            "engagement_level": activity.get("engagement_level") or "low",
            "no_recent_activity": bool(activity.get("no_recent_activity")),
            "recommended_next_action": next_best_action.get("title") or recommendation.get("next_action"),
            "recommended_route": next_best_action.get("target_route"),
            "clinician_access_opt_in": bool((onboarding_state.get("consent") or {}).get("clinician_access_opt_in")),
        }

    def _format_guided_response(self, intro, actions=None, footer=None):
        parts = [intro.strip()]
        if actions:
            parts.append("")
            parts.append("Suggested next steps:")
            for label, route in actions:
                parts.append(f"• {label}")
                if route:
                    parts.append(f"[{route}]")
        if footer:
            parts.append("")
            parts.append(footer.strip())
        return "\n".join(parts)

    def _route_actions_for_context(self, patient_context, include_care_team=False):
        actions = []
        route = patient_context.get("recommended_route")
        if route == "/screening":
            actions.append(("Take a screening", "Go to Screening"))
        elif route == "/selfcare":
            actions.append(("Continue self-care", "Open Self-Care"))
        elif route == "/care-team":
            actions.append(("Review care-team messages", "Open Care Team"))

        if patient_context.get("overall_risk_level") in ("high", "critical"):
            actions.append(("Review your latest assessment", "Go to Screening"))
            if patient_context.get("clinician_access_opt_in") or include_care_team:
                actions.append(("Check secure follow-up messages", "Open Care Team"))
        else:
            actions.append(("Open self-care exercises", "Open Self-Care"))
            actions.append(("Review your dashboard", "Open Dashboard"))

        seen = set()
        deduped = []
        for label, route_name in actions:
            key = (label, route_name)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(key)
        return deduped[:3]

    def _is_therapy_replacement_request(self, message_lower):
        blocked_patterns = [
            "diagnose me",
            "what disorder do i have",
            "am i bipolar",
            "prescribe",
            "tell me what medicine",
            "be my therapist",
            "replace my therapist",
            "medical advice",
        ]
        return any(pattern in message_lower for pattern in blocked_patterns)

    def _serialize_guidance_actions(self, action_keys):
        route_map = {
            "Go to Screening": "/screening",
            "Open Self-Care": "/selfcare",
            "Open Dashboard": "/dashboard",
            "Open Care Team": "/care-team",
        }
        label_map = {
            "Go to Screening": "Go to Screening",
            "Open Self-Care": "Open Self-Care",
            "Open Dashboard": "Open Dashboard",
            "Open Care Team": "Open Care Team",
        }
        return [
            {
                "label": label_map[action_key],
                "action_key": action_key,
                "route": route_map[action_key],
            }
            for action_key in action_keys
            if action_key in route_map
        ]

    def _extract_action_keys(self, content):
        action_keys = []
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                key = stripped[1:-1]
                if key in {"Go to Screening", "Open Self-Care", "Open Dashboard", "Open Care Team"}:
                    action_keys.append(key)
        deduped = []
        seen = set()
        for key in action_keys:
            if key in seen:
                continue
            seen.add(key)
            deduped.append(key)
        return deduped

    def _build_assistant_guidance(
        self,
        user_message,
        bot_response,
        emotion,
        risk_level,
        risk_keywords,
        triage_recommendation=None,
        patient_context=None,
    ):
        patient_context = patient_context or {}
        message_lower = user_message.lower()
        action_keys = self._extract_action_keys(bot_response)

        policy_type = "guided_support"
        urgency = "routine"
        safety_notice = None
        handoff_recommended = False

        if risk_level == "critical" or risk_keywords:
            policy_type = "urgent_escalation"
            urgency = "critical"
            safety_notice = "Immediate crisis support is required."
            handoff_recommended = True
        elif self._is_therapy_replacement_request(message_lower):
            policy_type = "out_of_scope"
            safety_notice = "Clinical diagnosis and therapist replacement are out of scope for the assistant."
        elif any(token in message_lower for token in ["screen", "phq", "gad", "assessment", "test"]):
            policy_type = "screening_prompt"
        elif any(token in message_lower for token in ["self care", "self-care", "breath", "breathing", "meditation", "mindful", "exercise"]):
            policy_type = "self_care_routing"
        elif patient_context.get("overall_risk_level") in ("high", "critical") and (
            triage_recommendation or "Open Care Team" in action_keys
        ):
            policy_type = "followup_recommended"
            urgency = "elevated"
            handoff_recommended = "Open Care Team" in action_keys
        elif emotion in {"sad", "anxious"}:
            policy_type = "guided_support"

        return {
            "policy_type": policy_type,
            "urgency": urgency,
            "actions": self._serialize_guidance_actions(action_keys),
            "safety_notice": safety_notice,
            "handoff_recommended": handoff_recommended,
        }

    def _orchestrate_assistant_workflow(
        self,
        patient,
        user_message,
        risk_level,
        triage_recommendation,
        patient_context,
        assistant_guidance,
        latest_phq9=None,
        latest_gad7=None,
    ):
        workflow_type = "guided_support"
        alert_id = None
        referral_id = None
        care_team_available = False

        message_lower = user_message.lower()
        latest_screening = latest_phq9 or latest_gad7
        overall_risk = patient_context.get("overall_risk_level")
        clinician_opt_in = bool(patient_context.get("clinician_access_opt_in"))
        wants_professional_support = any(
            token in message_lower
            for token in ["clinician", "care team", "doctor", "professional support", "therapist", "counsellor", "counselor"]
        )

        if assistant_guidance["policy_type"] == "urgent_escalation":
            workflow_type = "urgent_escalation"
            recent_alert = ScreeningAlert.objects.filter(
                patient=patient,
                alert_type="crisis",
                is_resolved=False,
                created_at__gte=timezone.now() - timedelta(hours=12),
            ).order_by("-created_at").first()
            alert_id = recent_alert.id if recent_alert else None

        should_route_to_clinician = (
            clinician_opt_in
            and (
                assistant_guidance["policy_type"] == "followup_recommended"
                or wants_professional_support
                or overall_risk in {"high", "critical"}
            )
        )
        if should_route_to_clinician:
            referral = TeleconsultReferral.objects.filter(
                patient=patient,
                status__in=["pending", "scheduled"],
            ).order_by("-created_at").first()
            if referral is None:
                referral_reason = triage_recommendation or "Chatbot-guided follow-up recommended based on recent risk signals."
                referral = TeleconsultReferral.objects.create(
                    patient=patient,
                    phq9_screening=latest_phq9,
                    gad7_screening=latest_gad7,
                    reason=referral_reason,
                    priority="urgent" if overall_risk == "critical" else "high",
                    status="pending",
                )
            referral_id = referral.id
            workflow_type = "care_team_handoff"
            care_team_available = True
            if overall_risk in {"high", "critical"}:
                auto_assign_high_risk_patient_to_all_clinicians(patient)
        elif assistant_guidance["policy_type"] == "screening_prompt":
            workflow_type = "screening"
        elif assistant_guidance["policy_type"] == "self_care_routing":
            workflow_type = "self_care"

        next_route = assistant_guidance["actions"][0]["route"] if assistant_guidance["actions"] else patient_context.get("recommended_route")
        return {
            "workflow_type": workflow_type,
            "next_route": next_route,
            "alert_id": alert_id,
            "referral_id": referral_id,
            "care_team_available": care_team_available,
            "has_recent_screening": bool(latest_screening),
        }

    def _generate_bot_response(self, user_message, emotion, risk_level, risk_keywords, triage_recommendation=None, patient_context=None):
        """Generate appropriate bot response based on user input, emotion, risk, intent, and triage data"""
        message_lower = user_message.lower()
        patient_context = patient_context or {}

        # Crisis response - Priority 1 (highest priority)
        if risk_level == 'critical' or risk_keywords:
            return self._format_guided_response(
                "I'm concerned about what you're sharing. Your safety is important. "
                "Please reach out for immediate help:\n\n"
                "• Crisis Hotline: 988 (available 24/7)\n"
                "• Text HOME to: 741741\n"
                "• Emergency: 911",
                actions=[("Review secure support messages", "Open Care Team")],
                footer="I can support next steps inside the app, but I cannot safely handle crisis situations on my own."
            )

        if self._is_therapy_replacement_request(message_lower):
            return self._format_guided_response(
                "I can support reflection, coping, and next steps inside MindEase, but I can't diagnose conditions or replace a licensed mental health professional.",
                actions=self._route_actions_for_context(patient_context, include_care_team=True),
                footer="If you want, tell me whether you want help with screening, self-care, or understanding what to do next."
            )

        if any(token in message_lower for token in ["clinician", "care team", "doctor", "professional support", "therapist", "counsellor", "counselor"]):
            if patient_context.get("clinician_access_opt_in"):
                return self._format_guided_response(
                    "I can help you continue this with your care team inside MindEase. If you'd prefer clinician follow-up, open Care Team to review or continue secure messages.",
                    actions=[
                        ("Open Care Team", "Open Care Team"),
                        ("Review your latest assessment", "Go to Screening"),
                    ],
                    footer="I can support you here, but clinician follow-up belongs in Care Team."
                )
            return self._format_guided_response(
                "I can help with guided support, screening, and self-care. If you want clinician follow-up, enable clinician access in your app settings and review your latest assessment.",
                actions=[
                    ("Review your latest assessment", "Go to Screening"),
                    ("Open Dashboard", "Open Dashboard"),
                ],
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
                    return self._format_guided_response(
                        "Great — let's get you to the screenings. We have PHQ-9 (depression) and GAD-7 (anxiety).\n\n"
                        "You can start from the Screening section.",
                        actions=[("Start PHQ-9 or GAD-7", "Go to Screening")]
                    )
                if any(k in message_lower for k in ["self care", "self-care", "breath", "breathing", "meditation", "mindful", "exercise"]):
                    return self._format_guided_response(
                        "Self-care coming right up. We offer guided breathing, mindfulness, journaling and more.\n\n"
                        "Open the Self-Care section and I can recommend something to match your current mood.",
                        actions=[("Open self-care exercises", "Open Self-Care")]
                    )
                if any(k in message_lower for k in ["dashboard", "progress", "results", "report"]):
                    return self._format_guided_response(
                        "Your dashboard shows trends, latest PHQ-9/GAD-7 results, and recommendations.\n\n"
                        "Use it when you want a broader view of your progress.",
                        actions=[("Open Dashboard", "Open Dashboard")]
                    )
                return self._format_guided_response(
                    "I'm focused on supporting your mental health journey. I can help you with:\n"
                    "• Screening tests (PHQ-9, GAD-7)\n"
                    "• Self-care exercises\n"
                    "• Your dashboard and progress",
                    actions=self._route_actions_for_context(patient_context)
                )
            
            # Intent-specific responses
            if intent_tag == "greeting":
                greeting = (
                    "Hello! I'm here to support you. How are you feeling today? "
                    "You can share what's on your mind, or I can help you navigate the app."
                )
                if triage_recommendation:
                    greeting += f"\n\nBased on your recent assessment, I'd recommend trying: {triage_recommendation}"
                return self._format_guided_response(greeting, actions=self._route_actions_for_context(patient_context))
            
            elif intent_tag == "find_screening":
                return self._format_guided_response(
                    "I can help you take a screening test! We have:\n"
                    "• PHQ-9: For depression symptoms\n"
                    "• GAD-7: For anxiety symptoms\n\n"
                    "These take just a few minutes and give you clear next steps.",
                    actions=[("Go to Screening", "Go to Screening")]
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
                return self._format_guided_response(response.strip(), actions=[("Open Self-Care", "Open Self-Care")])
            
            elif intent_tag == "view_dashboard":
                return self._format_guided_response(
                    "Your dashboard shows your mental health journey, including:\n"
                    "• Your screening test results\n"
                    "• Progress over time\n"
                    "• Personalized recommendations",
                    actions=[("Open Dashboard", "Open Dashboard")]
                )
            
            elif intent_tag == "need_help":
                return self._format_guided_response(
                    "I'm here to help! Here's what I can assist you with:\n\n"
                    "🔍 **Screening Tests**: Take PHQ-9 or GAD-7 assessments\n"
                    "🧘 **Self-Care**: Access mindfulness, breathing, and wellness exercises\n"
                    "📊 **Dashboard**: View your progress and test results\n"
                    "💬 **Chat**: Talk about what's on your mind",
                    actions=self._route_actions_for_context(patient_context)
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
            return self._format_guided_response(response, actions=self._route_actions_for_context(patient_context))
            
        elif emotion == 'anxious':
            response = (
                "I hear that you're feeling anxious. That can be really challenging. "
            )
            if triage_recommendation:
                response += f"I'd recommend trying: {triage_recommendation}. "
            else:
                response += "Would it help to try a breathing exercise together? "
            response += "Or would you prefer to talk about what's causing your anxiety?"
            return self._format_guided_response(response, actions=self._route_actions_for_context(patient_context))
            
        elif emotion == 'happy':
            return self._format_guided_response(
                "I'm glad to hear you're feeling positive! It's great that you're doing well. "
                "Is there anything specific you'd like to discuss or work on today?",
                actions=self._route_actions_for_context(patient_context)
            )
        
        # General supportive responses with triage recommendations
        if triage_recommendation and any(word in message_lower for word in ['help', 'suggest', 'recommend', 'what should']):
            return self._format_guided_response(
                f"Based on your recent assessment, I'd recommend trying: {triage_recommendation}. "
                "This can help manage your symptoms. Would you like me to guide you through it?",
                actions=self._route_actions_for_context(patient_context)
            )
        
        # General supportive responses (fallback)
        if len(user_message) < 20:
            return self._format_guided_response(
                "I'd like to understand better. Can you tell me more about what you're experiencing? "
                "Or if you're looking for something specific, I can help you with:\n"
                "• Screening tests\n"
                "• Self-care exercises\n"
                "• Your dashboard",
                actions=self._route_actions_for_context(patient_context)
            )
        else:
            response = "I appreciate you sharing that. What would be most helpful for you right now?"
            if triage_recommendation:
                response += f" You might also find '{triage_recommendation}' helpful."
            return self._format_guided_response(response, actions=self._route_actions_for_context(patient_context))
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get all messages in a conversation"""
        conversation = self.get_object()
        messages = conversation.messages.all()
        return Response(ChatbotMessageSerializer(messages, many=True).data)
