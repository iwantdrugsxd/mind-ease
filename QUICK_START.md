# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start Servers

```bash
# From project root directory
./start_app.sh
```

This will:
- ✅ Start Django backend on http://localhost:8000
- ✅ Start React frontend on http://localhost:3000
- ✅ Run database migrations automatically

### Step 2: Test the Chatbot

1. Open http://localhost:3000
2. Log in (or use mock login)
3. Click "Chatbot" in the navigation
4. Try these test messages:
   - "Hello" → Bot greets you
   - "I feel sad today" → Bot detects sadness
   - "I'm very anxious" → Bot detects anxiety
   - "I want to kill myself" → Bot detects critical risk

### Step 3: Test Screening Integration

1. Go to http://localhost:3000/screening
2. Complete a PHQ-9 or GAD-7 screening
3. Results are automatically saved to the backend
4. Check http://localhost:8000/admin to verify data

## 📋 Quick Test Checklist

- [ ] Backend server running (port 8000)
- [ ] Frontend server running (port 3000)
- [ ] Can access chatbot page
- [ ] Can send messages in chatbot
- [ ] Emotion detection works (try "I feel sad")
- [ ] Screening saves to backend
- [ ] Can view screenings in Django admin

## 🔍 Verify Everything Works

### Check Backend API
```bash
curl http://localhost:8000/api/screening/screening-summary/
```

### Check Frontend
- Open browser console (F12)
- Look for any errors
- Network tab should show API calls

### Check Database
```bash
cd mental_health_backend
source ../backend_env/bin/activate
python manage.py shell

# In shell:
>>> from screening.models import ChatbotConversation, PHQ9Screening
>>> ChatbotConversation.objects.count()
>>> PHQ9Screening.objects.count()
```

## ⚠️ Common Issues & Fixes

### Issue: "CORS error" or "Network error"
**Fix**: Make sure backend is running on port 8000
```bash
cd mental_health_backend
source ../backend_env/bin/activate
python manage.py runserver 8000
```

### Issue: "Authentication required"
**Fix**: The frontend uses Firebase auth, but backend uses Django sessions. For now:
- Use mock login (it's already set up)
- Or configure Django to accept Firebase tokens

### Issue: "Chatbot not loading"
**Fix**: Check browser console for errors
- Verify API endpoint is correct
- Check network requests in DevTools

### Issue: "Screening not saving"
**Fix**: 
- Check backend logs for errors
- Verify patient model exists
- Check database migrations: `python manage.py migrate`

## 🎯 What to Test

### 1. Chatbot Features
- ✅ Send messages
- ✅ Receive bot responses
- ✅ Emotion detection (sad, anxious, happy)
- ✅ Risk detection (critical keywords)
- ✅ Message history

### 2. Screening Features
- ✅ PHQ-9 screening
- ✅ GAD-7 screening
- ✅ Results calculation
- ✅ Backend API integration
- ✅ Data persistence

### 3. NLP Features
- ✅ Emotion keyword detection
- ✅ Risk level assessment
- ✅ Intensity modifiers
- ✅ Critical keyword detection

## 📊 Expected Results

### Chatbot
- Messages are analyzed for emotions
- Bot responds based on detected emotion
- Critical risks trigger alerts
- Messages are saved to database

### Screening
- Results calculated correctly
- Data saved to database
- Triage engine processes results
- Alerts created for high-risk scores

### NLP
- Detects: sad, anxious, angry, happy, neutral
- Identifies critical keywords
- Assesses risk levels correctly

## 🔧 Next Development Steps

1. **Improve Authentication**
   - Integrate Firebase auth with Django
   - Add JWT token support
   - Secure API endpoints

2. **Enhance NLP**
   - Add more emotion keywords
   - Improve accuracy
   - Add context awareness

3. **Better Chatbot Responses**
   - More personalized responses
   - Conversation memory
   - Multi-turn conversations

4. **UI Improvements**
   - Better error messages
   - Loading states
   - Responsive design

## 📝 Notes

- **Development Mode**: Currently using SQLite database
- **Authentication**: Mock auth is enabled for development
- **CORS**: Configured for localhost:3000
- **API Base URL**: http://localhost:8000/api (configurable via env)

---

**Ready to test!** 🎉

Start the servers and begin testing the new features.




