# Intent Recognition Model for MindEase Chatbot

This directory contains the intent recognition model for the MindEase chatbot. The model is a simple, fast scikit-learn-based classifier that helps navigate users through the app.

## Quick Start

### 1. Install Dependencies

```bash
cd mental_health_backend
source ../backend_env/bin/activate
pip install scikit-learn nltk scipy
```

### 2. Train the Model

```bash
python screening/train_intent_model.py
```

This will:
- Load intents from `intents.json`
- Preprocess the text patterns
- Train a Multinomial Naive Bayes classifier
- Save the model to `screening/intent_model.pkl`
- Save the vectorizer to `screening/intent_vectorizer.pkl`
- Save metadata to `screening/intent_metadata.json`

### 3. Use in Django Views

```python
from screening.intent_recognizer import predict_intent

# Simple prediction
intent_tag = predict_intent("I need help with self-care")
print(intent_tag)  # Output: "find_self_care"

# With confidence score
tag, confidence = predict_intent("Hello there", return_confidence=True)
print(f"{tag} ({confidence:.2%})")  # Output: "greeting (0.95)"
```

## File Structure

- `train_intent_model.py` - Training script
- `intent_recognizer.py` - Prediction module for Django
- `intent_model.pkl` - Trained model (generated after training)
- `intent_vectorizer.pkl` - TF-IDF vectorizer (generated after training)
- `intent_metadata.json` - Model metadata (generated after training)
- `intents.json` - Training data (in project root)

## Intent Tags

The model recognizes these intents:

- `greeting` - Hello, hi, hey
- `find_screening` - Access to PHQ-9/GAD-7 tests
- `find_self_care` - Self-care exercises and activities
- `view_dashboard` - User dashboard and progress
- `need_help` - General help requests
- `crisis` - Emergency situations (triggers immediate response)
- `goodbye` - Farewell messages
- `thanks` - Gratitude expressions
- `unknown` - Unrecognized intents

## Model Details

- **Algorithm**: Multinomial Naive Bayes (fast and reliable)
- **Features**: TF-IDF with unigrams and bigrams
- **Preprocessing**: Lowercase, tokenization, lemmatization, stopword removal
- **Max Features**: 5000

## Integration with Chatbot

The intent recognizer can be integrated into the chatbot's response generation:

```python
from screening.intent_recognizer import predict_intent
from screening.views import ChatbotConversationViewSet

def _generate_bot_response(self, user_message, emotion, risk_level, risk_keywords, triage_recommendation=None):
    # Get intent
    intent_tag, confidence = predict_intent(user_message, return_confidence=True)
    
    # Route based on intent
    if intent_tag == "find_screening":
        return "You can take a screening test in the Screening section. Would you like to start?"
    elif intent_tag == "find_self_care":
        return "Check out the Self-Care section for exercises. Would you like to explore it?"
    # ... etc
```

## Retraining

To retrain the model with new intents:

1. Update `intents.json` with new patterns
2. Run `python screening/train_intent_model.py`
3. The new model will automatically be used by the recognizer

## Performance

- **Training Time**: ~1-2 seconds for typical datasets
- **Prediction Time**: <1ms per query
- **Accuracy**: Typically 85-95% depending on data quality

## Notes

- The model is lightweight and fast, perfect for real-time chatbot interactions
- The core triage logic (PHQ-9/GAD-7 scoring) is handled separately by the Rule Engine
- This model is only for navigation and intent recognition, not for clinical assessment




