"""
Intent Recognition Module for MindEase Chatbot

This module provides a simple interface for loading and using the trained
intent recognition model in the Django API.

Usage:
    from screening.intent_recognizer import IntentRecognizer
    
    recognizer = IntentRecognizer()
    intent_tag = recognizer.predict_intent("I need help finding self-care exercises")
"""

import os
import pickle
import json
import re
from typing import Optional, Dict, Tuple, Union

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer

# Ensure NLTK data is downloaded
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet', quiet=True)


class IntentRecognizer:
    """Intent recognition model wrapper for easy use in Django views"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize intent recognizer
        
        Args:
            model_path: Path to directory containing model files.
                       Defaults to current directory/screening/
        """
        if model_path is None:
            # Default to screening app directory
            model_path = os.path.join(os.path.dirname(__file__))
        
        self.model_path = model_path
        self.pipeline = None
        self.metadata = None
        self.preprocessor = self._create_preprocessor()
        
        # Load model and metadata
        self._load_model()
    
    def _create_preprocessor(self):
        """Create text preprocessor"""
        lemmatizer = WordNetLemmatizer()
        stop_words = set(stopwords.words('english'))
        stop_words = stop_words - {'feel', 'feeling', 'help', 'need', 'want', 'can', 'should'}
        
        return {
            'lemmatizer': lemmatizer,
            'stop_words': stop_words
        }
    
    def _preprocess(self, text: str) -> str:
        """Preprocess text (same as training)"""
        text = text.lower()
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        tokens = word_tokenize(text)
        tokens = [
            self.preprocessor['lemmatizer'].lemmatize(token)
            for token in tokens
            if token not in self.preprocessor['stop_words'] and len(token) > 2
        ]
        return ' '.join(tokens)
    
    def _load_model(self):
        """Load trained model and metadata"""
        model_file = os.path.join(self.model_path, 'intent_model.pkl')
        metadata_file = os.path.join(self.model_path, 'intent_metadata.json')
        
        if not os.path.exists(model_file):
            raise FileNotFoundError(
                f"Model file not found: {model_file}\n"
                f"Please run train_intent_model.py first to train the model."
            )
        
        try:
            with open(model_file, 'rb') as f:
                self.pipeline = pickle.load(f)
            
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
            else:
                self.metadata = {'classes': []}
            
            print(f"✅ Intent recognition model loaded from {model_file}")
            
        except Exception as e:
            raise RuntimeError(f"Error loading model: {e}")
    
    def predict_intent(self, text: str, return_confidence: bool = False) -> Union[str, Tuple[str, float]]:
        """
        Predict intent for a given text
        
        Args:
            text: Input text string
            return_confidence: If True, return (tag, confidence) tuple
            
        Returns:
            Intent tag string, or (tag, confidence) if return_confidence=True
        """
        if self.pipeline is None:
            raise RuntimeError("Model not loaded. Call _load_model() first.")
        
        if not text or not text.strip():
            return ("unknown", 0.0) if return_confidence else "unknown"
        
        # Preprocess
        preprocessed = self._preprocess(text)
        
        # Predict
        try:
            predicted_tag = self.pipeline.predict([preprocessed])[0]
            
            if return_confidence:
                # Get prediction probabilities
                if hasattr(self.pipeline.named_steps['classifier'], 'predict_proba'):
                    probabilities = self.pipeline.named_steps['classifier'].predict_proba(
                        self.pipeline.named_steps['tfidf'].transform([preprocessed])
                    )[0]
                    # Get confidence for predicted class
                    class_index = list(self.pipeline.named_steps['classifier'].classes_).index(predicted_tag)
                    confidence = float(probabilities[class_index])
                else:
                    # For SVM, use decision function as proxy for confidence
                    decision_scores = self.pipeline.named_steps['classifier'].decision_function(
                        self.pipeline.named_steps['tfidf'].transform([preprocessed])
                    )[0]
                    # Normalize decision scores to approximate probabilities
                    try:
                        from scipy.special import softmax
                        probabilities = softmax(decision_scores)
                        class_index = list(self.pipeline.named_steps['classifier'].classes_).index(predicted_tag)
                        confidence = float(probabilities[class_index])
                    except ImportError:
                        # Fallback: use max decision score normalized (if scipy not available)
                        max_score = max(decision_scores) if len(decision_scores) > 0 else 0
                        confidence = min(1.0, max(0.0, (max_score + 1) / 2))  # Rough normalization
                    except Exception:
                        # Fallback: use max decision score normalized
                        max_score = max(decision_scores) if len(decision_scores) > 0 else 0
                        confidence = min(1.0, max(0.0, (max_score + 1) / 2))  # Rough normalization
                
                return (predicted_tag, confidence)
            else:
                return predicted_tag
                
        except Exception as e:
            print(f"Warning: Error predicting intent: {e}")
            return ("unknown", 0.0) if return_confidence else "unknown"
    
    def get_available_intents(self) -> list:
        """Get list of all available intent tags"""
        if self.metadata and 'classes' in self.metadata:
            return self.metadata['classes']
        return []


