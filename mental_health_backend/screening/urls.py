from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (PatientViewSet, PHQ9ScreeningViewSet, GAD7ScreeningViewSet,
                   ScreeningAlertViewSet, TeleconsultReferralViewSet,
                   ScreeningSummaryViewSet, ChatbotConversationViewSet)
from .survey_views import SurveySubmissionViewSet

router = DefaultRouter()
router.register(r'patients', PatientViewSet)
router.register(r'phq9-screenings', PHQ9ScreeningViewSet)
router.register(r'gad7-screenings', GAD7ScreeningViewSet)
router.register(r'alerts', ScreeningAlertViewSet)
router.register(r'teleconsult-referrals', TeleconsultReferralViewSet)
router.register(r'screening-summary', ScreeningSummaryViewSet, basename='screening-summary')
router.register(r'chatbot/conversations', ChatbotConversationViewSet, basename='chatbot-conversations')
router.register(r'surveys', SurveySubmissionViewSet, basename='surveys')

urlpatterns = [
    path('', include(router.urls)),
]






