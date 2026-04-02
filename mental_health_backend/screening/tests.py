from unittest.mock import patch
from datetime import timedelta

from django.contrib.auth.models import AnonymousUser, User
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory
from rest_framework.test import APITestCase

from .firebase_auth import FirebaseAuthentication
from .models import (
    Patient,
    PHQ9Screening,
    GAD7Screening,
    PatientOnboardingStatus,
    PatientProfile,
    PatientConsent,
    TeleconsultReferral,
)
from clinician.models import Clinician, ConsultationCase, PatientAssignment
from selfcare.models import MoodEntry, ExerciseCompletion, SelfCareExercise, SelfCarePathway, PatientSelfCareProgress


class FirebaseAuthenticationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.authenticator = FirebaseAuthentication()

    def test_missing_authorization_header_returns_none(self):
        request = self.factory.get("/api/screening/patients/")
        request.user = AnonymousUser()
        result = self.authenticator.authenticate(request)
        self.assertIsNone(result)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", side_effect=Exception("invalid"))
    def test_invalid_token_raises_authentication_failed(self, *_mocks):
        request = self.factory.get(
            "/api/screening/patients/",
            HTTP_AUTHORIZATION="Bearer bad-token",
        )
        request.user = AnonymousUser()
        with self.assertRaises(AuthenticationFailed):
            self.authenticator.authenticate(request)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token")
    def test_valid_token_resolves_existing_patient_user(self, verify_mock, _init_mock):
        existing_user = User.objects.create_user(username="existing", email="existing@example.com")
        Patient.objects.create(user=existing_user, firebase_uid="uid-123")
        verify_mock.return_value = {"uid": "uid-123", "email": "existing@example.com"}

        request = self.factory.get(
            "/api/screening/patients/",
            HTTP_AUTHORIZATION="Bearer good-token",
        )
        request.user = AnonymousUser()

        user, decoded = self.authenticator.authenticate(request)
        self.assertEqual(user.id, existing_user.id)
        self.assertEqual(decoded.get("uid"), "uid-123")


class OnboardingSchemaCheckTests(TestCase):
    databases = {"default"}

    def test_onboarding_database_check_passes_when_migrated(self):
        from screening.checks import check_onboarding_tables_exist

        errors = check_onboarding_tables_exist(None, databases=["default"])
        self.assertEqual(errors, [])


class OnboardingLazyInitTests(APITestCase):
    """Ensure /onboarding/me/ can bootstrap rows for patients created before onboarding tables existed."""

    def setUp(self):
        self.user = User.objects.create_user(username="onb_lazy", email="lazy@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-lazy-onb")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lazy-onb"})
    def test_get_me_creates_all_onboarding_rows(self, *_mocks):
        from screening.models import (
            PatientBaseline,
            PatientConsent,
            PatientPreferences,
            PatientProfile,
        )

        self.assertFalse(PatientProfile.objects.filter(patient=self.patient).exists())
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/me/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("status", res.data)
        self.assertTrue(PatientProfile.objects.filter(patient=self.patient).exists())
        self.assertTrue(PatientBaseline.objects.filter(patient=self.patient).exists())
        self.assertTrue(PatientConsent.objects.filter(patient=self.patient).exists())
        self.assertTrue(PatientPreferences.objects.filter(patient=self.patient).exists())
        self.assertTrue(PatientOnboardingStatus.objects.filter(patient=self.patient).exists())
        self.assertTrue(res.data["status"]["account_step_completed"])


class OnboardingFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_test", email="t@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-test")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-test"})
    def test_onboarding_summary_and_steps(self, *_mocks):
        # Auth via mocked Firebase ID token
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")

        # Summary bootstrap
        res = self.client.get("/api/screening/onboarding/me/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("status", res.data)

        # Profile save
        res = self.client.patch(
            "/api/screening/onboarding/profile/",
            {"preferred_name": "Alex", "birth_year": 1995},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["profile"]["preferred_name"], "Alex")

        # Baseline save (JSON: list fields are not representable as multipart form)
        res = self.client.patch(
            "/api/screening/onboarding/baseline/",
            {"mood_baseline": 3, "main_concerns": ["sleep"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["baseline"]["mood_baseline"], 3)

        # Consent requires both flags
        bad = self.client.patch(
            "/api/screening/onboarding/consent/",
            {"data_usage_consent_given": True, "emergency_disclaimer_acknowledged": False},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        ok = self.client.patch(
            "/api/screening/onboarding/consent/",
            {"data_usage_consent_given": True, "emergency_disclaimer_acknowledged": True},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["consent"]["data_usage_consent_given"])

        # Assessment offer path (JSON so boolean is not coerced by multipart)
        res = self.client.post("/api/screening/onboarding/assessment/offer/", {"offered": True}, format="json")
        self.assertEqual(res.status_code, 200)

        # Completion attempt
        res = self.client.post("/api/screening/onboarding/complete/", {})
        self.assertEqual(res.status_code, 200)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-test"})
    def test_state_incomplete_user_routes_to_register(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["next_route"], "/register")
        self.assertFalse(res.data["onboarding_complete"])
        self.assertEqual(res.data["resume_step"], "profile")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-test"})
    def test_state_complete_user_routes_to_dashboard(self, *_mocks):
        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_step_completed = True
        status_obj.profile_step_completed = True
        status_obj.baseline_step_completed = True
        status_obj.consent_step_completed = True
        status_obj.advanced_step_completed = True
        status_obj.onboarding_completed_at = timezone.now()
        status_obj.save()

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["next_route"], "/dashboard")
        self.assertTrue(res.data["onboarding_complete"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-test"})
    def test_state_surfaces_elevated_risk_recommendation(self, *_mocks):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3,
            q2_depressed=3,
            q3_sleep=3,
            q4_energy=3,
            q5_appetite=3,
            q6_self_esteem=3,
            q7_concentration=3,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(res.data["recommendation"]["risk_level"], ["high", "critical"])
        self.assertTrue(res.data["recommendation"]["emphasize_professional_support"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-test"})
    def test_assessment_skip_marks_step_complete_and_advances_resume(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        self.client.post("/api/screening/onboarding/assessment/offer/", {"offered": False}, format="json")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["resume_step"], "profile")
        # Complete required steps and confirm assessment does not block completion path
        self.client.patch(
            "/api/screening/onboarding/profile/",
            {"preferred_name": "Alex", "birth_year": 1995},
            format="json",
        )
        self.client.patch(
            "/api/screening/onboarding/baseline/",
            {"mood_baseline": 3, "main_concerns": ["stress"]},
            format="json",
        )
        self.client.patch(
            "/api/screening/onboarding/consent/",
            {"data_usage_consent_given": True, "emergency_disclaimer_acknowledged": True},
            format="json",
        )
        res2 = self.client.get("/api/screening/onboarding/state/")
        self.assertIn(res2.data["resume_step"], ["advanced", "complete"])


class EndpointTighteningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_lock", email="lock@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-lock")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_patient_endpoint_requires_auth_and_create_works_without_raw_uid(self, *_mocks):
        unauth = self.client.get("/api/screening/patients/")
        self.assertEqual(unauth.status_code, 403)

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/patients/", {})
        self.assertIn(create.status_code, [200, 201])
        self.assertEqual(create.data["firebase_uid"], "uid-lock")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_chatbot_endpoint_requires_auth_and_uses_authenticated_identity(self, *_mocks):
        unauth = self.client.post("/api/screening/chatbot/conversations/", {})
        self.assertEqual(unauth.status_code, 403)

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/chatbot/conversations/", {})
        self.assertEqual(create.status_code, 201)
        convo_id = create.data["id"]
        send = self.client.post(f"/api/screening/chatbot/conversations/{convo_id}/send-message/", {"message": "hello"})
        self.assertEqual(send.status_code, 200)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_chatbot_routes_users_into_guided_actions(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/chatbot/conversations/", {})
        self.assertEqual(create.status_code, 201)
        convo_id = create.data["id"]
        send = self.client.post(
            f"/api/screening/chatbot/conversations/{convo_id}/send-message/",
            {"message": "I want to take a screening"},
            format="json",
        )
        self.assertEqual(send.status_code, 200)
        self.assertIn("[Go to Screening]", send.data["bot_response"]["content"])
        self.assertEqual(send.data["assistant_guidance"]["policy_type"], "screening_prompt")
        self.assertEqual(send.data["assistant_guidance"]["actions"][0]["action_key"], "Go to Screening")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_chatbot_refuses_therapy_replacement_style_requests(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/chatbot/conversations/", {})
        convo_id = create.data["id"]
        send = self.client.post(
            f"/api/screening/chatbot/conversations/{convo_id}/send-message/",
            {"message": "Can you diagnose me and replace my therapist?"},
            format="json",
        )
        self.assertEqual(send.status_code, 200)
        content = send.data["bot_response"]["content"].lower()
        self.assertIn("can't diagnose", content)
        self.assertTrue("[Open Dashboard]" in send.data["bot_response"]["content"] or "[Open Self-Care]" in send.data["bot_response"]["content"])
        self.assertEqual(send.data["assistant_guidance"]["policy_type"], "out_of_scope")
        self.assertIn("out of scope", send.data["assistant_guidance"]["safety_notice"].lower())

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_chatbot_surfaces_followup_recommended_for_high_risk_context(self, *_mocks):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3,
            q2_depressed=3,
            q3_sleep=2,
            q4_energy=3,
            q5_appetite=2,
            q6_self_esteem=3,
            q7_concentration=2,
            q8_psychomotor=1,
            q9_suicidal=0,
            total_score=19,
            severity_level="severe",
            risk_level="high",
        )
        consent, _ = PatientConsent.objects.get_or_create(patient=self.patient)
        consent.clinician_access_opt_in = True
        consent.save(update_fields=["clinician_access_opt_in"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/chatbot/conversations/", {})
        convo_id = create.data["id"]
        send = self.client.post(
            f"/api/screening/chatbot/conversations/{convo_id}/send-message/",
            {"message": "What should I do next?"},
            format="json",
        )
        self.assertEqual(send.status_code, 200)
        self.assertEqual(send.data["assistant_guidance"]["policy_type"], "followup_recommended")
        self.assertEqual(send.data["assistant_guidance"]["urgency"], "elevated")
        self.assertEqual(send.data["workflow_state"]["workflow_type"], "care_team_handoff")
        self.assertTrue(TeleconsultReferral.objects.filter(patient=self.patient, status="pending").exists())

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-lock"})
    def test_chatbot_clinician_support_request_routes_into_existing_workflow(self, *_mocks):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3,
            q2_depressed=3,
            q3_sleep=2,
            q4_energy=3,
            q5_appetite=2,
            q6_self_esteem=3,
            q7_concentration=2,
            q8_psychomotor=1,
            q9_suicidal=0,
            total_score=19,
            severity_level="severe",
            risk_level="high",
        )
        consent, _ = PatientConsent.objects.get_or_create(patient=self.patient)
        consent.clinician_access_opt_in = True
        consent.save(update_fields=["clinician_access_opt_in"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        create = self.client.post("/api/screening/chatbot/conversations/", {})
        convo_id = create.data["id"]
        send = self.client.post(
            f"/api/screening/chatbot/conversations/{convo_id}/send-message/",
            {"message": "I want to talk to a clinician"},
            format="json",
        )
        self.assertEqual(send.status_code, 200)
        self.assertEqual(send.data["workflow_state"]["workflow_type"], "care_team_handoff")
        self.assertTrue(any(action["action_key"] == "Open Care Team" for action in send.data["assistant_guidance"]["actions"]))


class LongitudinalSummaryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_long", email="long@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-long")
        self.exercise = SelfCareExercise.objects.create(
            name="Breathing",
            description="desc",
            exercise_type="breathing",
            duration_minutes=5,
            difficulty_level="beginner",
            instructions="inhale",
            benefits="calm",
            is_active=True,
        )

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_state_includes_mood_trend_and_activity_signals(self, *_mocks):
        # Prior window low mood
        MoodEntry.objects.create(patient=self.patient, mood_level=2, energy_level=2, sleep_quality=2, stress_level=4)
        old_entry = MoodEntry.objects.filter(patient=self.patient).first()
        old_entry.created_at = timezone.now() - timedelta(days=21)
        old_entry.save(update_fields=["created_at"])
        # Recent window higher mood
        MoodEntry.objects.create(patient=self.patient, mood_level=4, energy_level=3, sleep_quality=3, stress_level=2)

        ExerciseCompletion.objects.create(patient=self.patient, exercise=self.exercise)
        consent, _ = PatientConsent.objects.get_or_create(patient=self.patient)
        consent.clinician_access_opt_in = True
        consent.save(update_fields=["clinician_access_opt_in"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("mood_trend", res.data)
        self.assertIn("activity", res.data)
        self.assertIn("next_actions", res.data)
        self.assertIn("consent", res.data)
        self.assertEqual(res.data["consent"]["clinician_access_opt_in"], True)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_reassessment_and_next_best_action_for_high_risk_no_followup(self, *_mocks):
        screening = PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3,
            q2_depressed=3,
            q3_sleep=2,
            q4_energy=3,
            q5_appetite=2,
            q6_self_esteem=3,
            q7_concentration=2,
            q8_psychomotor=1,
            q9_suicidal=0,
            total_score=19,
            severity_level="severe",
            risk_level="high",
        )
        screening.created_at = timezone.now() - timedelta(days=8)
        screening.save(update_fields=["created_at"])

        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_step_completed = True
        status_obj.profile_step_completed = True
        status_obj.baseline_step_completed = True
        status_obj.consent_step_completed = True
        status_obj.onboarding_completed_at = timezone.now() - timedelta(days=20)
        status_obj.save()

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["reassessment"]["reassessment_due"])
        self.assertEqual(res.data["reassessment"]["reassessment_priority"], "high")
        self.assertIn(res.data["next_best_action"]["action_type"], ["take_reassessment", "seek_support"])
        self.assertTrue(res.data["readiness"]["high_risk_no_followup"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_sparse_data_user_gets_safe_structured_outputs(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("reassessment", res.data)
        self.assertIn("next_best_action", res.data)
        self.assertIn("readiness", res.data)
        self.assertIn("analytics", res.data)
        self.assertFalse(res.data["activity"]["is_drifting"])
        self.assertFalse(res.data["reassessment"]["reassessment_due"])
        self.assertTrue(res.data["reassessment"]["reassessment_recommended_soon"] in [True, False])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_low_risk_old_assessment_has_low_priority_due(self, *_mocks):
        low = PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=0,
            q2_depressed=0,
            q3_sleep=0,
            q4_energy=0,
            q5_appetite=0,
            q6_self_esteem=0,
            q7_concentration=0,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        low.created_at = timezone.now() - timedelta(days=31)
        low.save(update_fields=["created_at"])
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["reassessment"]["reassessment_due"])
        self.assertEqual(res.data["reassessment"]["reassessment_priority"], "low")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_next_best_action_continue_pathway_branch(self, *_mocks):
        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_step_completed = True
        status_obj.profile_step_completed = True
        status_obj.baseline_step_completed = True
        status_obj.consent_step_completed = True
        status_obj.onboarding_completed_at = timezone.now()
        status_obj.save()

        pathway = SelfCarePathway.objects.create(
            name="Continuity Pathway",
            description="desc",
            target_symptoms=["stress"],
            target_severity="mild",
            is_active=True,
        )
        PatientSelfCareProgress.objects.create(
            patient=self.patient,
            pathway=pathway,
            current_exercise=self.exercise,
            progress_percentage=40,
            is_completed=False,
        )
        # Latest screening must exist or onboarding_complete yields plan_reassessment first.
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=0,
            q2_depressed=0,
            q3_sleep=0,
            q4_energy=0,
            q5_appetite=0,
            q6_self_esteem=0,
            q7_concentration=0,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        # Recent exercise so user is not classified as drifting (reengage would rank above continue_pathway).
        ExerciseCompletion.objects.create(patient=self.patient, exercise=self.exercise, duration_actual=5)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["next_best_action"]["action_type"], "continue_pathway")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_next_best_action_log_mood_branch_when_no_mood_tracking(self, *_mocks):
        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_step_completed = True
        status_obj.profile_step_completed = True
        status_obj.baseline_step_completed = True
        status_obj.consent_step_completed = True
        status_obj.onboarding_completed_at = timezone.now()
        status_obj.save()

        ExerciseCompletion.objects.create(patient=self.patient, exercise=self.exercise, duration_actual=5)
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=0,
            q2_depressed=0,
            q3_sleep=0,
            q4_energy=0,
            q5_appetite=0,
            q6_self_esteem=0,
            q7_concentration=0,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["next_best_action"]["action_type"], "log_mood")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-long"})
    def test_onboarding_complete_without_assessment_is_recommended_soon_not_drifting(self, *_mocks):
        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_step_completed = True
        status_obj.profile_step_completed = True
        status_obj.baseline_step_completed = True
        status_obj.consent_step_completed = True
        status_obj.onboarding_completed_at = timezone.now()
        status_obj.save()

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/screening/onboarding/state/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["reassessment"]["reassessment_due"])
        self.assertTrue(res.data["reassessment"]["reassessment_recommended_soon"])
        self.assertFalse(res.data["activity"]["is_drifting"])
        self.assertEqual(res.data["next_best_action"]["action_type"], "plan_reassessment")


class PatientScorecardTests(APITestCase):
    """Patient scorecard API — read-only GET, aligned with readonly orchestration."""

    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_sc", email="sc@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-scorecard")

    def test_scorecard_me_requires_auth(self):
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 403)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-without-patient"})
    def test_scorecard_me_does_not_create_patient_on_get(self, *_mocks):
        user = User.objects.create_user(username="firebase_uid_no_patient", email="no-patient@example.com")
        self.client.force_authenticate(user=user, token={"uid": "uid-without-patient"})

        before_count = Patient.objects.count()
        res = self.client.get("/api/screening/scorecard/me/")
        after_count = Patient.objects.count()

        self.assertEqual(res.status_code, 404)
        self.assertEqual(before_count, after_count)
        self.assertFalse(Patient.objects.filter(firebase_uid="uid-without-patient").exists())

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_no_screenings(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["patient_id"], self.patient.id)
        self.assertIn("generated_at", res.data)
        self.assertIsNone(res.data["latest_phq9"])
        self.assertIsNone(res.data["latest_gad7"])
        self.assertEqual(res.data["overall_risk_level"], "unknown")
        self.assertFalse(res.data["screening_status"]["has_any_screening"])
        self.assertEqual(res.data["screening_status"]["screening_count"], 0)
        self.assertFalse(res.data["trend_summary"]["has_enough_data"])
        self.assertEqual(res.data["trend_summary"]["direction"], "unknown")
        self.assertIsNone(res.data["trend_summary"]["delta_phq9"])
        self.assertIsNone(res.data["trend_summary"]["delta_gad7"])
        self.assertIn("next_best_action", res.data)
        self.assertIn("flags", res.data)
        self.assertEqual(res.data["scorecard_version"], 3)
        self.assertIn("continuity_summary", res.data)
        self.assertIn("mood_summary", res.data)
        self.assertIn("urgency_tier", res.data["reassessment_summary"])
        self.assertIn("candidate_for_clinician_review", res.data["flags"])
        self.assertIsNone(res.data["screening_status"]["most_recent_instrument"])
        self.assertIn("reassessment_summary", res.data)
        self.assertIn("days_since_last_screening", res.data["screening_status"])
        self.assertIn("phq9_trend_direction", res.data["trend_summary"])
        self.assertIn("gad7_trend_direction", res.data["trend_summary"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_get_does_not_create_onboarding_rows(self, *_mocks):
        self.assertEqual(PatientOnboardingStatus.objects.filter(patient=self.patient).count(), 0)
        self.assertEqual(PatientProfile.objects.filter(patient=self.patient).count(), 0)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(PatientOnboardingStatus.objects.filter(patient=self.patient).count(), 0)
        self.assertEqual(PatientProfile.objects.filter(patient=self.patient).count(), 0)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_next_best_action_matches_readonly_orchestration(self, *_mocks):
        from screening.onboarding_service import build_user_state_summary_readonly

        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        api_res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(api_res.status_code, 200)
        orch = build_user_state_summary_readonly(self.patient)
        self.assertEqual(
            api_res.data["next_best_action"]["action_type"],
            orch["next_best_action"]["action_type"],
        )
        self.assertEqual(
            api_res.data["reassessment_summary"]["reassessment_due"],
            orch["reassessment"]["reassessment_due"],
        )

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_phq9_only_uses_persisted_fields(self, *_mocks):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=1,
            q2_depressed=1,
            q3_sleep=1,
            q4_energy=1,
            q5_appetite=1,
            q6_self_esteem=1,
            q7_concentration=1,
            q8_psychomotor=1,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 200)
        lp = res.data["latest_phq9"]
        self.assertIsNotNone(lp)
        self.assertEqual(lp["score"], 8)
        self.assertEqual(lp["severity_code"], "mild")
        self.assertEqual(lp["risk_level"], "medium")
        self.assertIsNone(res.data["latest_gad7"])
        self.assertTrue(res.data["screening_status"]["has_any_screening"])
        self.assertEqual(res.data["screening_status"]["screening_count"], 1)
        self.assertEqual(res.data["screening_status"]["most_recent_instrument"], "phq9")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_gad7_only(self, *_mocks):
        GAD7Screening.objects.create(
            patient=self.patient,
            q1_nervous=0,
            q2_worry=0,
            q3_worry_control=0,
            q4_trouble_relaxing=0,
            q5_restless=0,
            q6_irritable=0,
            q7_afraid=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["latest_phq9"])
        self.assertIsNotNone(res.data["latest_gad7"])
        self.assertEqual(res.data["latest_gad7"]["score"], 0)
        self.assertEqual(res.data["overall_risk_level"], "low")
        self.assertEqual(res.data["screening_status"]["most_recent_instrument"], "gad7")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-scorecard"})
    def test_scorecard_trend_two_phq9_improving(self, *_mocks):
        high = PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3,
            q2_depressed=3,
            q3_sleep=3,
            q4_energy=3,
            q5_appetite=3,
            q6_self_esteem=3,
            q7_concentration=3,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        PHQ9Screening.objects.filter(pk=high.pk).update(created_at=timezone.now() - timedelta(days=60))
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=0,
            q2_depressed=0,
            q3_sleep=0,
            q4_energy=0,
            q5_appetite=0,
            q6_self_esteem=0,
            q7_concentration=0,
            q8_psychomotor=0,
            q9_suicidal=0,
            total_score=0,
            severity_level="minimal",
            risk_level="low",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/screening/scorecard/me/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["trend_summary"]["has_enough_data"])
        self.assertEqual(res.data["trend_summary"]["direction"], "improving")
        self.assertIsNotNone(res.data["trend_summary"]["delta_phq9"])
        self.assertLess(res.data["trend_summary"]["delta_phq9"], 0)
        self.assertEqual(res.data["trend_summary"]["phq9_trend_direction"], "improving")

    def test_build_patient_scorecard_service_smoke(self):
        from screening.scorecard_service import build_patient_scorecard

        data = build_patient_scorecard(self.patient)
        self.assertEqual(data["patient_id"], self.patient.id)
        self.assertEqual(data["overall_risk_level"], "unknown")


class ScreeningAutoAssignmentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="patient_auto_assign", email="auto@example.com")
        self.patient = Patient.objects.create(user=self.user, firebase_uid="uid-auto-assign")
        self.clin_user_1 = User.objects.create_user(username="clin_auto_1", email="clin1@example.com")
        self.clin_user_2 = User.objects.create_user(username="clin_auto_2", email="clin2@example.com")
        self.clinician_1 = Clinician.objects.create(
            user=self.clin_user_1,
            license_number="LIC-AUTO-1",
            specialization="Psychiatry",
            phone_number="1111111111",
            status=Clinician.Status.APPROVED,
        )
        self.clinician_2 = Clinician.objects.create(
            user=self.clin_user_2,
            license_number="LIC-AUTO-2",
            specialization="Psychology",
            phone_number="2222222222",
            status=Clinician.Status.APPROVED,
        )

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-auto-assign"})
    def test_severe_phq9_auto_assigns_patient_to_all_clinicians(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.post(
            "/api/screening/phq9-screenings/",
            {
                "q1_interest": 3,
                "q2_depressed": 3,
                "q3_sleep": 3,
                "q4_energy": 3,
                "q5_appetite": 3,
                "q6_self_esteem": 3,
                "q7_concentration": 3,
                "q8_psychomotor": 3,
                "q9_suicidal": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            PatientAssignment.objects.filter(patient=self.patient, clinician=self.clinician_1, is_active=True).exists()
        )
        self.assertTrue(
            PatientAssignment.objects.filter(patient=self.patient, clinician=self.clinician_2, is_active=True).exists()
        )
        self.assertTrue(
            ConsultationCase.objects.filter(patient=self.patient, assigned_clinician=self.clinician_1).exists()
        )
        self.assertTrue(
            ConsultationCase.objects.filter(patient=self.patient, assigned_clinician=self.clinician_2).exists()
        )