# Convenience function for easy import
_recognizer_instance = None

# Default confidence threshold for out-of-scope detection
DEFAULT_CONFIDENCE_THRESHOLD = 0.6

def predict_intent(
    text: str, 
    return_confidence: bool = False,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> Union[str, Tuple[str, float]]:
    """
    Convenience function to predict intent (creates singleton recognizer)
    
    Args:
        text: Input text string
        return_confidence: If True, return (tag, confidence) tuple
        confidence_threshold: Minimum confidence to accept prediction (default: 0.6).
                              If confidence is below threshold, returns 'out_of_scope'
        
    Returns:
        Intent tag string, or (tag, confidence) if return_confidence=True.
        Returns 'out_of_scope' if confidence is below threshold.
        
    Example:
        >>> tag = predict_intent("I need help with self-care")
        >>> print(tag)
        'find_self_care'
        
        >>> tag, conf = predict_intent("Hello", return_confidence=True)
        >>> print(f"{tag} ({conf:.2%})")
        'greeting (0.95)'
        
        >>> # Low confidence prediction
        >>> tag = predict_intent("What's the weather?", confidence_threshold=0.6)
        >>> print(tag)
        'out_of_scope'
    """
    global _recognizer_instance
    
    if _recognizer_instance is None:
        try:
            _recognizer_instance = IntentRecognizer()
        except FileNotFoundError as e:
            print(f"Warning: {e}")
            print("Returning 'unknown' intent. Train model first with train_intent_model.py")
            return ("unknown", 0.0) if return_confidence else "unknown"
    
    result = _recognizer_instance.predict_intent(text, return_confidence)
    
    # Apply confidence threshold if confidence is returned
    if return_confidence:
        tag, confidence = result
        if confidence < confidence_threshold:
            tag = "out_of_scope"
        return (tag, confidence)
    else:
        # For non-confidence mode, we need to check confidence anyway
        # So we call with return_confidence=True internally
        tag, confidence = _recognizer_instance.predict_intent(text, return_confidence=True)
        if confidence < confidence_threshold:
            tag = "out_of_scope"
        return tag


if __name__ == '__main__':
    # Test the recognizer
    print("Testing Intent Recognizer...")
    print("=" * 50)
    
    try:
        recognizer = IntentRecognizer()
        
        test_phrases = [
            "Hello, how are you?",
            "I need help with self-care exercises",
            "Where can I find screening tests?",
            "I want to talk to someone",
            "Show me my dashboard"
        ]
        
        print("\nPredictions:")
        for phrase in test_phrases:
            tag, confidence = recognizer.predict_intent(phrase, return_confidence=True)
            print(f"  '{phrase}' -> {tag} ({confidence:.2%})")
        
    except FileNotFoundError as e:
        print(f"\n❌ {e}")
        print("\nPlease run train_intent_model.py first to train the model.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

