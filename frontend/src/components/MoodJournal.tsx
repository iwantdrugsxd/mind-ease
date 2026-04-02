import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Lock, Sparkles, TrendingUp } from 'lucide-react';
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
  onEntrySaved?: () => void;
}

const sessionShellBackground =
  'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(180deg,#0f172a_0%,#172554_55%,#111827_100%)]';

const moods = [
  { id: 'happy', emoji: '😊', label: 'Happy', tone: 'from-amber-300 to-yellow-400' },
  { id: 'calm', emoji: '😌', label: 'Calm', tone: 'from-emerald-300 to-teal-400' },
  { id: 'neutral', emoji: '😐', label: 'Neutral', tone: 'from-slate-300 to-slate-400' },
  { id: 'sad', emoji: '😢', label: 'Sad', tone: 'from-sky-300 to-blue-400' },
  { id: 'anxious', emoji: '😰', label: 'Anxious', tone: 'from-orange-300 to-rose-400' },
] as const;

const prompts = [
  'What felt manageable today, even briefly?',
  'What felt heavy or stressful?',
  'What helped you feel grounded?',
  'What do you need more of tomorrow?',
  'What would you tell a friend feeling like this?',
];

const MoodJournal: React.FC<MoodJournalProps> = ({ onClose, onEntrySaved }) => {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [journalText, setJournalText] = useState('');
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    void loadMoodHistory();
  }, []);

  const loadMoodHistory = async () => {
    try {
      const response = await api.get<MoodEntry[]>('/selfcare/mood-entries/');
      if (response.data && Array.isArray(response.data)) {
        setMoodHistory(response.data.slice(0, 7));
      }
    } catch (error) {
      console.warn('Could not load mood history:', error);
    }
  };

  const sendToChatbot = async (text: string, mood: string) => {
    const uid = user?.id || 'anonymous';
    let conversationId: string | number | null = null;

    const storedId = localStorage.getItem(`chat_convo_id_${uid}`);
    if (storedId) {
      conversationId = storedId;
    } else {
      const convResponse = await api.post<{ id: number }>('/screening/chatbot/conversations/', {
        firebase_uid: uid,
      });
      conversationId = convResponse.data.id;
      localStorage.setItem(`chat_convo_id_${uid}`, String(conversationId));
    }

    await api.post(`/screening/chatbot/conversations/${conversationId}/send-message/`, {
      message: `I logged a mood journal entry. I'm feeling ${mood}. ${text ? `Here is what I wrote: "${text}"` : ''}`,
      firebase_uid: uid,
    });
  };

  const handleSave = async () => {
    if (!selectedMood) {
      setFeedback({ tone: 'error', message: 'Select a mood before saving your entry.' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const moodLevelMap: Record<string, number> = {
        anxious: 1,
        sad: 2,
        neutral: 3,
        calm: 4,
        happy: 5,
      };

      await api.post('/selfcare/mood-entries/', {
        mood_level: moodLevelMap[selectedMood] || 3,
        notes: journalText || '',
        energy_level: 3,
        sleep_quality: 3,
        stress_level: selectedMood === 'anxious' ? 4 : selectedMood === 'calm' ? 2 : 3,
        firebase_uid: user?.id || '',
      });

      await loadMoodHistory();
      onEntrySaved?.();

      try {
        await sendToChatbot(journalText, selectedMood);
      } catch (chatbotError) {
        console.warn('Could not send to chatbot:', chatbotError);
      }

      setSelectedMood('');
      setJournalText('');
      setShowPrompts(false);
      setFeedback({ tone: 'success', message: 'Entry saved. Your mood history and guided support are now up to date.' });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Could not save your journal entry right now.';
      setFeedback({ tone: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const getMoodScore = (entry: MoodEntry) => {
    if (entry.mood_level) return entry.mood_level * 20;
    if (entry.mood) {
      const moodIndex = moods.findIndex((mood) => mood.id === entry.mood);
      return moodIndex >= 0 ? (moodIndex + 1) * 20 : 0;
    }
    return 0;
  };

  const getMoodFromEntry = (entry: MoodEntry): string => {
    if (entry.mood) return entry.mood;
    const levelToMood: Record<number, string> = {
      1: 'anxious',
      2: 'sad',
      3: 'neutral',
      4: 'calm',
      5: 'happy',
    };
    return entry.mood_level ? levelToMood[entry.mood_level] || 'neutral' : 'neutral';
  };

  const weekData = useMemo(() => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - index));
      const dateStr = date.toISOString().split('T')[0];
      const entry = moodHistory.find((item) => {
        if (!item.created_at) return false;
        return new Date(item.created_at).toISOString().split('T')[0] === dateStr;
      });

      return {
        day: days[date.getDay()],
        mood: entry ? getMoodFromEntry(entry) : null,
        score: entry ? getMoodScore(entry) : 0,
      };
    });
  }, [moodHistory]);

  return (
    <div className={`min-h-screen ${sessionShellBackground} text-white`}>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/35 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.8)] backdrop-blur-md">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200/75">Mood journal</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">Hello, {user?.name || 'there'}</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                <Calendar className="h-4 w-4" />
                Today
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 sm:p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">Check-in</p>
                <h3 className="mt-3 text-3xl font-bold">How are you feeling today?</h3>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {moods.map((mood) => {
                    const active = selectedMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        onClick={() => setSelectedMood(mood.id)}
                        className={`rounded-2xl border px-3 py-4 text-center transition ${
                          active ? 'border-white/20 bg-white/12 shadow-[0_8px_24px_-12px_rgba(255,255,255,0.18)]' : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${mood.tone} text-2xl shadow-sm`}>
                          {mood.emoji}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{mood.label}</p>
                        {active ? <div className="mt-2 mx-auto h-1.5 w-1.5 rounded-full bg-sky-300" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">Private journal</p>
                    <h3 className="mt-2 text-xl font-bold">Capture what stood out</h3>
                  </div>
                  <button
                    onClick={() => setShowPrompts((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/15"
                  >
                    <Sparkles className="h-4 w-4" />
                    Writing prompts
                  </button>
                </div>

                {showPrompts ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setJournalText((value) => (value ? `${value}\n\n${prompt}\n` : `${prompt}\n`));
                          setShowPrompts(false);
                        }}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <textarea
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  placeholder="Write about what felt heavy, what helped, or what you want to remember from today."
                  className="mt-4 h-40 w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 resize-none"
                />

                {feedback ? (
                  <div
                    className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                      feedback.tone === 'success'
                        ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                        : 'border-rose-300/20 bg-rose-400/10 text-rose-100'
                    }`}
                  >
                    {feedback.message}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <Lock className="h-4 w-4" />
                    Your entries remain private and secure.
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={loading || !selectedMood}
                    className="inline-flex min-w-[11rem] items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {loading ? 'Saving…' : 'Save entry'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">7-day trend</p>
                    <h3 className="mt-2 text-xl font-bold">Recent mood pattern</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                    <TrendingUp className="h-4 w-4" />
                    Last 7 days
                  </span>
                </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-900/35 p-5">
                  <div className="flex h-48 items-end justify-between gap-3">
                    {weekData.map((day, index) => (
                      <div key={`${day.day}-${index}`} className="flex flex-1 flex-col items-center">
                        <div className="flex h-36 w-full items-end justify-center">
                          <div
                            className="w-full rounded-t-2xl bg-gradient-to-t from-sky-500 via-cyan-400 to-indigo-300 transition-all duration-500"
                            style={{ height: `${Math.max(day.score, day.score > 0 ? 14 : 0)}%`, opacity: day.score > 0 ? 1 : 0.18 }}
                          />
                        </div>
                        <p className="mt-3 text-xs font-semibold text-slate-300">{day.day}</p>
                        <p className="mt-1 text-lg">{day.mood ? moods.find((item) => item.id === day.mood)?.emoji : '·'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">What this helps with</p>
                <div className="mt-4 space-y-3">
                  <InsightRow title="Track emotional patterns" body="A short check-in makes changes easier to notice over time." />
                  <InsightRow title="Support guided follow-up" body="Mood entries can strengthen self-care and AI-guided support recommendations." />
                  <InsightRow title="Keep reflection lightweight" body="A few honest lines are more useful than trying to write the perfect journal entry." />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function InsightRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

export default MoodJournal;
