"""
Basic NLP utilities for emotion detection
Implements simple keyword-based emotion detection for initial phase
"""
import re
from typing import Dict, List, Tuple


class EmotionDetector:
    """
    Basic emotion detector using keyword matching and sentiment analysis
    This is the initial phase implementation as mentioned in Week 10
    """
    
    # Emotion keywords dictionary
    EMOTION_KEYWORDS = {
        'sad': ['sad', 'depressed', 'down', 'unhappy', 'miserable', 'hopeless', 'empty', 'worthless'],
        'anxious': ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'fear', 'afraid', 'tense'],
        'angry': ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'frustrated', 'rage'],
        'happy': ['happy', 'joy', 'excited', 'pleased', 'content', 'glad', 'cheerful', 'good'],
        'neutral': ['okay', 'fine', 'alright', 'normal', 'average'],
        'suicidal': ['suicide', 'kill myself', 'end it all', 'not worth living', 'better off dead'],
    }
    
    # Intensity modifiers
    INTENSITY_MODIFIERS = {
        'very': 1.5,
        'extremely': 2.0,
        'really': 1.3,
        'quite': 1.2,
        'slightly': 0.7,
        'a bit': 0.8,
        'somewhat': 0.9,
    }
    
    def detect_emotions(self, text: str) -> Dict[str, float]:
        """
        Detect emotions in text and return confidence scores
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary with emotion names as keys and confidence scores (0-1) as values
        """
        if not text:
            return {}
        
        text_lower = text.lower()
        emotion_scores = {}
        
        # Count occurrences of emotion keywords
        for emotion, keywords in self.EMOTION_KEYWORDS.items():
            score = 0.0
            for keyword in keywords:
                # Simple word boundary matching
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
                
                # Check for intensity modifiers before the keyword
                for modifier, multiplier in self.INTENSITY_MODIFIERS.items():
                    modifier_pattern = r'\b' + re.escape(modifier) + r'\s+' + re.escape(keyword) + r'\b'
                    if re.search(modifier_pattern, text_lower, re.IGNORECASE):
                        score += matches * multiplier
                        break
                else:
                    score += matches
            
            # Normalize score (simple normalization)
            normalized_score = min(score / max(len(text.split()), 1), 1.0)
            if normalized_score > 0:
                emotion_scores[emotion] = normalized_score
        
        # Normalize all scores to sum to 1 (probability distribution)
        total_score = sum(emotion_scores.values())
        if total_score > 0:
            emotion_scores = {k: v / total_score for k, v in emotion_scores.items()}
        
        return emotion_scores
    
    def get_primary_emotion(self, text: str) -> Tuple[str, float]:
        """
        Get the primary (most likely) emotion from text
        
        Args:
            text: Input text to analyze
            
        Returns:
            Tuple of (emotion_name, confidence_score)
        """
        emotions = self.detect_emotions(text)
        if not emotions:
            return ('neutral', 1.0)
        
        primary_emotion = max(emotions.items(), key=lambda x: x[1])
        return primary_emotion
    
    def detect_risk_keywords(self, text: str) -> List[str]:
        """
        Detect risk-related keywords that might indicate crisis
        
        Args:
            text: Input text to analyze
            
        Returns:
            List of detected risk keywords
        """
        text_lower = text.lower()
        risk_keywords = []
        
        # Check for suicidal ideation keywords
        suicidal_keywords = ['suicide', 'kill myself', 'end it all', 'not worth living', 
                            'better off dead', 'want to die', 'no point']
        for keyword in suicidal_keywords:
            if keyword in text_lower:
                risk_keywords.append('suicidal_ideation')
                break
        
        # Check for self-harm keywords
        self_harm_keywords = ['hurt myself', 'cut myself', 'self harm', 'harm myself']
        for keyword in self_harm_keywords:
            if keyword in text_lower:
                risk_keywords.append('self_harm')
                break
        
        return risk_keywords
    
    def assess_risk_level(self, text: str) -> str:
        """
        Assess risk level based on text content
        
        Args:
            text: Input text to analyze
            
        Returns:
            Risk level: 'critical', 'high', 'medium', or 'low'
        """
        risk_keywords = self.detect_risk_keywords(text)
        if risk_keywords:
            return 'critical'
        
        emotions = self.detect_emotions(text)
        
        # Check for high-intensity negative emotions
        if emotions.get('suicidal', 0) > 0:
            return 'critical'
        
        if emotions.get('sad', 0) > 0.5 or emotions.get('anxious', 0) > 0.5:
            return 'high'
        
        if emotions.get('sad', 0) > 0.2 or emotions.get('anxious', 0) > 0.2:
            return 'medium'
        
        return 'low'
    
    def get_emotional_context(self, text: str) -> Dict:
        """
        Get comprehensive emotional context from text
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary with emotional context information
        """
        emotions = self.detect_emotions(text)
        primary_emotion, confidence = self.get_primary_emotion(text)
        risk_level = self.assess_risk_level(text)
        risk_keywords = self.detect_risk_keywords(text)
        
        return {
            'emotions': emotions,
            'primary_emotion': primary_emotion,
            'confidence': confidence,
            'risk_level': risk_level,
            'risk_keywords': risk_keywords,
            'text_length': len(text),
            'word_count': len(text.split())
        }


# Global instance
emotion_detector = EmotionDetector()




