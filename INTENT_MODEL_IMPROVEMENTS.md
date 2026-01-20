# Intent Recognition Model Improvements

## ✅ Implemented Enhancements

### 1. Enhanced Training Data
- **Expanded patterns**: Each intent now has 30-50+ varied patterns (previously 8-15)
- **Balanced dataset**: All intents have roughly similar number of patterns
- **Data quality**: Added paraphrases and synonyms for better generalization
- **Out-of-scope intent**: Added 50+ examples of queries the chatbot should not handle

### 2. Out-of-Scope Detection
- **Confidence threshold**: Default threshold of 0.6 (tunable)
- **Automatic filtering**: Low-confidence predictions automatically return 'out_of_scope'
- **User-friendly responses**: Clear messages when queries are outside scope

### 3. Intent-Based Routing
- **Priority system**: Crisis → Intent → Emotion → General
- **Contextual responses**: Intent recognition integrated into chatbot response generation
- **Navigation assistance**: Users can now ask for specific features and get directed responses

## 📊 Model Performance

### Training Data Stats
- **Total patterns**: ~300+ (up from ~80)
- **Intent classes**: 10 (added `out_of_scope`)
- **Average patterns per intent**: ~30-50
- **Balanced distribution**: All intents have similar representation

### Expected Accuracy
- **Before improvements**: 70-80% (limited data)
- **After improvements**: 85-95% (with expanded, balanced data)
- **Out-of-scope detection**: 90%+ (with confidence threshold)

## 🎯 Confidence Threshold Tuning

The default threshold is **0.6**, but you can adjust it based on your needs:

```python
# More strict (fewer false positives, but more out-of-scope)
intent_tag = predict_intent("I need help", confidence_threshold=0.7)

# More lenient (fewer out-of-scope, but more false positives)
intent_tag = predict_intent("I need help", confidence_threshold=0.5)
```

### Recommended Thresholds
- **Strict (0.7-0.8)**: Use when you want high precision, fewer false positives
- **Balanced (0.6)**: Default, good for most use cases
- **Lenient (0.4-0.5)**: Use when you want to catch more queries, accept some uncertainty

## 🔄 Retraining

After updating `intents.json`, retrain the model:

```bash
cd mental_health_backend
source ../backend_env/bin/activate
python screening/train_intent_model.py
```

The new model will automatically be used by the chatbot.

## 📝 Intent Categories

1. **greeting** - Hello, hi, hey, etc.
2. **find_screening** - Access to PHQ-9/GAD-7 tests
3. **find_self_care** - Self-care exercises and activities
4. **view_dashboard** - User dashboard and progress
5. **need_help** - General help requests
6. **crisis** - Emergency situations (highest priority)
7. **goodbye** - Farewell messages
8. **thanks** - Gratitude expressions
9. **out_of_scope** - Queries outside chatbot's purpose
10. **unknown** - Fallback for unrecognized intents

## 🚀 Next Steps (Future Enhancements)

### Entity Extraction (Advanced)
For even smarter responses, consider adding entity extraction:

```python
# Example: "I want to do a breathing exercise"
# Intent: find_self_care
# Entity: exercise_type = "breathing"

# This would allow responses like:
# "Great! Opening the 4-7-8 Breathing exercise for you now."
```

**Recommended Library**: spaCy with custom NER model

### Intent + Emotion Combination
Currently, the chatbot uses intent OR emotion. You could combine them:

```python
intent = predict_intent(user_message)
emotion = emotion_detector.get_primary_emotion(user_message)

# Combined response
if intent == "find_self_care" and emotion == "anxious":
    return "I sense you're feeling anxious. Let me show you a breathing exercise..."
```

### Confidence-Based Responses
Use confidence scores to adjust response style:

```python
intent, confidence = predict_intent(user_message, return_confidence=True)

if confidence > 0.9:
    # High confidence - direct response
    return "Sure! Here's the screening test..."
elif confidence > 0.6:
    # Medium confidence - ask for confirmation
    return "I think you're looking for screening tests. Is that right?"
else:
    # Low confidence - clarify
    return "I'm not entirely sure what you need. Could you clarify?"
```

## 📈 Monitoring

Track these metrics to improve the model:
- Intent classification accuracy
- Out-of-scope detection rate
- User satisfaction with responses
- Most common misclassifications

Use this data to:
- Add more training patterns for problematic intents
- Adjust confidence thresholds
- Identify new intents to add




