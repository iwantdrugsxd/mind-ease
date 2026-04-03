import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Play, Clock, CheckCircle, Heart, Brain, Activity, BookOpen, TrendingUp, Award, ArrowRight } from 'lucide-react';
import BreathingVisualizer from '../components/BreathingVisualizer';
import MoodJournal from '../components/MoodJournal';
import MeditationGuide from '../components/MeditationGuide';
import ProgressiveRelaxation from '../components/ProgressiveRelaxation';
import api from '../utils/api';

const panel =
  'rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)]';
const sectionLabel = 'text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500';

interface Exercise {
  id: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  difficulty: string;
  instructions: string;
  benefits: string;
  pattern?: {
    inhale: number;
    hold: number;
    exhale: number;
    pause?: number;
  };
}

interface Pathway {
  id: number;
  name: string;
  description: string;
  targetSeverity: string;
  exercises: Exercise[];
  color: string;
  icon: React.ReactNode;
}
interface BackendPathwayExercise {
  exercise: {
    id: number;
    name: string;
    description: string;
    exercise_type: string;
    duration_minutes: number;
    difficulty_level: string;
    instructions: string;
    benefits: string;
  };
}
interface BackendPathway {
  id: number;
  name: string;
  description: string;
  target_severity: string;
  exercises: BackendPathwayExercise[];
}
interface BackendRecommendedExercise {
  id: number;
  name: string;
  description: string;
  exercise_type: string;
  duration_minutes: number;
  difficulty_level: string;
  instructions: string;
  benefits: string;
}

