from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (SelfCareExerciseViewSet, SelfCarePathwayViewSet,
                   PatientSelfCareProgressViewSet, ExerciseCompletionViewSet,
                   MoodEntryViewSet, CoachCheckInViewSet, PatientMessageViewSet)

router = DefaultRouter()
router.register(r'exercises', SelfCareExerciseViewSet)
router.register(r'pathways', SelfCarePathwayViewSet)
router.register(r'progress', PatientSelfCareProgressViewSet)
router.register(r'completions', ExerciseCompletionViewSet)
router.register(r'mood-entries', MoodEntryViewSet)
router.register(r'check-ins', CoachCheckInViewSet)
router.register(r'messages', PatientMessageViewSet)

urlpatterns = [
    path('', include(router.urls)),
]









