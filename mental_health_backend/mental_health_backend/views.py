"""
Root views for mental_health_backend project.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def root_view(request):
    """Simple root view to indicate the API server is running."""
    return JsonResponse({
        'message': 'MindEase API Server is running',
        'version': '1.0.0',
        'endpoints': {
            'admin': '/admin/',
            'api': {
                'screening': '/api/screening/',
                'selfcare': '/api/selfcare/',
                'clinician': '/api/clinician/',
            }
        },
        'status': 'healthy'
    })

