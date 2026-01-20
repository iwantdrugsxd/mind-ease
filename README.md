# MindEase - AI-Powered Mental Health Platform

A comprehensive mental health platform that combines AI-powered screening, personalized self-care pathways, and seamless integration with healthcare providers.

## Features

### 🔍 **Triage & Escalation Engine**
- PHQ-9 and GAD-7 screening tools
- Automated risk assessment and scoring
- Intelligent escalation rules:
  - PHQ-9 ≥15 → Teleconsult referral
  - Δ PHQ-9 ≥5 in 2 weeks → Clinician alert
  - Crisis shortcut: "Call 988"

### 👩‍⚕️ **Clinician Dashboard**
- De-identified mood trends and risk levels
- Real-time alerts and notifications
- Patient assignment and management
- FHIR integration for EHR systems

### 🧘 **Self-Care Pathways**
- Interactive exercises based on symptom patterns
- Personalized recommendations
- Progress tracking and analytics
- Exercise types: Breathing, journaling, mindfulness, physical activity

### 🤝 **Human-In-Loop Support**
- Weekly coach check-ins
- Progress reviews and motivational outreach
- Reduces AI dependency, reinforces human connection

## Tech Stack

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Firebase** for authentication
- **Recharts** for data visualization

### Backend
- **Django** with Django REST Framework
- **PostgreSQL** (or SQLite for development)
- **Firebase** for real-time database
- **Celery** for background tasks
- **Twilio** for SMS notifications

### AI & Analytics
- **Rule Engine** for PHQ-9/GAD-7 logic
- **Triage Engine** for risk assessment
- **Trend Analysis** for patient monitoring

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+
- PostgreSQL (optional, SQLite works for development)
- Firebase project
- Twilio account (for SMS notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd amogh-major
   ```

2. **Backend Setup**
   ```bash
   cd mental_health_backend
   python -m venv backend_env
   source backend_env/bin/activate  # On Windows: backend_env\Scripts\activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Environment Configuration**
   - **Firebase Setup**: See [Firebase Quick Start Guide](FIREBASE_QUICK_START.md) for 5-minute setup or [Complete Firebase Setup Guide](FIREBASE_COMPLETE_SETUP_GUIDE.md) for detailed instructions
   - Copy `.env.example` to `.env` in frontend directory
   - Configure Firebase credentials in `frontend/.env`
   - Configure Twilio and email settings in backend if needed

### Database Models

#### Patient Management
- `Patient`: User profile and basic information
- `PHQ9Screening`: Depression screening results
- `GAD7Screening`: Anxiety screening results
- `ScreeningAlert`: Automated alerts and notifications

#### Self-Care System
- `SelfCareExercise`: Individual exercises and activities
- `SelfCarePathway`: Curated exercise sequences
- `PatientSelfCareProgress`: User progress tracking
- `MoodEntry`: Daily mood and wellness logging

#### Clinician Tools
- `Clinician`: Healthcare provider profiles
- `PatientAssignment`: Patient-clinician relationships
- `Appointment`: Scheduling and management
- `ClinicalNote`: Treatment documentation

## API Endpoints

### Screening API (`/api/screening/`)
- `GET /patients/` - Get patient profile
- `POST /phq9-screenings/` - Submit PHQ-9 screening
- `POST /gad7-screenings/` - Submit GAD-7 screening
- `GET /alerts/` - Get screening alerts
- `GET /screening-summary/` - Get screening summary

### Self-Care API (`/api/selfcare/`)
- `GET /exercises/` - Get available exercises
- `GET /pathways/` - Get self-care pathways
- `POST /completions/` - Log exercise completion
- `POST /mood-entries/` - Log mood entry
- `GET /progress/` - Get user progress

### Clinician API (`/api/clinician/`)
- `GET /dashboard/stats/` - Get dashboard statistics
- `GET /patient-trends/` - Get patient trend data
- `GET /appointments/` - Get appointments
- `POST /clinical-notes/` - Create clinical notes

## Triage Engine Logic

The triage engine automatically processes screening results and triggers appropriate actions:

### PHQ-9 Scoring
- 0-4: Minimal depression
- 5-9: Mild depression
- 10-14: Moderate depression
- 15-19: Moderately severe depression
- 20-27: Severe depression

### GAD-7 Scoring
- 0-4: Minimal anxiety
- 5-9: Mild anxiety
- 10-14: Moderate anxiety
- 15-21: Severe anxiety

### Risk Assessment
- **Critical**: PHQ-9 ≥15 OR GAD-7 ≥15 OR suicidal ideation
- **High**: PHQ-9 ≥10 OR GAD-7 ≥10
- **Medium**: PHQ-9 ≥5 OR GAD-7 ≥5
- **Low**: Below threshold scores

## Deployment

### Backend Deployment
1. Set up production database
2. Configure environment variables
3. Run migrations: `python manage.py migrate`
4. Collect static files: `python manage.py collectstatic`
5. Deploy with Gunicorn or similar WSGI server

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Deploy to Netlify, Vercel, or similar platform
3. Configure environment variables

### Firebase Setup

**Quick Start (5 minutes):**
- See [Firebase Quick Start Guide](FIREBASE_QUICK_START.md)

**Complete Setup Guide:**
- See [Complete Firebase Setup Guide](FIREBASE_COMPLETE_SETUP_GUIDE.md) for:
  - Step-by-step project creation
  - Authentication setup
  - API key configuration
  - Firestore database setup
  - Security rules
  - Troubleshooting

**Key Steps:**
1. Create Firebase project at https://console.firebase.google.com/
2. Register web app and copy configuration values
3. Enable Email/Password authentication
4. Configure API key restrictions (allow localhost for development)
5. Create `frontend/.env` file with Firebase credentials
6. Restart development server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Project Timeline

For detailed information about the development progress and milestones, see [PROJECT_TIMELINE.md](PROJECT_TIMELINE.md).

## Crisis Resources

If you or someone you know is in crisis:
- **Crisis Hotline**: 988
- **Text HOME to**: 741741
- **Emergency**: 911

---

**Note**: This is a demonstration project. For production use, ensure proper security measures, HIPAA compliance, and clinical validation of all screening tools.






