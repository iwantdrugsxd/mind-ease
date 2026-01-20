from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import timedelta, date
from .models import (Clinician, PatientAssignment, ClinicianDashboard, PatientTrend,
                    Appointment, TreatmentPlan, ClinicalNote, AlertResponse)
from .serializers import (ClinicianSerializer, PatientAssignmentSerializer,
                         ClinicianDashboardSerializer, PatientTrendSerializer,
                         AppointmentSerializer, TreatmentPlanSerializer,
                         ClinicalNoteSerializer, AlertResponseSerializer,
                         PatientSummarySerializer, DashboardStatsSerializer)
from screening.models import Patient, ScreeningAlert


class ClinicianViewSet(viewsets.ModelViewSet):
    queryset = Clinician.objects.all()
    serializer_class = ClinicianSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Clinician.objects.filter(user=self.request.user)


class PatientAssignmentViewSet(viewsets.ModelViewSet):
    queryset = PatientAssignment.objects.all()
    serializer_class = PatientAssignmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        return PatientAssignment.objects.filter(clinician=clinician, is_active=True)


class ClinicianDashboardViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ClinicianDashboard.objects.all()
    serializer_class = ClinicianDashboardSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        return ClinicianDashboard.objects.filter(clinician=clinician)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get dashboard statistics for the clinician"""
        try:
            clinician = Clinician.objects.get(user=request.user)
            assigned_patients = PatientAssignment.objects.filter(
                clinician=clinician, is_active=True
            ).values_list('patient', flat=True)
            
            # Get today's date
            today = date.today()
            
            # Basic stats
            total_patients = len(assigned_patients)
            high_risk_patients = PatientTrend.objects.filter(
                patient__in=assigned_patients,
                risk_level__in=['high', 'critical']
            ).values('patient').distinct().count()
            
            # New screenings today
            new_screenings_today = 0  # Would query PHQ9Screening and GAD7Screening
            
            # Pending alerts
            alerts_pending = ScreeningAlert.objects.filter(
                patient__in=assigned_patients,
                is_resolved=False
            ).count()
            
            # Appointments today
            appointments_today = Appointment.objects.filter(
                clinician=clinician,
                scheduled_date__date=today
            ).count()
            
            # Risk distribution
            risk_distribution = {
                'low': PatientTrend.objects.filter(
                    patient__in=assigned_patients,
                    risk_level='low'
                ).count(),
                'medium': PatientTrend.objects.filter(
                    patient__in=assigned_patients,
                    risk_level='medium'
                ).count(),
                'high': PatientTrend.objects.filter(
                    patient__in=assigned_patients,
                    risk_level='high'
                ).count(),
                'critical': PatientTrend.objects.filter(
                    patient__in=assigned_patients,
                    risk_level='critical'
                ).count(),
            }
            
            stats = {
                'total_patients': total_patients,
                'high_risk_patients': high_risk_patients,
                'new_screenings_today': new_screenings_today,
                'alerts_pending': alerts_pending,
                'appointments_today': appointments_today,
                'risk_distribution': risk_distribution,
                'screening_trends': {}  # Would calculate actual trends
            }
            
            return Response(stats)
            
        except Clinician.DoesNotExist:
            return Response({'error': 'Clinician not found'}, status=status.HTTP_404_NOT_FOUND)


class PatientTrendViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PatientTrend.objects.all()
    serializer_class = PatientTrendSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        assigned_patients = PatientAssignment.objects.filter(
            clinician=clinician, is_active=True
        ).values_list('patient', flat=True)
        return PatientTrend.objects.filter(patient__in=assigned_patients)
    
    @action(detail=False, methods=['get'])
    def by_patient(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        trends = self.get_queryset().filter(patient_id=patient_id).order_by('date')
        serializer = self.get_serializer(trends, many=True)
        return Response(serializer.data)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        return Appointment.objects.filter(clinician=clinician)
    
    def perform_create(self, serializer):
        clinician = Clinician.objects.get(user=self.request.user)
        serializer.save(clinician=clinician)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.now().date()
        appointments = self.get_queryset().filter(scheduled_date__date=today)
        serializer = self.get_serializer(appointments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        appointment = self.get_object()
        appointment.status = 'completed'
        appointment.completed_at = timezone.now()
        appointment.clinician_notes = request.data.get('clinician_notes', '')
        appointment.save()
        return Response({'message': 'Appointment completed successfully'})


class TreatmentPlanViewSet(viewsets.ModelViewSet):
    queryset = TreatmentPlan.objects.all()
    serializer_class = TreatmentPlanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        assigned_patients = PatientAssignment.objects.filter(
            clinician=clinician, is_active=True
        ).values_list('patient', flat=True)
        return TreatmentPlan.objects.filter(patient__in=assigned_patients)
    
    def perform_create(self, serializer):
        clinician = Clinician.objects.get(user=self.request.user)
        serializer.save(clinician=clinician)


class ClinicalNoteViewSet(viewsets.ModelViewSet):
    queryset = ClinicalNote.objects.all()
    serializer_class = ClinicalNoteSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        assigned_patients = PatientAssignment.objects.filter(
            clinician=clinician, is_active=True
        ).values_list('patient', flat=True)
        return ClinicalNote.objects.filter(patient__in=assigned_patients)
    
    def perform_create(self, serializer):
        clinician = Clinician.objects.get(user=self.request.user)
        serializer.save(clinician=clinician)


class AlertResponseViewSet(viewsets.ModelViewSet):
    queryset = AlertResponse.objects.all()
    serializer_class = AlertResponseSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        clinician = Clinician.objects.get(user=self.request.user)
        assigned_patients = PatientAssignment.objects.filter(
            clinician=clinician, is_active=True
        ).values_list('patient', flat=True)
        alerts = ScreeningAlert.objects.filter(patient__in=assigned_patients)
        return AlertResponse.objects.filter(alert__in=alerts)
    
    def perform_create(self, serializer):
        clinician = Clinician.objects.get(user=self.request.user)
        serializer.save(clinician=clinician)
        
        # Mark alert as resolved
        alert = serializer.instance.alert
        alert.is_resolved = True
        alert.resolved_at = timezone.now()
        alert.save()