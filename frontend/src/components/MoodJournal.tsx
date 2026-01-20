import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Lock, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

interface MoodEntry {
  id?: number;
  mood_level?: number;
  mood?: string;
  notes?: string;
  journal_text?: string;
  created_at: string;
}

interface MoodJournalProps {
  onClose: () => void;
}

const moods = [
  { id: 'happy', emoji: '😊', label: 'Happy', color: 'bg-yellow-400' },
  { id: 'calm', emoji: '😌', label: 'Calm', color: 'bg-green-400' },
  { id: 'neutral', emoji: '😐', label: 'Neutral', color: 'bg-gray-400' },
  { id: 'sad', emoji: '😢', label: 'Sad', color: 'bg-blue-400' },
  { id: 'anxious', emoji: '😰', label: 'Anxious', color: 'bg-orange-400' },
];

const MoodJournal: React.FC<MoodJournalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [journalText, setJournalText] = useState('');
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  const prompts = [
    "What made you smile today?",
    "What challenged you today?",
    "What are you grateful for?",
    "How did you take care of yourself today?",
    "What would you like to remember about today?",
  ];

  useEffect(() => {
    loadMoodHistory();
  }, []);

  const loadMoodHistory = async () => {
    try {
      // Load last 7 days of mood entries
      const response = await api.get<MoodEntry[]>('/selfcare/mood-entries/');
      if (response.data && Array.isArray(response.data)) {
        // Get last 7 entries
        const last7 = response.data.slice(0, 7);
        setMoodHistory(last7);
      }
    } catch (error) {
      console.warn('Could not load mood history:', error);
    }
  };

  const sendToChatbot = async (journalText: string, mood: string) => {
    try {
      // Get or create conversation
      let conversationId = null;
      const uid = user?.id || 'anonymous';
      
      try {
        const storedId = localStorage.getItem(`chat_convo_id_${uid}`);
        if (storedId) {
          conversationId = storedId;
        } else {
          // Create new conversation
          interface Conversation {
            id: number;
            session_id: string;
          }
          const convResponse = await api.post<Conversation>('/screening/chatbot/conversations/', {
            firebase_uid: uid
          });
          conversationId = convResponse.data.id;
          localStorage.setItem(`chat_convo_id_${uid}`, String(conversationId));
        }
      } catch (convError) {
        console.warn('Could not get/create conversation:', convError);
        return;
      }

      if (!conversationId) return;

      // Format message with mood context
      const message = `I just wrote in my journal. I'm feeling ${mood}. ${journalText ? `Here's what I wrote: "${journalText}"` : ''}`;

      // Send to chatbot
      await api.post(
        `/screening/chatbot/conversations/${conversationId}/send-message/`,
        {
          message: message,
          firebase_uid: uid
        }
      );

      console.log('Journal entry sent to chatbot successfully');
    } catch (error) {
      console.error('Error sending to chatbot:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!selectedMood) {
      alert('Please select a mood');
      return;
    }

    setLoading(true);
    try {
      // Map mood string to mood_level (1-5)
      const moodLevelMap: Record<string, number> = {
        'anxious': 1,
        'sad': 2,
        'neutral': 3,
        'calm': 4,
        'happy': 5,
      };

      const response = await api.post('/selfcare/mood-entries/', {
        mood_level: moodLevelMap[selectedMood] || 3,
        notes: journalText || '',
        energy_level: 3, // Default, can be enhanced later
        sleep_quality: 3,
        stress_level: selectedMood === 'anxious' ? 4 : selectedMood === 'calm' ? 2 : 3,
        firebase_uid: user?.id || ''
      });
      
      console.log('Mood entry saved successfully:', response.data);
      
      // Reload history
      await loadMoodHistory();
      
      // Send journal entry to chatbot and get response
      try {
        await sendToChatbot(journalText, selectedMood);
      } catch (chatbotError) {
        console.warn('Could not send to chatbot:', chatbotError);
        // Don't fail the save if chatbot fails
      }
      
      // Reset form
      setSelectedMood('');
      setJournalText('');
      
      alert('Entry saved successfully!');
    } catch (error: any) {
      console.error('Error saving mood entry:', error);
      
      let errorMessage = 'Failed to save entry. Please try again.';
      
      if (error.isConnectionError || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to backend server. Please ensure the Django backend is running:\n\n1. Open a terminal\n2. cd mental_health_backend\n3. source ../backend_env/bin/activate\n4. python manage.py runserver\n\nThen try again.';
      } else if (error.response?.data) {
        errorMessage = error.response.data.error || 
                      error.response.data.detail || 
                      error.response.data.message ||
                      JSON.stringify(error.response.data);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to save entry:\n\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getMoodScore = (entry: MoodEntry) => {
    // Use mood_level if available, otherwise map from mood string
    if (entry.mood_level) {
      return entry.mood_level * 20;
    }
    if (entry.mood) {
      const moodIndex = moods.findIndex(m => m.id === entry.mood);
      return moodIndex >= 0 ? (moodIndex + 1) * 20 : 0;
    }
    return 0;
  };

  const getMoodFromEntry = (entry: MoodEntry): string => {
    if (entry.mood) return entry.mood;
    // Map mood_level back to mood string
    const levelToMood: Record<number, string> = {
      1: 'anxious',
      2: 'sad',
      3: 'neutral',
      4: 'calm',
      5: 'happy',
    };
    return entry.mood_level ? (levelToMood[entry.mood_level] || 'neutral') : 'neutral';
  };

  const getLast7DaysMoods = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map((date, index) => {
      const dateStr = date.toISOString().split('T')[0];
      const entry = moodHistory.find(e => {
        if (!e.created_at) return false;
        const entryDate = new Date(e.created_at).toISOString().split('T')[0];
        return entryDate === dateStr;
      });
      return {
        day: days[date.getDay()],
        mood: entry ? getMoodFromEntry(entry) : null,
        score: entry ? getMoodScore(entry) : 0,
      };
    });
  };

  const weekData = getLast7DaysMoods();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold">Hello, {user?.name || 'User'}</h2>
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <Calendar className="h-6 w-6" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Mood Selection */}
        <div>
          <h3 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">How are you feeling today?</h3>
          <div className="flex justify-between gap-2 sm:gap-4">
            {moods.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(mood.id)}
                className="flex-1 flex flex-col items-center p-3 sm:p-4 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <div className="text-4xl sm:text-5xl mb-2">{mood.emoji}</div>
                <span className="text-xs sm:text-sm font-medium mb-1">{mood.label}</span>
                {selectedMood === mood.id && (
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-1"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Journal Entry */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg sm:text-xl font-semibold">Your private journal</h3>
            <button
              onClick={() => setShowPrompts(!showPrompts)}
              className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Need a prompt?</span>
            </button>
          </div>

          {showPrompts && (
            <div className="mb-3 p-3 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">Try writing about:</p>
              <ul className="space-y-1">
                {prompts.map((prompt, idx) => (
                  <li key={idx} className="text-sm text-primary-300">
                    • {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Write about your day..."
            className="w-full h-32 sm:h-40 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* 7-Day Mood Trend */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-semibold">Your 7-Day Mood Trend</h3>
            <button className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View History <TrendingUp className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-end justify-between gap-2 h-32 sm:h-40">
              {weekData.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="relative w-full flex items-end justify-center h-full">
                    <div
                      className="w-full bg-primary-600 rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${day.score}%`,
                        minHeight: day.score > 0 ? '8px' : '0',
                      }}
                    ></div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-400 mt-2">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm">
            <Lock className="h-4 w-4" />
            <span>Your entries are private and secure.</span>
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !selectedMood}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-lg"
          >
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodJournal;

