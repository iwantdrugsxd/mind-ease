"""
Survey Submission Views
New endpoints for survey submission as per methodology:
POST /api/surveys/submit/phq9
POST /api/surveys/submit/gad7
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from .models import Patient, PHQ9Screening, GAD7Screening
from .serializers import PHQ9ScreeningSerializer, GAD7ScreeningSerializer
from .triage_service import triage_service


class SurveySubmissionViewSet(viewsets.ViewSet):
    """
    ViewSet for survey submissions
    Implements the Rule Engine-based triage system
    """
    permission_classes = [IsAuthenticated]
    
    def _get_or_create_patient(self, request):
        """Get or create patient for the authenticated user"""
        try:
            patient = Patient.objects.get(user=request.user)
        except Patient.DoesNotExist:
            # Create patient if doesn't exist
            firebase_uid = request.data.get('firebase_uid', '')
            patient, _ = Patient.objects.get_or_create(
                user=request.user,
                defaults={'firebase_uid': firebase_uid or request.user.username}
            )
        return patient
    
    @action(detail=False, methods=['post'], url_path='submit/phq9')
    def submit_phq9(self, request):
        """
        Submit PHQ-9 survey results
        Expected payload:
        {
            "answers": [0, 1, 2, 1, 0, 2, 1, 0, 1],  // 9 answers (0-3 each)
            "firebase_uid": "optional-firebase-uid"
        }
        """
        try:
            # Get answers from request
            answers = request.data.get('answers', [])
            
            if not answers:
                return Response(
                    {'error': 'Answers array is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate PHQ-9 score using TriageService
            score_result = triage_service.calculate_phq9(answers)
            total_score = score_result['total_score']
            severity_level = score_result['severity_level']
            severity_label = score_result['severity_label']
            
            # Get or create patient
            patient = self._get_or_create_patient(request)
            
            # Create PHQ-9 screening record
            screening_data = {
                'patient': patient,
                'q1_interest': answers[0],
                'q2_depressed': answers[1],
                'q3_sleep': answers[2],
                'q4_energy': answers[3],
                'q5_appetite': answers[4],
                'q6_self_esteem': answers[5],
                'q7_concentration': answers[6],
                'q8_psychomotor': answers[7],
                'q9_suicidal': answers[8],
            }
            
            screening = PHQ9Screening.objects.create(**screening_data)
            
            # Process triage rules
            triage_result = triage_service.process_triage(
                patient_id=patient.id,
                survey_type='phq9',
                score=total_score,
                severity_level=severity_level
            )
            
            # Determine triage action
            triage_action = triage_result['triageAction']
            recommended_module = triage_result['recommendedModule']
            
            # Return comprehensive response
            response_data = {
                'totalScore': total_score,
                'severityLevel': severity_label,
                'severityCode': severity_level,
                'triageAction': triage_action,
                'recommendedModule': recommended_module,
                'screeningId': screening.id,
                'message': self._get_action_message(triage_action, severity_label, recommended_module)
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'An error occurred: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='submit/gad7')
    def submit_gad7(self, request):
        """
        Submit GAD-7 survey results
        Expected payload:
        {
            "answers": [0, 1, 2, 1, 0, 2, 1],  // 7 answers (0-3 each)
            "firebase_uid": "optional-firebase-uid"
        }
        """
        try:
            # Get answers from request
            answers = request.data.get('answers', [])
            
            if not answers:
                return Response(
                    {'error': 'Answers array is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate GAD-7 score using TriageService
            score_result = triage_service.calculate_gad7(answers)
            total_score = score_result['total_score']
            severity_level = score_result['severity_level']
            severity_label = score_result['severity_label']
            
            # Get or create patient
            patient = self._get_or_create_patient(request)
            
            # Create GAD-7 screening record
            screening_data = {
                'patient': patient,
                'q1_nervous': answers[0],
                'q2_worry': answers[1],
                'q3_worry_control': answers[2],
                'q4_trouble_relaxing': answers[3],
                'q5_restless': answers[4],
                'q6_irritable': answers[5],
                'q7_afraid': answers[6],
            }
            
            screening = GAD7Screening.objects.create(**screening_data)
            
            # Process triage rules
            triage_result = triage_service.process_triage(
                patient_id=patient.id,
                survey_type='gad7',
                score=total_score,
                severity_level=severity_level
            )
            
            # Determine triage action
            triage_action = triage_result['triageAction']
            recommended_module = triage_result['recommendedModule']
            
            # Return comprehensive response
            response_data = {
                'totalScore': total_score,
                'severityLevel': severity_label,
                'severityCode': severity_level,
                'triageAction': triage_action,
                'recommendedModule': recommended_module,
                'screeningId': screening.id,
                'message': self._get_action_message(triage_action, severity_label, recommended_module)
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'An error occurred: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_action_message(self, triage_action, severity_label, recommended_module):
        """Get user-friendly message based on triage action"""
        messages = {
            'TriggerReferral': f'Your {severity_label} symptoms indicate you may benefit from professional support. A teleconsultation referral has been created.',
            'TriggerClinicianAlert': 'Your symptoms have changed significantly. A clinician will review your case.',
            'RecommendSelfCare': f'Based on your assessment, we recommend trying: {recommended_module}. This can help manage your symptoms.',
            'None': 'Thank you for completing the assessment. Continue monitoring your symptoms.'
        }
        return messages.get(triage_action, 'Assessment completed successfully.')

