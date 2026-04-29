from unittest.mock import patch
from datetime import timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from screening.models import Patient, PHQ9Screening, PatientProfile, PatientConsent, PatientOnboardingStatus
from .models import (
    Appointment,
    ClinicalNote,
    Clinician,
    ClinicianDocument,
    PatientAssignment,
    ConsultationCase,
    ConsultationMessage,
    CareNotification,
    CareEscalationEvent,
)
from screening.scorecard_service import build_clinician_patient_summary, build_patient_scorecard
from .consultation_service import ensure_consultation_case_for_assignment


class ClinicianRouteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="firebase_uid_clin", email="c@example.com")
        Patient.objects.create(user=self.user, firebase_uid="uid-clin")
        Clinician.objects.create(
            user=self.user,
            license_number="LIC-001",
            specialization="Psychiatry",
            phone_number="1234567890",
            status=Clinician.Status.APPROVED,
        )

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-clin"})
    def test_clinician_me_route_is_reachable(self, *_mocks):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/clinician/me/")
        self.assertEqual(res.status_code, 200)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-clin"})
    def test_patient_summaries_are_consent_aware(self, *_mocks):
        clinician = Clinician.objects.get(user=self.user)
        patient = Patient.objects.get(firebase_uid="uid-clin")
        PatientAssignment.objects.create(patient=patient, clinician=clinician, is_active=True)
        consent, _ = PatientConsent.objects.get_or_create(patient=patient)
        consent.clinician_access_opt_in = False
        consent.save(update_fields=["clinician_access_opt_in"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertGreaterEqual(len(res.data["results"]), 1)
        first = res.data["results"][0]
        self.assertIn("candidate_for_clinician_review", first)
        self.assertIn("high_risk_no_followup", first)
        self.assertIn("reassessment_due", first)
        self.assertIn("overall_risk_level", first)
        self.assertIn("scorecard_version", first)
        self.assertIn("reassessment_urgency_tier", first)
        self.assertEqual(first["risk_level"], first["overall_risk_level"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-clin"})
    def test_patient_summaries_align_with_scorecard_service(self, *_mocks):
        clinician = Clinician.objects.get(user=self.user)
        pu = User.objects.create_user(username="pat_two", email="pat2@example.com")
        patient = Patient.objects.create(user=pu, firebase_uid="uid-pat-two")
        PatientAssignment.objects.create(patient=patient, clinician=clinician, is_active=True)
        PHQ9Screening.objects.create(
            patient=patient,
            q1_interest=2,
            q2_depressed=2,
            q3_sleep=2,
            q4_energy=2,
            q5_appetite=2,
            q6_self_esteem=2,
            q7_concentration=2,
            q8_psychomotor=1,
            q9_suicidal=0,
            total_score=0,
            severity_level="moderate",
            risk_level="medium",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        row = next(r for r in res.data["results"] if r["patient_id"] == patient.id)
        sc = build_patient_scorecard(patient)
        self.assertEqual(row["overall_risk_level"], sc["overall_risk_level"])
        self.assertEqual(row["trend_direction"], sc["trend_summary"]["direction"])
        self.assertEqual(row["next_best_action"]["action_type"], sc["next_best_action"]["action_type"])
        self.assertEqual(row["flags"]["high_risk_no_followup"], sc["flags"]["high_risk_no_followup"])

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-clin"})
    def test_patient_summaries_consent_gates_preferred_name(self, *_mocks):
        clinician = Clinician.objects.get(user=self.user)
        pu = User.objects.create_user(username="pat_three", email="pat3@example.com")
        patient = Patient.objects.create(user=pu, firebase_uid="uid-pat-three")
        PatientAssignment.objects.create(patient=patient, clinician=clinician, is_active=True)
        profile, _ = PatientProfile.objects.get_or_create(patient=patient)
        profile.preferred_name = "SecretName"
        profile.save(update_fields=["preferred_name"])
        consent, _ = PatientConsent.objects.get_or_create(patient=patient)
        consent.clinician_access_opt_in = False
        consent.save(update_fields=["clinician_access_opt_in"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/clinician/me/patient-summaries/")
        row = next(r for r in res.data["results"] if r["patient_id"] == patient.id)
        self.assertEqual(row["preferred_name"], "")

        consent.clinician_access_opt_in = True
        consent.save(update_fields=["clinician_access_opt_in"])
        res2 = self.client.get("/api/clinician/me/patient-summaries/")
        row2 = next(r for r in res2.data["results"] if r["patient_id"] == patient.id)
        self.assertEqual(row2["preferred_name"], "SecretName")

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-clin"})
    def test_patient_summaries_get_does_not_create_onboarding_row(self, *_mocks):
        clinician = Clinician.objects.get(user=self.user)
        pu = User.objects.create_user(username="pat_four", email="pat4@example.com")
        patient = Patient.objects.create(user=pu, firebase_uid="uid-pat-four")
        PatientAssignment.objects.create(patient=patient, clinician=clinician, is_active=True)
        self.assertEqual(PatientOnboardingStatus.objects.filter(patient=patient).count(), 0)

        self.client.credentials(HTTP_AUTHORIZATION="Bearer good-token")
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(PatientOnboardingStatus.objects.filter(patient=patient).count(), 0)
        summary = build_clinician_patient_summary(patient)
        self.assertEqual(summary["patient_id"], patient.id)


class ClinicianPhase1RegistrationTests(APITestCase):
    def test_clinician_registration_creates_approved_profile(self):
        u = User.objects.create_user(username="firebase_newclin", email="newc@example.com")
        self.client.force_authenticate(user=u)
        res = self.client.post(
            "/api/clinician/auth/register/",
            {
                "license_number": "LIC-NEW-001",
                "specialization": "Psychology",
                "phone_number": "5550001111",
                "qualification": "PhD Clinical Psychology",
                "years_of_experience": 5,
                "organization": "Test Clinic",
                "max_patients_per_day": 12,
                "communication_modes": ["email", "video"],
                "bio": "Focus on anxiety.",
                "first_name": "Nina",
                "last_name": "Nguyen",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], Clinician.Status.APPROVED)
        self.assertEqual(res.data["license_number"], "LIC-NEW-001")
        self.assertEqual(res.data["years_of_experience"], 5)
        self.assertEqual(res.data["communication_modes"], ["email", "video"])
        c = Clinician.objects.get(user=u)
        self.assertEqual(c.status, Clinician.Status.APPROVED)
        u.refresh_from_db()
        self.assertEqual(u.first_name, "Nina")

    def test_clinician_registration_duplicate_rejected(self):
        u = User.objects.create_user(username="firebase_dup", email="dup@example.com")
        Clinician.objects.create(
            user=u,
            license_number="LIC-DUP",
            specialization="Psychiatry",
            phone_number="1",
            status=Clinician.Status.PENDING,
        )
        self.client.force_authenticate(user=u)
        res = self.client.post(
            "/api/clinician/auth/register/",
            {
                "license_number": "LIC-OTHER",
                "specialization": "Psychiatry",
                "phone_number": "2",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_pending_clinician_can_access_patient_summaries(self):
        u = User.objects.create_user(username="firebase_pending", email="pend@example.com")
        Patient.objects.create(user=u, firebase_uid="uid-pending-clin")
        c = Clinician.objects.create(
            user=u,
            license_number="LIC-PEND",
            specialization="Psychiatry",
            phone_number="1",
            status=Clinician.Status.PENDING,
        )
        p2 = User.objects.create_user(username="p2", email="p2@example.com")
        patient = Patient.objects.create(user=p2, firebase_uid="uid-p2")
        PatientAssignment.objects.create(patient=patient, clinician=c, is_active=True)
        self.client.force_authenticate(user=u)
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)

    def test_rejected_clinician_can_access_patient_summaries_in_simplified_console_flow(self):
        u = User.objects.create_user(username="firebase_rejected", email="rej@example.com")
        Patient.objects.create(user=u, firebase_uid="uid-rejected-clin")
        c = Clinician.objects.create(
            user=u,
            license_number="LIC-REJ",
            specialization="Psychiatry",
            phone_number="1",
            status=Clinician.Status.REJECTED,
        )
        p2 = User.objects.create_user(username="p_rej", email="p_rej@example.com")
        patient = Patient.objects.create(user=p2, firebase_uid="uid-p-rej")
        PatientAssignment.objects.create(patient=patient, clinician=c, is_active=True)
        self.client.force_authenticate(user=u)
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)

    @patch("screening.firebase_auth.initialize_firebase_admin", return_value=True)
    @patch("screening.firebase_auth.auth.verify_id_token", return_value={"uid": "uid-approved-clin"})
    def test_approved_clinician_patient_summaries_ok(self, *_mocks):
        u = User.objects.create_user(username="firebase_uid_appr", email="appr@example.com")
        Patient.objects.create(user=u, firebase_uid="uid-approved-clin")
        Clinician.objects.create(
            user=u,
            license_number="LIC-APR",
            specialization="Psychiatry",
            phone_number="1",
            status=Clinician.Status.APPROVED,
        )
        pu = User.objects.create_user(username="px", email="px@example.com")
        patient = Patient.objects.create(user=pu, firebase_uid="uid-px")
        PatientAssignment.objects.create(
            patient=patient,
            clinician=Clinician.objects.get(user=u),
            is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer t")
        res = self.client.get("/api/clinician/me/patient-summaries/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)

    def test_auth_status_and_me(self):
        u = User.objects.create_user(username="firebase_stat", email="st@example.com")
        self.client.force_authenticate(user=u)
        r0 = self.client.get("/api/clinician/auth/status/")
        self.assertEqual(r0.status_code, 200)
        self.assertFalse(r0.data["has_clinician_profile"])
        self.client.post(
            "/api/clinician/auth/register/",
            {
                "license_number": "LIC-ST",
                "specialization": "Psychiatry",
                "phone_number": "9",
            },
            format="json",
        )
        r1 = self.client.get("/api/clinician/auth/status/")
        self.assertTrue(r1.data["has_clinician_profile"])
        self.assertEqual(r1.data["status"], Clinician.Status.APPROVED)
        self.assertTrue(r1.data["is_approved"])
        r2 = self.client.get("/api/clinician/auth/me/")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["status"], Clinician.Status.APPROVED)

    def test_clinician_document_metadata_create(self):
        u = User.objects.create_user(username="firebase_doc", email="doc@example.com")
        self.client.force_authenticate(user=u)
        self.client.post(
            "/api/clinician/auth/register/",
            {
                "license_number": "LIC-DOC",
                "specialization": "Psychiatry",
                "phone_number": "8",
            },
            format="json",
        )
        res = self.client.post(
            "/api/clinician/auth/documents/",
            {"document_type": ClinicianDocument.DocumentType.LICENSE_CERTIFICATE, "file_url": "https://example.com/a.pdf"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["verification_status"], ClinicianDocument.VerificationStatus.PENDING)
        doc = ClinicianDocument.objects.get(clinician__user=u)
        self.assertEqual(doc.file_url, "https://example.com/a.pdf")

    def test_patch_profile_while_pending(self):
        u = User.objects.create_user(username="firebase_patch", email="patch@example.com")
        self.client.force_authenticate(user=u)
        self.client.post(
            "/api/clinician/auth/register/",
            {
                "license_number": "LIC-PATCH",
                "specialization": "Psychiatry",
                "phone_number": "7",
            },
            format="json",
        )
        res = self.client.patch(
            "/api/clinician/auth/profile/",
            {"bio": "Updated bio", "communication_modes": ["phone"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["bio"], "Updated bio")
        self.assertEqual(res.data["communication_modes"], ["phone"])


class ConsultationFoundationTests(APITestCase):
    """Phase 1: consultation foundation behavior (minimal)."""
    def setUp(self):
        self.clin_user = User.objects.create_user(username="clin_consult", email="cc@example.com")
        self.pat_user = User.objects.create_user(username="pat_consult", email="pc@example.com")
        self.patient = Patient.objects.create(user=self.pat_user, firebase_uid="uid-pc")
        self.clinician = Clinician.objects.create(
            user=self.clin_user,
            license_number="LIC-CONSULT",
            specialization="Psychiatry",
            phone_number="555-111",
            status=Clinician.Status.APPROVED,
        )
        self.assignment = PatientAssignment.objects.create(patient=self.patient, clinician=self.clinician, is_active=True)

    def test_consultation_case_created_from_high_risk(self):
        # Create a high-risk PHQ-9
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.assertIsNotNone(case)
        self.assertEqual(case.assigned_clinician, self.clinician)
        self.assertEqual(case.patient, self.patient)
        self.assertIn(case.priority, ("high", "urgent", "medium"))
        # Deduplication: second ensure does not create an additional open case
        case2 = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.assertEqual(case.id, case2.id)

    def test_consultations_api_requires_assignment(self):
        # Create case
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        ensure_consultation_case_for_assignment(self.clinician, self.patient)
        # Another clinician should not see this
        other_user = User.objects.create_user(username="clin_other", email="co@example.com")
        other_clin = Clinician.objects.create(
            user=other_user, license_number="LIC-OTHER", specialization="Psych", phone_number="1", status=Clinician.Status.APPROVED
        )
        self.client.force_authenticate(user=other_user)
        res = self.client.get("/api/clinician/consultations/")
        self.assertEqual(res.status_code, 200)
        empty = res.data if isinstance(res.data, list) else res.data.get("results", [])
        self.assertEqual(len(empty), 0)

        self.client.force_authenticate(user=self.clin_user)
        res2 = self.client.get("/api/clinician/consultations/")
        self.assertEqual(res2.status_code, 200)
        rows = res2.data if isinstance(res2.data, list) else res2.data.get("results", [])
        self.assertGreaterEqual(len(rows), 1)

    def test_consultation_queue_auto_derives_and_includes_patient_summary(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/consultations/")
        self.assertEqual(res.status_code, 200)
        rows = res.data if isinstance(res.data, list) else res.data.get("results", [])
        self.assertEqual(len(rows), 1)
        self.assertIn("patient_summary", rows[0])
        self.assertEqual(rows[0]["patient_summary"]["overall_risk_level"], "critical")
        self.assertIsNotNone(rows[0]["patient_summary"]["latest_phq9"])

    def test_clinician_can_post_message_and_patient_can_read_thread(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        send = self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Please book a follow-up."}, format="json")
        self.assertEqual(send.status_code, 201)
        case.refresh_from_db()
        self.assertEqual(case.thread.patient_unread_count, 1)

        self.client.force_authenticate(user=self.pat_user)
        detail = self.client.get(f"/api/clinician/patient/me/consultations/thread/?case_id={case.id}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data["messages"]), 1)
        self.assertEqual(detail.data["messages"][0]["content"], "Please book a follow-up.")

        msg_id = detail.data["messages"][0]["id"]
        mark = self.client.post(f"/api/clinician/patient/me/consultations/{case.id}/messages/{msg_id}/mark-read/")
        self.assertEqual(mark.status_code, 200)
        case.thread.refresh_from_db()
        self.assertEqual(case.thread.patient_unread_count, 0)

    def test_patient_reply_increments_clinician_unread_and_mark_read_works(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.pat_user)
        send = self.client.post("/api/clinician/patient/me/consultations/thread/", {"case_id": case.id, "content": "I can talk tomorrow."}, format="json")
        self.assertEqual(send.status_code, 201)
        case.thread.refresh_from_db()
        self.assertEqual(case.thread.clinician_unread_count, 1)

        self.client.force_authenticate(user=self.clin_user)
        mark = self.client.post(f"/api/clinician/consultations/{case.id}/messages/{send.data['id']}/mark-read/")
        self.assertEqual(mark.status_code, 200)
        case.thread.refresh_from_db()
        self.assertEqual(case.thread.clinician_unread_count, 0)
        msg = ConsultationMessage.objects.get(id=send.data["id"])
        self.assertTrue(msg.is_read)

    def test_other_patient_cannot_access_thread(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        other_patient_user = User.objects.create_user(username="pat_other", email="other@example.com")
        Patient.objects.create(user=other_patient_user, firebase_uid="uid-other-patient")
        self.client.force_authenticate(user=other_patient_user)
        res = self.client.get(f"/api/clinician/patient/me/consultations/thread/?case_id={case.id}")
        self.assertEqual(res.status_code, 404)

    def test_other_clinician_cannot_post_to_unassigned_case(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        other_user = User.objects.create_user(username="clin_blocked", email="blocked@example.com")
        Patient.objects.create(user=other_user, firebase_uid="uid-clin-blocked")
        Clinician.objects.create(
            user=other_user,
            license_number="LIC-BLOCKED",
            specialization="Psychiatry",
            phone_number="555-222",
            status=Clinician.Status.APPROVED,
        )
        self.client.force_authenticate(user=other_user)
        res = self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Unauthorized"}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_clinician_message_moves_case_to_awaiting_patient(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Please reply with a good time."}, format="json")
        self.assertEqual(res.status_code, 201)
        case.refresh_from_db()
        self.assertEqual(case.status, "awaiting_patient")
        self.assertTrue(case.requires_follow_up)
        self.assertIsNotNone(case.last_activity_at)
        self.assertIsNone(case.resolved_at)

    def test_patient_reply_moves_case_to_awaiting_clinician(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        case.status = "awaiting_patient"
        case.save(update_fields=["status"])
        self.client.force_authenticate(user=self.pat_user)
        res = self.client.post("/api/clinician/patient/me/consultations/thread/", {"case_id": case.id, "content": "Tomorrow works for me."}, format="json")
        self.assertEqual(res.status_code, 201)
        case.refresh_from_db()
        self.assertEqual(case.status, "awaiting_clinician")
        self.assertTrue(case.requires_follow_up)
        self.assertIsNone(case.resolved_at)

    def test_set_status_resolved_sets_resolution_timestamp(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.post(f"/api/clinician/consultations/{case.id}/set-status/", {"status": "resolved"}, format="json")
        self.assertEqual(res.status_code, 200)
        case.refresh_from_db()
        self.assertEqual(case.status, "resolved")
        self.assertFalse(case.requires_follow_up)
        self.assertIsNotNone(case.resolved_at)

    def test_create_linked_appointment_requires_matching_patient_for_case(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        other_user = User.objects.create_user(username="pat_mismatch", email="mismatch@example.com")
        other_patient = Patient.objects.create(user=other_user, firebase_uid="uid-mismatch")
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": other_patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-01T14:00:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Appointment.objects.count(), 0)

    def test_create_linked_note_requires_case_owned_by_clinician(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        other_user = User.objects.create_user(username="clin_phase4_other", email="phase4-other@example.com")
        Clinician.objects.create(
            user=other_user,
            license_number="LIC-PHASE4-OTHER",
            specialization="Psychiatry",
            phone_number="555-333",
            status=Clinician.Status.APPROVED,
        )
        self.client.force_authenticate(user=other_user)
        res = self.client.post(
            "/api/clinician/clinical-notes/",
            {
                "patient": self.patient.id,
                "note_type": "progress",
                "content": "Unauthorized note",
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(ClinicalNote.objects.count(), 0)

    def test_linked_appointment_updates_case_status_and_patient_list_summary(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        create = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-01T14:00:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        case.refresh_from_db()
        self.assertEqual(case.status, "awaiting_patient")
        self.client.force_authenticate(user=self.pat_user)
        res = self.client.get("/api/clinician/patient/me/consultations/")
        self.assertEqual(res.status_code, 200)
        row = res.data["results"][0]
        self.assertEqual(row["status"], "awaiting_patient")
        self.assertEqual(row["next_appointment_status"], "scheduled")
        self.assertIsNotNone(row["next_appointment_at"])
        self.assertEqual(row["next_appointment_at"].year, 2026)
        self.assertEqual(row["next_appointment_at"].month, 4)
        self.assertEqual(row["next_appointment_at"].day, 1)
        self.assertEqual(row["next_appointment_at"].hour, 14)

    def test_clinician_consultation_summary_counts_are_assignment_scoped_and_not_double_counted(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.pat_user)
        send = self.client.post("/api/clinician/patient/me/consultations/thread/", {"case_id": case.id, "content": "I replied."}, format="json")
        self.assertEqual(send.status_code, 201)

        other_user = User.objects.create_user(username="phase5-other-patient", email="phase5-other@example.com")
        other_patient = Patient.objects.create(user=other_user, firebase_uid="uid-phase5-other")
        PatientAssignment.objects.create(patient=other_patient, clinician=self.clinician, is_active=True)
        PHQ9Screening.objects.create(
            patient=other_patient,
            q1_interest=2, q2_depressed=2, q3_sleep=2, q4_energy=2, q5_appetite=2, q6_self_esteem=2, q7_concentration=2, q8_psychomotor=1, q9_suicidal=0,
            total_score=0, severity_level="moderate", risk_level="medium"
        )
        other_case = ensure_consultation_case_for_assignment(self.clinician, other_patient)
        other_case.status = "scheduled"
        other_case.save(update_fields=["status"])

        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/me/consultation-summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["unread_patient_replies"], 1)
        self.assertEqual(res.data["awaiting_patient_cases"], 0)
        self.assertEqual(res.data["scheduled_followups"], 1)
        self.assertEqual(res.data["total_actionable_cases"], 2)

    def test_patient_care_team_summary_counts_use_own_cases_only(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Please reply."}, format="json")
        self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-02T10:00:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )

        other_user = User.objects.create_user(username="phase5-second-patient", email="phase5-second@example.com")
        other_patient = Patient.objects.create(user=other_user, firebase_uid="uid-phase5-second")
        PatientAssignment.objects.create(patient=other_patient, clinician=self.clinician, is_active=True)
        PHQ9Screening.objects.create(
            patient=other_patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        other_case = ensure_consultation_case_for_assignment(self.clinician, other_patient)
        self.client.post(f"/api/clinician/consultations/{other_case.id}/messages/", {"content": "Other patient message"}, format="json")

        self.client.force_authenticate(user=self.pat_user)
        res = self.client.get("/api/clinician/patient/me/care-team-summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["unread_clinician_messages"], 1)
        self.assertEqual(res.data["active_conversations"], 1)
        self.assertEqual(res.data["scheduled_followups"], 1)
        self.assertEqual(res.data["unresolved_followups"], 1)

    def test_patient_consultation_list_is_patient_safe(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.pat_user)
        res = self.client.get("/api/clinician/patient/me/consultations/")
        self.assertEqual(res.status_code, 200)
        row = res.data["results"][0]
        self.assertNotIn("patient_summary", row)
        self.assertNotIn("trigger_reason", row)
        self.assertNotIn("unread_for_clinician", row)
        self.assertIn("care_preview", row)

    def test_linked_appointment_adds_patient_visible_system_notice(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        create = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-01T15:30:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.client.force_authenticate(user=self.pat_user)
        detail = self.client.get(f"/api/clinician/patient/me/consultations/thread/?case_id={case.id}")
        self.assertEqual(detail.status_code, 200)
        sys_msgs = [m for m in detail.data["messages"] if m["sender_type"] == "system"]
        self.assertTrue(any("accept or reject" in m["content"].lower() for m in sys_msgs))
        self.assertEqual(detail.data["pending_patient_appointment"]["id"], create.data["id"])

    def test_linked_appointment_recreates_missing_thread_and_still_notifies_patient(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        case.thread.delete()
        self.client.force_authenticate(user=self.clin_user)
        create = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-03T11:00:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        self.client.force_authenticate(user=self.pat_user)
        detail = self.client.get(f"/api/clinician/patient/me/consultations/thread/?case_id={case.id}")
        self.assertEqual(detail.status_code, 200)
        self.assertTrue(detail.data["messages"])
        self.assertTrue(
            any(
                m["sender_type"] == "system" and m["message_type"] == "appointment_notice"
                for m in detail.data["messages"]
            )
        )

    def test_patient_can_accept_appointment_from_chat_flow(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        create = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-07T10:00:00Z",
                "duration_minutes": 45,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        case.refresh_from_db()
        self.assertEqual(case.status, "awaiting_patient")

        self.client.force_authenticate(user=self.pat_user)
        respond = self.client.post(
            f"/api/clinician/patient/me/appointments/{create.data['id']}/respond/",
            {"response": "accepted"},
            format="json",
        )
        self.assertEqual(respond.status_code, 200)
        self.assertEqual(respond.data["patient_response"], "accepted")
        self.assertEqual(respond.data["status"], "confirmed")
        case.refresh_from_db()
        self.assertEqual(case.status, "scheduled")
        detail = self.client.get(f"/api/clinician/patient/me/consultations/thread/?case_id={case.id}")
        self.assertIsNone(detail.data["pending_patient_appointment"])
        self.assertTrue(any("accepted the appointment" in m["content"].lower() for m in detail.data["messages"]))

    def test_patient_can_reject_appointment_from_chat_flow(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        create = self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-08T10:00:00Z",
                "duration_minutes": 45,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201)

        self.client.force_authenticate(user=self.pat_user)
        respond = self.client.post(
            f"/api/clinician/patient/me/appointments/{create.data['id']}/respond/",
            {"response": "rejected"},
            format="json",
        )
        self.assertEqual(respond.status_code, 200)
        self.assertEqual(respond.data["patient_response"], "rejected")
        self.assertEqual(respond.data["status"], "cancelled")
        case.refresh_from_db()
        self.assertEqual(case.status, "awaiting_clinician")

    def test_staff_assignment_endpoints_require_staff(self):
        self.client.force_authenticate(user=self.pat_user)
        res = self.client.get("/api/clinician/internal/staff/assignments/")
        self.assertEqual(res.status_code, 403)
        res2 = self.client.post(
            "/api/clinician/internal/staff/assignments/transfer/",
            {"patient": self.patient.id, "to_clinician": self.clinician.id},
            format="json",
        )
        self.assertEqual(res2.status_code, 403)

    def test_staff_can_list_and_transfer_assignments(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        staff = User.objects.create_user(username="staff_ops", email="staff@example.com", is_staff=True)
        other_clin_user = User.objects.create_user(username="clin_b", email="clinb@example.com")
        other_clin = Clinician.objects.create(
            user=other_clin_user,
            license_number="LIC-STAFF-B",
            specialization="Psychiatry",
            phone_number="555-999",
            status=Clinician.Status.APPROVED,
        )
        self.client.force_authenticate(user=staff)
        res = self.client.get("/api/clinician/internal/staff/assignments/")
        self.assertEqual(res.status_code, 200)
        rows = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
        self.assertGreaterEqual(len(rows), 1)
        xfer = self.client.post(
            "/api/clinician/internal/staff/assignments/transfer/",
            {"patient": self.patient.id, "to_clinician": other_clin.id, "notes": "handoff"},
            format="json",
        )
        self.assertEqual(xfer.status_code, 201)
        self.assertFalse(
            PatientAssignment.objects.filter(patient=self.patient, clinician=self.clinician, is_active=True).exists()
        )
        self.assertTrue(
            PatientAssignment.objects.filter(patient=self.patient, clinician=other_clin, is_active=True).exists()
        )

    def test_clinician_consultation_events_stream_emits_ready_and_update(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/me/consultation-events/")
        self.assertEqual(res.status_code, 200)
        chunks = []
        stream = iter(res.streaming_content)
        chunks.append(next(stream).decode())
        chunks.append(next(stream).decode())
        payload = "".join(chunks)
        self.assertIn("event: ready", payload)
        self.assertIn("event: update", payload)
        self.assertIn("total_actionable_cases", payload)

    def test_patient_thread_events_stream_is_patient_scoped(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Realtime follow-up."}, format="json")

        self.client.force_authenticate(user=self.pat_user)
        res = self.client.get(f"/api/clinician/patient/me/consultations/{case.id}/thread-events/")
        self.assertEqual(res.status_code, 200)
        chunks = []
        stream = iter(res.streaming_content)
        chunks.append(next(stream).decode())
        chunks.append(next(stream).decode())
        payload = "".join(chunks)
        self.assertIn("event: update", payload)
        self.assertIn('"case_id": %s' % case.id, payload)
        self.assertIn('"patient_unread_count": 1', payload)

    def test_clinician_message_creates_durable_patient_notification(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        send = self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Please check Care Team."}, format="json")
        self.assertEqual(send.status_code, 201)
        self.assertTrue(
            CareNotification.objects.filter(
                consultation_case=case,
                channel="in_app",
                notification_type="care_team_message",
                recipient_role="patient",
            ).exists()
        )
        self.client.force_authenticate(user=self.pat_user)
        summary = self.client.get("/api/clinician/patient/me/care-team-summary/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["unread_notifications"], 1)
        notifications = self.client.get("/api/clinician/patient/me/notifications/")
        self.assertEqual(notifications.status_code, 200)
        self.assertEqual(len(notifications.data["results"]), 1)
        self.assertEqual(notifications.data["results"][0]["notification_type"], "care_team_message")

    def test_patient_can_mark_care_notification_read(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        self.client.post(
            "/api/clinician/appointments/",
            {
                "patient": self.patient.id,
                "appointment_type": "follow_up",
                "scheduled_date": "2026-04-05T09:00:00Z",
                "duration_minutes": 30,
                "consultation_case": case.id,
            },
            format="json",
        )
        self.client.force_authenticate(user=self.pat_user)
        notifications = self.client.get("/api/clinician/patient/me/notifications/")
        self.assertEqual(notifications.status_code, 200)
        notif_id = notifications.data["results"][0]["id"]
        mark = self.client.post(f"/api/clinician/patient/me/notifications/{notif_id}/mark-read/")
        self.assertEqual(mark.status_code, 200)
        summary = self.client.get("/api/clinician/patient/me/care-team-summary/")
        self.assertEqual(summary.data["unread_notifications"], 0)

    def test_reassessment_due_notification_is_created_once_after_two_weeks(self):
        screening = PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=1, q2_depressed=1, q3_sleep=1, q4_energy=1, q5_appetite=1, q6_self_esteem=1, q7_concentration=1, q8_psychomotor=1, q9_suicidal=0,
            total_score=0, severity_level="mild", risk_level="low",
        )
        PHQ9Screening.objects.filter(id=screening.id).update(created_at=timezone.now() - timedelta(days=15))
        status_obj, _ = PatientOnboardingStatus.objects.get_or_create(patient=self.patient)
        status_obj.account_completed_at = timezone.now()
        status_obj.profile_completed_at = timezone.now()
        status_obj.baseline_completed_at = timezone.now()
        status_obj.consent_completed_at = timezone.now()
        status_obj.assessment_completed_at = timezone.now()
        status_obj.advanced_completed_at = timezone.now()
        status_obj.onboarding_completed_at = timezone.now()
        status_obj.save()

        self.client.force_authenticate(user=self.pat_user)
        first = self.client.get("/api/clinician/patient/me/notifications/")
        self.assertEqual(first.status_code, 200)
        due_notifications = [n for n in first.data["results"] if n["notification_type"] == "reassessment_due"]
        self.assertEqual(len(due_notifications), 1)

        second = self.client.get("/api/clinician/patient/me/notifications/")
        self.assertEqual(second.status_code, 200)
        due_notifications_second = [n for n in second.data["results"] if n["notification_type"] == "reassessment_due"]
        self.assertEqual(len(due_notifications_second), 1)

    def test_overdue_awaiting_patient_creates_reminder_and_escalation(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        ConsultationCase.objects.filter(id=case.id).update(
            status="awaiting_patient",
            last_activity_at=timezone.now() - timedelta(hours=25),
        )

        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/me/escalations/")
        self.assertEqual(res.status_code, 200)
        rows = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
        self.assertTrue(any(r["escalation_type"] == "patient_reply_overdue" for r in rows))
        self.assertTrue(
            CareNotification.objects.filter(
                consultation_case=case,
                notification_type="follow_up_reminder",
                channel="in_app",
            ).exists()
        )

    def test_overdue_awaiting_clinician_creates_escalation(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        ConsultationCase.objects.filter(id=case.id).update(
            status="awaiting_clinician",
            priority="high",
            last_activity_at=timezone.now() - timedelta(hours=5),
        )

        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/me/escalations/?type=clinician_response_overdue")
        self.assertEqual(res.status_code, 200)
        rows = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["severity"], "high")

    @override_settings(EMAIL_HOST_USER="noreply@example.com")
    @patch("clinician.notification_service.send_mail", side_effect=Exception("smtp down"))
    def test_failed_email_delivery_surfaces_in_staff_failure_queue(self, _send_mail):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Please respond."}, format="json")
        self.assertTrue(
            CareNotification.objects.filter(
                consultation_case=case,
                channel="email",
                status="failed",
            ).exists()
        )
        staff = User.objects.create_user(username="staff_failures", email="staff-fail@example.com", is_staff=True)
        self.client.force_authenticate(user=staff)
        failures = self.client.get("/api/clinician/internal/staff/notification-failures/")
        self.assertEqual(failures.status_code, 200)
        rows = failures.data.get("results", failures.data) if isinstance(failures.data, dict) else failures.data
        self.assertGreaterEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "failed")

    def test_clinician_can_acknowledge_and_resolve_escalation(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        ConsultationCase.objects.filter(id=case.id).update(
            status="awaiting_clinician",
            priority="high",
            last_activity_at=timezone.now() - timedelta(hours=5),
        )
        self.client.force_authenticate(user=self.clin_user)
        res = self.client.get("/api/clinician/me/escalations/?type=clinician_response_overdue")
        event_id = res.data["results"][0]["id"]
        ack = self.client.post(f"/api/clinician/me/escalations/{event_id}/action/", {"action": "acknowledge"}, format="json")
        self.assertEqual(ack.status_code, 200)
        self.assertEqual(ack.data["status"], "acknowledged")
        resolve = self.client.post(f"/api/clinician/me/escalations/{event_id}/action/", {"action": "resolve"}, format="json")
        self.assertEqual(resolve.status_code, 200)
        self.assertEqual(resolve.data["status"], "resolved")

    def test_staff_can_patch_orchestration_policy(self):
        staff = User.objects.create_user(username="staff_policy", email="staff-policy@example.com", is_staff=True)
        self.client.force_authenticate(user=staff)
        current = self.client.get("/api/clinician/internal/staff/orchestration-policy/")
        self.assertEqual(current.status_code, 200)
        patch_res = self.client.patch(
            "/api/clinician/internal/staff/orchestration-policy/",
            {
                "patient_reply_overdue_hours_high": 6,
                "clinician_response_overdue_hours_urgent": 2,
                "reminder_cooldown_hours": 12,
            },
            format="json",
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data["patient_reply_overdue_hours_high"], 6)
        self.assertEqual(patch_res.data["clinician_response_overdue_hours_urgent"], 2)
        self.assertEqual(patch_res.data["reminder_cooldown_hours"], 12)

    @override_settings(EMAIL_HOST_USER="noreply@example.com")
    @patch("clinician.notification_service.send_mail", side_effect=[Exception("smtp down"), 1])
    def test_staff_can_retry_failed_notification(self, _send_mail):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        self.client.force_authenticate(user=self.clin_user)
        self.client.post(f"/api/clinician/consultations/{case.id}/messages/", {"content": "Retry me."}, format="json")
        failed = CareNotification.objects.filter(consultation_case=case, channel="email", status="failed").latest("created_at")
        staff = User.objects.create_user(username="staff_retry", email="staff-retry@example.com", is_staff=True)
        self.client.force_authenticate(user=staff)
        retry_res = self.client.post(f"/api/clinician/internal/staff/notification-failures/{failed.id}/retry/")
        self.assertEqual(retry_res.status_code, 200)
        self.assertEqual(retry_res.data["status"], "sent")

    def test_management_command_evaluates_cases(self):
        PHQ9Screening.objects.create(
            patient=self.patient,
            q1_interest=3, q2_depressed=3, q3_sleep=3, q4_energy=3, q5_appetite=3, q6_self_esteem=3, q7_concentration=3, q8_psychomotor=3, q9_suicidal=0,
            total_score=0, severity_level="severe", risk_level="high"
        )
        case = ensure_consultation_case_for_assignment(self.clinician, self.patient)
        ConsultationCase.objects.filter(id=case.id).update(
            status="awaiting_patient",
            last_activity_at=timezone.now() - timedelta(hours=25),
        )
        out = StringIO()
        call_command("evaluate_care_orchestration", stdout=out)
        self.assertIn("Evaluated orchestration", out.getvalue())
        self.assertTrue(
            CareEscalationEvent.objects.filter(
                consultation_case=case,
                escalation_type="patient_reply_overdue",
            ).exists()
        )
