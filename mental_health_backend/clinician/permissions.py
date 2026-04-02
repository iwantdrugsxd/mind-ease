from rest_framework.permissions import BasePermission

from .models import Clinician


class IsApprovedClinician(BasePermission):
    """User must have a clinician profile that is not rejected (pending and approved may access)."""

    message = "Active clinician account required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        c = Clinician.objects.filter(user=request.user).first()
        return bool(c and c.status != Clinician.Status.REJECTED)
