# AI Triage Engine Implementation

## Overview

The MindCare Triage Engine is a **deterministic Rule Engine** (NOT a machine learning model) based on clinically validated screening tools (PHQ-9 and GAD-7). This aligns with the "Clinical-Adjunct" model methodology.

## Architecture

### Core Components

1. **TriageService** (`screening/triage_service.py`)
   - `calculatePHQ9(answers)` - Calculates PHQ-9 score and severity
   - `calculateGAD7(answers)` - Calculates GAD-7 score and severity
   - `processTriage(patient_id, survey_type, score, severity_level)` - Applies escalation rules
   - `get_comprehensive_assessment()` - Overall risk evaluation

2. **Survey Endpoints** (`screening/survey_views.py`)
   - `POST /api/screening/surveys/submit/phq9/`
   - `POST /api/screening/surveys/submit/gad7/`

3. **Enhanced Chatbot** (`screening/views.py`)
   - Integrates triage recommendations into responses
   - Uses patient's screening history for context-aware support

## Triage Rules (Escalation Logic)

### Rule 1: Teleconsult Referral
- **Trigger**: PHQ-9 score >= 15 OR GAD-7 score >= 15
- **Action**: Create `TeleconsultReferral` with priority 'high'
- **Response**: `triageAction: "TriggerReferral"`

### Rule 2: Clinician Alert
- **Trigger**: Change in PHQ-9 score >= 5 within 2 weeks
- **Action**: Create `ScreeningAlert` with type 'score_increase'
- **Response**: `triageAction: "TriggerClinicianAlert"`

### Rule 3: Self-Care Recommendation
- **Trigger**: Mild to moderate symptoms (score < 15)
- **Action**: Recommend specific self-care module based on severity
- **Response**: `triageAction: "RecommendSelfCare"`, `recommendedModule: "4-7-8 Breathing"`

## API Endpoints

### POST /api/screening/surveys/submit/phq9

**Request:**
```json
{
  "answers": [0, 1, 2, 1, 0, 2, 1, 0, 1],  // 9 answers (0-3 each)
  "firebase_uid": "optional-firebase-uid"
}
```

**Response:**
```json
{
  "totalScore": 8,
  "severityLevel": "Mild",
  "severityCode": "mild",
  "triageAction": "RecommendSelfCare",
  "recommendedModule": "Mindfulness Meditation",
  "screeningId": 123,
  "message": "Based on your assessment, we recommend trying: Mindfulness Meditation. This can help manage your symptoms."
}
```

### POST /api/screening/surveys/submit/gad7

**Request:**
```json
{
  "answers": [0, 1, 2, 1, 0, 2, 1],  // 7 answers (0-3 each)
  "firebase_uid": "optional-firebase-uid"
}
```

**Response:**
```json
{
  "totalScore": 7,
  "severityLevel": "Mild",
  "severityCode": "mild",
  "triageAction": "RecommendSelfCare",
  "recommendedModule": "4-7-8 Breathing",
  "screeningId": 124,
  "message": "Based on your assessment, we recommend trying: 4-7-8 Breathing. This can help manage your symptoms."
}
```

## Severity Levels

### PHQ-9 (Depression)
- **Minimal**: 0-4
- **Mild**: 5-9
- **Moderate**: 10-14
- **Moderately Severe**: 15-19
- **Severe**: 20-27

### GAD-7 (Anxiety)
- **Minimal**: 0-4
- **Mild**: 5-9
- **Moderate**: 10-14
- **Severe**: 15-21

## Self-Care Recommendations

Based on severity and survey type:

| Severity | Survey Type | Recommended Module |
|----------|-------------|-------------------|
| Minimal/Mild | GAD-7 | 4-7-8 Breathing |
| Minimal/Mild | PHQ-9 | Mindfulness Meditation |
| Moderate | GAD-7 | Progressive Muscle Relaxation |
| Moderate | PHQ-9 | Journaling and Gratitude |
| Severe | Any | Guided Relaxation Exercises |

## Integration with Chatbot

The chatbot now:
1. Retrieves patient's latest PHQ-9/GAD-7 scores
2. Gets triage recommendations from TriageService
3. Incorporates recommendations into responses
4. Provides context-aware support based on screening history

**Example:**
- User: "I'm feeling anxious"
- Bot: "I hear that you're feeling anxious. That can be really challenging. I'd recommend trying: 4-7-8 Breathing. Or would you prefer to talk about what's causing your anxiety?"

## Testing

### Test PHQ-9 Submission
```bash
curl -X POST http://localhost:8000/api/screening/surveys/submit/phq9/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "answers": [2, 2, 2, 2, 1, 2, 2, 1, 0]
  }'
```

### Test GAD-7 Submission
```bash
curl -X POST http://localhost:8000/api/screening/surveys/submit/gad7/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "answers": [2, 2, 2, 1, 2, 2, 1]
  }'
```

## Files Created/Modified

1. **New Files:**
   - `screening/triage_service.py` - Core TriageService module
   - `screening/survey_views.py` - New survey endpoints

2. **Modified Files:**
   - `screening/views.py` - Enhanced chatbot with triage integration
   - `screening/urls.py` - Added survey routes
   - `frontend/src/pages/Chatbot.tsx` - Fixed URL path

## Next Steps

1. ✅ Triage Engine implemented
2. ✅ Survey endpoints created
3. ✅ Chatbot integrated with triage
4. ⏳ Frontend integration for new survey endpoints
5. ⏳ Self-care pathway recommendations
6. ⏳ Clinician dashboard updates

## Key Principles

- **Deterministic**: Results are always the same for same inputs
- **Transparent**: Rules are explicit and auditable
- **Safety-First**: Critical risks trigger immediate alerts
- **Clinical Guidelines**: Based on validated PHQ-9/GAD-7 protocols
- **Human-in-Loop**: Escalates to clinicians, doesn't replace them




