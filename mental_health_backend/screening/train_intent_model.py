"""
Intent Recognition Model Training Script for MindEase Chatbot

This script trains a simple, fast intent recognition model using scikit-learn.
The model is trained on patterns from intents.json and saved for use in the Django API.

Usage:
    python train_intent_model.py

Requirements:
    - intents.json file in the same directory
    - nltk, sklearn, pickle libraries
"""

import json
import pickle
import os
import re
from typing import List, Tuple, Dict

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import SGDClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Download required NLTK data (only if not already downloaded)
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


class IntentPreprocessor:
    """Text preprocessing for intent recognition"""
    
    def __init__(self):
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        # Add common mental health terms that shouldn't be removed
        self.stop_words = self.stop_words - {'feel', 'feeling', 'help', 'need', 'want', 'can', 'should'}
    
    def preprocess(self, text: str) -> str:
        """
        Preprocess text: lowercase, tokenize, lemmatize, remove stopwords
        
        Args:
            text: Input text string
            
        Returns:
            Preprocessed text string
        """
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep spaces and basic punctuation
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        
        # Tokenize
        tokens = word_tokenize(text)
        
        # Lemmatize and remove stopwords
        tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token not in self.stop_words and len(token) > 2
        ]
        
        return ' '.join(tokens)


def load_intents(json_path: str = 'intents.json') -> Tuple[List[str], List[str]]:
    """
    Load intents from JSON file
    
    Args:
        json_path: Path to intents.json file
        
    Returns:
        Tuple of (patterns, tags) lists
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Intents file not found: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    patterns = []
    tags = []
    
    for intent in data.get('intents', []):
        tag = intent.get('tag', '')
        pattern_list = intent.get('patterns', [])
        
        for pattern in pattern_list:
            patterns.append(pattern)
            tags.append(tag)
    
    if not patterns:
        raise ValueError("No intents found in JSON file")
    
    print(f"✅ Loaded {len(patterns)} patterns for {len(set(tags))} intent classes")
    return patterns, tags


def train_intent_model(
    patterns: List[str],
    tags: List[str],
    model_type: str = 'nb',
    test_size: float = 0.2,
    save_path: str = 'mental_health_backend/screening'
) -> Tuple[Pipeline, Dict]:
    """
    Train intent recognition model
    
    Args:
        patterns: List of text patterns
        tags: List of corresponding intent tags
        model_type: 'nb' for Naive Bayes, 'svm' for LinearSVC
        test_size: Proportion of data for testing
        save_path: Directory to save model files
        
    Returns:
        Tuple of (trained_pipeline, metadata_dict)
    """
    print(f"\n🔄 Preprocessing {len(patterns)} patterns...")
    preprocessor = IntentPreprocessor()
    preprocessed_patterns = [preprocessor.preprocess(pattern) for pattern in patterns]
    
    print(f"📊 Splitting data: {int(len(patterns) * (1 - test_size))} train, {int(len(patterns) * test_size)} test")
    X_train, X_test, y_train, y_test = train_test_split(
        preprocessed_patterns, tags, test_size=test_size, random_state=42, stratify=tags
    )
    
    # Create pipeline
    print(f"🔧 Building {model_type.upper()} pipeline...")
    
    if model_type == 'nb':
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),  # Include unigrams and bigrams
                min_df=1,  # Minimum document frequency
                max_df=0.95,  # Maximum document frequency
                sublinear_tf=True  # Apply sublinear tf scaling
            )),
            ('classifier', MultinomialNB(alpha=0.1))
        ])
    else:  # svm
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.95,
                sublinear_tf=True
            )),
            ('classifier', SGDClassifier(
                loss='hinge',
                penalty='l2',
                alpha=1e-3,
                max_iter=1000,
                random_state=42
            ))
        ])
    
    print("🚀 Training model...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    print("📈 Evaluating model...")
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n✅ Model trained successfully!")
    print(f"   Accuracy: {accuracy:.2%}")
    print(f"\n📋 Classification Report:")
    print(classification_report(y_test, y_pred))
    
    # Create metadata
    metadata = {
        'model_type': model_type,
        'accuracy': float(accuracy),
        'num_classes': len(set(tags)),
        'num_patterns': len(patterns),
        'classes': sorted(list(set(tags)))
    }
    
    # Save model and vectorizer
    os.makedirs(save_path, exist_ok=True)
    
    model_file = os.path.join(save_path, 'intent_model.pkl')
    vectorizer_file = os.path.join(save_path, 'intent_vectorizer.pkl')
    metadata_file = os.path.join(save_path, 'intent_metadata.json')
    
    print(f"\n💾 Saving model to {model_file}...")
    with open(model_file, 'wb') as f:
        pickle.dump(pipeline, f)
    
    # Also save just the vectorizer for convenience
    print(f"💾 Saving vectorizer to {vectorizer_file}...")
    with open(vectorizer_file, 'wb') as f:
        pickle.dump(pipeline.named_steps['tfidf'], f)
    
    # Save metadata
    print(f"💾 Saving metadata to {metadata_file}...")
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✅ All files saved successfully!")
    
    return pipeline, metadata


def main():
    """Main training function"""
    print("=" * 60)
    print("MindEase Intent Recognition Model Training")
    print("=" * 60)
    
    # Load intents
    try:
        # Try multiple possible locations for intents.json
        intents_paths = [
            'intents.json',
            'mental_health_backend/screening/intents.json',
            '../intents.json'
        ]
        
        intents_path = None
        for path in intents_paths:
            if os.path.exists(path):
                intents_path = path
                break
        
        if not intents_path:
            print("\n❌ Error: intents.json not found in any of these locations:")
            for path in intents_paths:
                print(f"   - {path}")
            print("\nPlease create intents.json with the following structure:")
            print("""
{
  "intents": [
    {
      "tag": "greeting",
      "patterns": ["hello", "hi", "hey"],
      "responses": ["Hello! How can I help you?"]
    }
  ]
}
            """)
            return
        
        patterns, tags = load_intents(intents_path)
        
    except Exception as e:
        print(f"\n❌ Error loading intents: {e}")
        return
    
    # Train model (try NB first, fallback to SVM if needed)
    try:
        pipeline, metadata = train_intent_model(
            patterns=patterns,
            tags=tags,
            model_type='nb',  # Use Naive Bayes for speed
            test_size=0.2,
            save_path='mental_health_backend/screening'
        )
        
        print("\n" + "=" * 60)
        print("✅ Training completed successfully!")
        print("=" * 60)
        print(f"\n📁 Model files saved in: mental_health_backend/screening/")
        print(f"   - intent_model.pkl (full pipeline)")
        print(f"   - intent_vectorizer.pkl (vectorizer only)")
        print(f"   - intent_metadata.json (model info)")
        print(f"\n💡 Use predict_intent(text) from intent_recognizer.py to make predictions")
        
    except Exception as e:
        print(f"\n❌ Error training model: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == '__main__':
    main()