const SelfCare: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'exercises' | 'pathways' | 'progress'>('exercises');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [, setSelectedPathway] = useState<Pathway | null>(null);
  const [completionRecords, setCompletionRecords] = useState<any[]>([]);
  const [backendExercises, setBackendExercises] = useState<Exercise[]>([]);
  const [progressRecords, setProgressRecords] = useState<any[]>([]);
  const [showMoodJournal, setShowMoodJournal] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [recommendedPathways, setRecommendedPathways] = useState<Pathway[]>([]);
  const [recommendedExercises, setRecommendedExercises] = useState<Exercise[]>([]);
  const [activitySummary, setActivitySummary] = useState<any>(null);
  const [continuity, setContinuity] = useState<any>(null);
  const [reassessment, setReassessment] = useState<any>(null);
  const [nextBestAction, setNextBestAction] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  React.useEffect(() => {
    const normalizeList = (data: any) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      return [];
    };
    const load = async () => {
      if (!user) return;
      setIsLoadingData(true);
      try {
        const [recRes, exRes, completionRes, progressRes] = await Promise.all([
          api.get<{
            recommendation: any;
            pathways: BackendPathway[];
            recommended_exercises: BackendRecommendedExercise[];
            activity_summary: any;
            continuity?: any;
            reassessment?: any;
            next_best_action?: any;
            readiness?: any;
          }>('/selfcare/pathways/onboarding-recommended/'),
          api.get('/selfcare/exercises/'),
          api.get('/selfcare/completions/'),
          api.get('/selfcare/progress/'),
        ]);

        setRecommendation(recRes.data?.recommendation || null);
        setActivitySummary(recRes.data?.activity_summary || null);
        setContinuity(recRes.data?.continuity || null);
        setReassessment(recRes.data?.reassessment || null);
        setNextBestAction(recRes.data?.next_best_action || null);
        setReadiness(recRes.data?.readiness || null);
        const pathways = (recRes.data?.pathways || []) as BackendPathway[];
        const mapped: Pathway[] = pathways.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          targetSeverity: p.target_severity,
          exercises: (p.exercises || []).map((pe) => ({
            id: pe.exercise.id,
            name: pe.exercise.name,
            description: pe.exercise.description,
            type: pe.exercise.exercise_type,
            duration: pe.exercise.duration_minutes,
            difficulty: pe.exercise.difficulty_level,
            instructions: pe.exercise.instructions,
            benefits: pe.exercise.benefits,
          })),
          color: "from-indigo-500 to-blue-500",
          icon: <TrendingUp className="h-6 w-6" />,
        }));
        setRecommendedPathways(mapped);
        const mappedExercises: Exercise[] = (recRes.data?.recommended_exercises || []).map((ex) => ({
          id: ex.id,
          name: ex.name,
          description: ex.description,
          type: ex.exercise_type,
          duration: ex.duration_minutes,
          difficulty: ex.difficulty_level,
          instructions: ex.instructions,
          benefits: ex.benefits,
        }));
        setRecommendedExercises(mappedExercises);
        const fetchedExercises: Exercise[] = normalizeList(exRes.data).map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          description: ex.description,
          type: ex.exercise_type,
          duration: ex.duration_minutes,
          difficulty: ex.difficulty_level,
          instructions: ex.instructions,
          benefits: ex.benefits,
        }));
        setBackendExercises(fetchedExercises);
        setCompletionRecords(normalizeList(completionRes.data));
        setProgressRecords(normalizeList(progressRes.data));
      } catch {
        setRecommendation(null);
        setRecommendedPathways([]);
        setRecommendedExercises([]);
        setActivitySummary(null);
        setContinuity(null);
        setReassessment(null);
        setNextBestAction(null);
        setReadiness(null);
        setBackendExercises([]);
        setCompletionRecords([]);
        setProgressRecords([]);
      } finally {
        setIsLoadingData(false);
      }
    };
    load();
  }, [user]);

  const exercises: Exercise[] = [
    {
      id: 1,
      name: "4-7-8 Breathing",
      description: "A scientifically-backed breathing technique to reduce stress and anxiety, promote relaxation, and improve sleep quality",
      type: "breathing",
      duration: 5,
      difficulty: "beginner",
      instructions: "Follow the visual guide to breathe in for 4 counts, hold for 7 counts, and exhale for 8 counts",
      benefits: "Reduces stress, improves sleep, calms the nervous system, lowers blood pressure",
      pattern: {
        inhale: 4,
        hold: 7,
        exhale: 8,
      }
    },
    {
      id: 2,
      name: "Body Scan Meditation",
      description: "A mindfulness practice to increase body awareness, release tension, and promote deep relaxation",
      type: "mindfulness",
      duration: 15,
      difficulty: "intermediate",
      instructions: "1. Lie down comfortably\n2. Start at your toes and slowly scan up your body\n3. Notice any tension or sensations\n4. Breathe into each area and release tension\n5. Take your time with each body part\n6. End with a few deep breaths",
      benefits: "Reduces muscle tension, improves body awareness, promotes relaxation, enhances mindfulness"
    },
    {
      id: 3,
      name: "Gratitude Journaling",
      description: "Write down things you're grateful for to improve mood, shift perspective, and build resilience",
      type: "journaling",
      duration: 10,
      difficulty: "beginner",
      instructions: "1. Write down 3 things you're grateful for today\n2. Be specific about why you're grateful\n3. Reflect on how these things make you feel\n4. Consider the people, experiences, or things that brought you joy",
      benefits: "Improves mood, increases positive thinking, reduces depression symptoms, builds resilience"
    },
    {
      id: 4,
      name: "Progressive Muscle Relaxation",
      description: "Systematically tense and relax muscle groups to reduce physical tension and promote deep relaxation",
      type: "physical",
      duration: 20,
      difficulty: "intermediate",
      instructions: "1. Start with your toes, tense for 5 seconds\n2. Release and notice the relaxation\n3. Move up through each muscle group\n4. End with your head and face\n5. Take deep breaths between each group",
      benefits: "Reduces physical tension, improves sleep, decreases anxiety, promotes body awareness"
    }
  ];

  const pathways: Pathway[] = [
    {
      id: 1,
      name: "Stress Relief Pathway",
      description: "A comprehensive 2-week program combining breathing exercises and mindfulness to manage daily stress and anxiety",
      targetSeverity: "mild",
      exercises: exercises.filter(ex => ['breathing', 'mindfulness'].includes(ex.type)),
      color: "from-blue-500 to-cyan-500",
      icon: <Heart className="h-6 w-6" />
    },
    {
      id: 2,
      name: "Depression Recovery",
      description: "Evidence-based exercises including journaling and physical relaxation to support mood improvement and energy restoration",
      targetSeverity: "moderate",
      exercises: exercises.filter(ex => ['journaling', 'physical'].includes(ex.type)),
      color: "from-purple-500 to-pink-500",
      icon: <TrendingUp className="h-6 w-6" />
    },
    {
      id: 3,
      name: "Anxiety Management",
      description: "Tools and techniques including breathing exercises and meditation to manage anxiety and panic symptoms effectively",
      targetSeverity: "moderate",
      exercises: exercises.filter(ex => ['breathing', 'mindfulness'].includes(ex.type)),
      color: "from-green-500 to-emerald-500",
      icon: <Brain className="h-6 w-6" />
    }
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'breathing': return <Heart className="h-5 w-5" />;
      case 'mindfulness': return <Brain className="h-5 w-5" />;
      case 'journaling': return <BookOpen className="h-5 w-5" />;
      case 'physical': return <Activity className="h-5 w-5" />;
      default: return <Heart className="h-5 w-5" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleExerciseStart = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    if (exercise.type === 'breathing') {
      setActiveComponent('breathing');
    } else if (exercise.type === 'mindfulness') {
      setActiveComponent('meditation');
    } else if (exercise.type === 'journaling') {
      setShowMoodJournal(true);
    } else if (exercise.type === 'physical') {
      setActiveComponent('relaxation');
    }
  };

  const displayExercises: Exercise[] = backendExercises.length > 0 ? backendExercises : exercises;
  const completedExerciseIds = Array.from(
    new Set(
      completionRecords
        .map((c) => Number(c?.exercise))
        .filter((id) => Number.isFinite(id))
    )
  );
  const completedCount = activitySummary?.completed_exercises ?? completionRecords.length;
  const totalMinutes =
    activitySummary?.total_minutes ??
    completionRecords.reduce((sum, c) => {
      if (c?.duration_actual) return sum + Number(c.duration_actual);
      const ex = displayExercises.find((e) => e.id === Number(c.exercise));
      return sum + Number(ex?.duration || 0);
    }, 0);
  const completionRate =
    activitySummary?.exercise_catalog_count
      ? Math.round(
          (Number(activitySummary.completed_exercises || 0) / Math.max(Number(activitySummary.exercise_catalog_count || 0), 1)) * 100
        )
      : displayExercises.length
        ? Math.round((completedExerciseIds.length / displayExercises.length) * 100)
        : 0;
  const pathwayCatalog = recommendedPathways.length > 0 ? recommendedPathways : pathways;
  const exerciseCards = useMemo(
    () => [
      ...recommendedExercises.map((exercise) => ({ ...exercise, isRecommended: true })),
      ...displayExercises
        .filter((exercise) => !recommendedExercises.some((recommended) => recommended.id === exercise.id))
        .map((exercise) => ({ ...exercise, isRecommended: false })),
    ],
    [displayExercises, recommendedExercises]
  );

  const persistExerciseCompletion = async (exercise: Exercise) => {
    // If we only have a local exercise fallback, try mapping by `type` to a backend exercise id.
    const persistId = backendExercises.find((e) => e.type === exercise.type)?.id ?? exercise.id;
    try {
      await api.post('/selfcare/completions/', {
        exercise: persistId,
        duration_actual: exercise.duration,
        notes: `Completed in self-care module (${exercise.type})`,
      });
      const [completionRes, progressRes] = await Promise.all([
        api.get('/selfcare/completions/'),
        api.get('/selfcare/progress/'),
      ]);
      const normalizeList = (data: any) => Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
      setCompletionRecords(normalizeList(completionRes.data));
      setProgressRecords(normalizeList(progressRes.data));
      try {
        const refreshed = await api.get<{ activity_summary?: any; continuity?: any; reassessment?: any; next_best_action?: any; readiness?: any }>('/selfcare/pathways/onboarding-recommended/');
        setActivitySummary(refreshed.data?.activity_summary || null);
        setContinuity(refreshed.data?.continuity || null);
        setReassessment(refreshed.data?.reassessment || null);
        setNextBestAction(refreshed.data?.next_best_action || null);
        setReadiness(refreshed.data?.readiness || null);
      } catch {}
    } catch (error) {
      console.warn('Unable to persist exercise completion:', error);
    } finally {
      setSelectedExercise(null);
      setActiveComponent(null);
    }
  };

  const handleExerciseComplete = async (exercise: Exercise | null) => {
    if (!exercise) {
      setSelectedExercise(null);
      setActiveComponent(null);
      return;
    }
    await persistExerciseCompletion(exercise);
  };

  const handlePathwayStart = (pathway: Pathway) => {
    setSelectedPathway(pathway);
    // Start with first exercise in pathway
    if (pathway.exercises.length > 0) {
      handleExerciseStart(pathway.exercises[0]);
    }
  };

  if (showMoodJournal) {
    return (
      <MoodJournal
        onClose={() => {
          setShowMoodJournal(false);
          setSelectedExercise(null);
        }}
        onEntrySaved={async () => {
          await handleExerciseComplete(selectedExercise);
        }}
      />
    );
  }

  if (activeComponent === 'breathing' && selectedExercise) {
    return (
      <BreathingVisualizer
        exercise={{
          name: selectedExercise.name,
          duration: selectedExercise.duration,
          pattern: selectedExercise.pattern || { inhale: 4, hold: 7, exhale: 8 }
        }}
        onClose={() => {
          setActiveComponent(null);
          setSelectedExercise(null);
        }}
        onComplete={() => handleExerciseComplete(selectedExercise)}
      />
    );
  }

  if (activeComponent === 'meditation' && selectedExercise) {
    return (
      <MeditationGuide
        exercise={selectedExercise}
        onClose={() => {
          setActiveComponent(null);
          setSelectedExercise(null);
        }}
        onComplete={() => handleExerciseComplete(selectedExercise)}
      />
    );
  }

  if (activeComponent === 'relaxation' && selectedExercise) {
    return (
      <ProgressiveRelaxation
        exercise={selectedExercise}
        onClose={() => {
          setActiveComponent(null);
          setSelectedExercise(null);
        }}
        onComplete={() => handleExerciseComplete(selectedExercise)}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to access self-care</h2>
          <p className="text-gray-600">You need to be logged in to access personalized self-care content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={`${panel} overflow-hidden`}>
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
                  <Heart className="h-6 w-6" />
                </div>
                <div>
                  <p className={sectionLabel}>Self-Care</p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">Guided recovery and routine</h1>
                  <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-slate-600">
                    Exercises, pathways, and progress in one structured workspace designed to support consistency rather than overwhelm you.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SelfCareMetric label="Completed" value={String(completedCount)} note="Exercises finished" />
                <SelfCareMetric label="Minutes" value={String(totalMinutes)} note="Total time invested" />
                <SelfCareMetric label="Completion rate" value={`${completionRate}%`} note="Across available exercises" />
                <SelfCareMetric
                  label="Engagement"
                  value={capitalizeLabel(activitySummary?.engagement_level || 'low')}
                  note={`Streak ${activitySummary?.streak_days || 0} day${(activitySummary?.streak_days || 0) === 1 ? '' : 's'}`}
                />
              </div>

              <div className="grid gap-3">
                {recommendation ? (
                  <SignalCard title="Recommended focus" body={recommendation.message} tone="primary" />
                ) : null}
                {nextBestAction?.title ? (
                  <SignalCard title={nextBestAction.title} body={nextBestAction.description} tone="neutral" />
                ) : null}
                {reassessment?.reassessment_due ? (
                  <SignalCard
                    title="Reassessment due"
                    body="Taking PHQ-9 or GAD-7 can refresh your recommendations and support plan."
                    tone="warning"
                    actionLabel="Go to screening"
                    actionHref="/screening"
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <p className={sectionLabel}>Momentum</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Resume where it matters</h2>
              <div className="mt-4 space-y-3">
                {continuity?.continue_pathway_name ? (
                  <ResumeCard
                    title="Continue pathway"
                    body={`Pick up where you left off in ${continuity.continue_pathway_name}.`}
                    buttonLabel="Continue"
                    onClick={() => {
                      const target = [...recommendedPathways, ...pathways].find((p) => p.id === continuity.continue_pathway_id);
                      if (target) handlePathwayStart(target);
                    }}
                  />
                ) : null}
                {continuity?.recommended_next_exercise_name ? (
                  <ResumeCard
                    title="Suggested next exercise"
                    body={continuity.recommended_next_exercise_name}
                    buttonLabel="Start"
                    onClick={() => {
                      const ex = displayExercises.find((e) => e.id === continuity.recommended_next_exercise_id);
                      if (ex) handleExerciseStart(ex);
                    }}
                  />
                ) : null}
                {nextBestAction?.action_type === 'log_mood' ? (
                  <ResumeCard
                    title="Quick mood check"
                    body={nextBestAction.description || 'A quick mood check can be more useful right now.'}
                    buttonLabel="Log mood"
                    onClick={() => {
                      setSelectedExercise({
                        id: continuity?.recommended_next_exercise_id || 0,
                        name: 'Mood Journal',
                        description: 'Track your mood and reflections.',
                        type: 'journaling',
                        duration: 5,
                        difficulty: 'beginner',
                        instructions: '',
                        benefits: '',
                      });
                      setShowMoodJournal(true);
                    }}
                  />
                ) : null}
                {!continuity?.continue_pathway_name && !continuity?.recommended_next_exercise_name && nextBestAction?.action_type !== 'log_mood' ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    Your next guided step will appear here once more activity is available.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Tabs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto px-1">
              {[
                { id: 'exercises', label: 'Exercises', count: displayExercises.length, icon: <Activity className="h-4 w-4" /> },
                { id: 'pathways', label: 'Pathways', count: (recommendedPathways.length || pathways.length), icon: <TrendingUp className="h-4 w-4" /> },
                { id: 'progress', label: 'Progress', count: completedCount, icon: <Award className="h-4 w-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-2 sm:px-4 border-b-2 font-medium text-sm sm:text-base whitespace-nowrap flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-slate-900 text-slate-950'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="bg-slate-100 text-slate-900 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Exercises Tab */}
        {activeTab === 'exercises' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {exerciseCards.map((exercise: any) => (
              <div
                key={`${exercise.isRecommended ? 'recommended' : 'catalog'}-${exercise.id}`}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-5 sm:p-6 border border-slate-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-700 shrink-0">
                      {getTypeIcon(exercise.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {exercise.isRecommended ? (
                          <span className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-700">
                            Recommended
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                          {exercise.type}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mt-2 truncate">{exercise.name}</h3>
                    </div>
                  </div>
                  {completedExerciseIds.includes(exercise.id) && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
                
                <p className="text-sm text-slate-600 mb-4 line-clamp-3 min-h-[60px]">{exercise.description}</p>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-500">
                      <Clock className="h-4 w-4" />
                      <span>{exercise.duration} min</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-right">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(exercise.difficulty)}`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Best for</p>
                  <p className="mt-1 text-sm text-slate-700 line-clamp-2">{exercise.benefits}</p>
                </div>
                
                <button
                  onClick={() => handleExerciseStart(exercise)}
                  className="w-full bg-slate-950 text-white py-2.5 px-4 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center font-medium"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start session
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pathways Tab */}
        {activeTab === 'pathways' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {pathwayCatalog.map((pathway: any) => {
              const totalPathwayMinutes = pathway.exercises.reduce((sum: number, exercise: Exercise) => sum + Number(exercise.duration || 0), 0);
              return (
              <div
                key={pathway.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                      {pathway.icon}
                    </div>
                    <div>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                        Best for {pathway.targetSeverity}
                      </span>
                      <h3 className="mt-3 text-xl font-bold text-slate-950">{pathway.name}</h3>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{pathway.exercises.length} steps</p>
                    <p className="mt-1">{totalPathwayMinutes} min total</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600">{pathway.description}</p>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Pathway flow</p>
                    <span className="text-xs font-medium text-slate-500">Start with the first step</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(pathway.exercises as Exercise[]).slice(0, 3).map((exercise: Exercise, index: number) => (
                      <div key={exercise.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{exercise.name}</p>
                          <p className="text-xs text-slate-500">{exercise.duration} min • {exercise.type}</p>
                        </div>
                      </div>
                    ))}
                    {pathway.exercises.length > 3 ? (
                      <p className="text-xs text-slate-500 px-1">+ {pathway.exercises.length - 3} more steps in this pathway</p>
                    ) : null}
                  </div>
                </div>

                <button
                  onClick={() => handlePathwayStart(pathway)}
                  className="mt-5 w-full bg-slate-950 text-white py-3 px-4 rounded-xl hover:bg-slate-900 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  Start pathway
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )})}
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className={`${panel} p-6 sm:p-8`}>
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-6">Your Progress</h3>
            
            {isLoadingData ? (
              <div className="text-center py-12 text-slate-500">Loading progress...</div>
            ) : completedCount === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-4">
                  <Activity className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-slate-600 text-lg mb-2">You haven't completed any exercises yet.</p>
                <p className="text-sm text-slate-500">Start with an exercise to track your progress.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
                  <div className="rounded-2xl p-6 text-center border border-slate-200 bg-slate-50">
                    <div className="text-4xl font-bold text-slate-950 mb-2">{completedCount}</div>
                    <div className="text-sm text-slate-600 font-medium">Exercises Completed</div>
                  </div>
                  <div className="rounded-2xl p-6 text-center border border-slate-200 bg-slate-50">
                    <div className="text-4xl font-bold text-slate-950 mb-2">
                      {completionRate}%
                    </div>
                    <div className="text-sm text-slate-600 font-medium">Completion Rate</div>
                  </div>
                  <div className="rounded-2xl p-6 text-center border border-slate-200 bg-slate-50">
                    <div className="text-4xl font-bold text-slate-950 mb-2">{totalMinutes}</div>
                    <div className="text-sm text-slate-600 font-medium">Total Minutes</div>
                  </div>
                </div>
                {activitySummary && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                    Engagement: {activitySummary.engagement_level || 'low'} · streak {activitySummary.streak_days || 0} day(s)
                    {` · pathways started ${progressRecords.length}`}
                    {` · weekly activity ${activitySummary.weekly_activity_count || 0}`}
                    {activitySummary.no_recent_activity || readiness?.needs_reengagement ? ' · No recent activity detected, start with a short session today.' : ''}
                    {continuity?.short_reengagement_exercise?.name ? ` · Try ${continuity.short_reengagement_exercise.name} for a quick restart.` : ''}
                  </div>
                )}
                
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4 text-lg">Completed Exercises</h4>
                  <div className="space-y-3">
                    {completionRecords.slice(0, 20).map((completion: any) => {
                      const exercise = displayExercises.find(ex => ex.id === Number(completion.exercise));
                      return (
                        <div key={completion.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <span className="text-slate-900 font-medium">{completion.exercise_name || exercise?.name || 'Exercise'}</span>
                              <p className="text-xs text-slate-500">
                                {completion.completed_at ? new Date(completion.completed_at).toLocaleString() : 'Completed'}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-slate-500 bg-white px-3 py-1 rounded-full">
                            {completion.duration_actual || exercise?.duration || 0} min
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default SelfCare;

function SelfCareMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function SignalCard({
  title,
  body,
  tone,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  tone: 'primary' | 'neutral' | 'warning';
  actionHref?: string;
  actionLabel?: string;
}) {
  const styles = {
    primary: 'border-primary-100 bg-primary-50 text-primary-900',
    neutral: 'border-slate-200 bg-slate-50 text-slate-900',
    warning: 'border-amber-100 bg-amber-50 text-amber-950',
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-4 ${styles}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{body}</p>
      {actionHref && actionLabel ? (
        <a href={actionHref} className="mt-3 inline-flex text-sm font-semibold underline">
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}

function ResumeCard({
  title,
  body,
  buttonLabel,
  onClick,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{body}</p>
      </div>
      <button onClick={onClick} className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">
        {buttonLabel}
      </button>
    </div>
  );
}function capitalizeLabel(value: string) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}
