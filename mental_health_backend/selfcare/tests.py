from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from screening.models import Patient
from .models import SelfCarePathway, MoodEntry, SelfCareExercise, ExerciseCompletion, PatientSelfCareProgress


class SelfCareRecommendationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_selfcare", email="s@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-selfcare")
        SelfCareExercise.objects.create(
            name="Starter Breathing",
            description="For new users",
            exercise_type="breathing",
            duration_minutes=5,
            difficulty_level="beginner",
            instructions="inhale",
            benefits="calm",
            is_active=True,
        )
        SelfCarePathway.objects.create(
            name="Starter Pathway",
            description="For new users",
            target_symptoms=["stress"],
            target_severity="minimal",
            is_active=True,
        )

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-selfcare"})
    def test_onboarding_recommended_endpoint_returns_payload(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/selfcare/pathways/onboarding-recommended/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("pathways", res.data)
        self.assertIn("recommendation", res.data)
        self.assertIn("recommended_exercises", res.data)
        self.assertIn("activity_summary", res.data)
        self.assertIn("continuity", res.data)
        self.assertIn("reassessment", res.data)
        self.assertIn("next_best_action", res.data)
        self.assertIn("readiness", res.data)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-selfcare"})
    def test_mood_entries_require_auth_and_do_not_need_raw_uid_contract(self, *_mocks):
        unauth = self.client.post("/api/selfcare/mood-entries/", {"mood_level": 3})
        self.assertEqual(unauth.status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        auth_res = self.client.post(
            "/api/selfcare/mood-entries/",
            {"mood_level": 3, "energy_level": 3, "sleep_quality": 3, "stress_level": 3, "notes": "ok"},
        )
        self.assertEqual(auth_res.status_code, 201)
        self.assertEqual(MoodEntry.objects.filter(patient=self.patient).count(), 1)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-selfcare"})
    def test_completion_persists_and_is_listed(self, *_mocks):
        exercise = SelfCareExercise.objects.filter(is_active=True).first()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/selfcare/completions/", {"exercise": exercise.id, "duration_actual": 5, "notes": "done"})
        self.assertEqual(create.status_code, 201)
        self.assertEqual(ExerciseCompletion.objects.filter(patient=self.patient).count(), 1)

        listing = self.client.get("/api/selfcare/completions/")
        self.assertEqual(listing.status_code, 200)
        # Default DRF config may return list or paginated payload.
        data = listing.data if isinstance(listing.data, list) else listing.data.get("results", [])
        self.assertGreaterEqual(len(data), 1)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-selfcare"})
    def test_onboarding_recommended_includes_continuity_state_when_progress_exists(self, *_mocks):
        exercise = SelfCareExercise.objects.filter(is_active=True).first()
        pathway = SelfCarePathway.objects.filter(is_active=True).first()
        PatientSelfCareProgress.objects.create(
            patient=self.patient,
            pathway=pathway,
            current_exercise=exercise,
            progress_percentage=20,
            is_completed=False,
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/selfcare/pathways/onboarding-recommended/")
        self.assertEqual(res.status_code, 200)
        continuity = res.data.get("continuity", {})
        self.assertEqual(continuity.get("continue_pathway_id"), pathway.id)
        self.assertEqual(continuity.get("recommended_next_exercise_id"), exercise.id)
