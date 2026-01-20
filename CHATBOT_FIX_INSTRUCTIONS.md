# Chatbot 404 Error - Fix Instructions

## Problem
The chatbot is showing "I'm sorry, I encountered an error" because the `/send-message/` endpoint returns 404.

## Root Cause
The URL route is correctly registered, but Django's development server needs a **full restart** (not just auto-reload) to pick up new ViewSet action methods.

## Solution

### Step 1: Stop the Server
1. In your terminal where the server is running, press `Ctrl+C` to stop both frontend and backend

### Step 2: Restart the Server
```bash
cd /Users/vishnu/amogh-major
./start_app.sh
```

### Step 3: Verify the Fix
1. Open http://localhost:3000/chatbot
2. Type a message (e.g., "Hello")
3. Press Enter or click Send
4. You should now get a response instead of an error!

## Technical Details

### What Was Fixed
- ✅ Changed URL path from `send_message/` to `send-message/` (hyphenated)
- ✅ Updated frontend to call `/send-message/` endpoint
- ✅ URL is properly registered in Django REST Framework router

### URL Structure
- **Backend Route**: `/api/screening/chatbot/conversations/{id}/send-message/`
- **Frontend Call**: `/screening/chatbot/conversations/{id}/send-message/`
- **Router Name**: `chatbot-conversations-send-message`

### Verification
You can verify the URL is registered by running:
```bash
cd mental_health_backend
source ../backend_env/bin/activate
python manage.py show_urls 2>/dev/null | grep send-message
```

Or check in Django shell:
```python
from django.urls import reverse
reverse('chatbot-conversations-send-message', kwargs={'pk': 1})
# Should return: '/api/screening/chatbot/conversations/1/send-message/'
```

## If Still Not Working

1. **Check Browser Console**: Open Developer Tools (F12) and check for any JavaScript errors
2. **Check Backend Logs**: Look for any error messages in the Django terminal
3. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. **Verify API Base URL**: Ensure `frontend/src/utils/api.ts` has correct base URL

## Additional Enhancements

The chatbot now also includes:
- ✅ Triage recommendation integration
- ✅ Context-aware responses based on PHQ-9/GAD-7 scores
- ✅ Emotion detection with NLP
- ✅ Crisis detection and alerts

## Support

If you continue to see errors after restarting, check:
1. Backend terminal for Django errors
2. Frontend terminal for React/TypeScript errors
3. Browser console for network errors




