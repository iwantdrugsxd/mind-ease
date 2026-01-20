import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Play, Clock, CheckCircle, Heart, Brain, Activity, BookOpen, TrendingUp, Award } from 'lucide-react';
import BreathingVisualizer from '../components/BreathingVisualizer';
import MoodJournal from '../components/MoodJournal';
import MeditationGuide from '../components/MeditationGuide';
import ProgressiveRelaxation from '../components/ProgressiveRelaxation';

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

const SelfCare: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'exercises' | 'pathways' | 'progress'>('exercises');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [, setSelectedPathway] = useState<Pathway | null>(null);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [showMoodJournal, setShowMoodJournal] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

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

  const handleExerciseComplete = (exerciseId: number) => {
    setCompletedExercises(prev => [...prev, exerciseId]);
    setSelectedExercise(null);
    setActiveComponent(null);
  };

  const handlePathwayStart = (pathway: Pathway) => {
    setSelectedPathway(pathway);
    // Start with first exercise in pathway
    if (pathway.exercises.length > 0) {
      handleExerciseStart(pathway.exercises[0]);
    }
  };

  if (showMoodJournal) {
    return <MoodJournal onClose={() => setShowMoodJournal(false)} />;
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
        onComplete={() => handleExerciseComplete(selectedExercise.id)}
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
        onComplete={() => handleExerciseComplete(selectedExercise.id)}
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
        onComplete={() => handleExerciseComplete(selectedExercise.id)}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-6 sm:py-8 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Self-Care Hub</h1>
          <p className="text-lg sm:text-xl text-gray-600">
            Personalized exercises and pathways to support your mental health journey.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 sm:mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              {[
                { id: 'exercises', label: 'Exercises', count: exercises.length, icon: <Activity className="h-4 w-4" /> },
                { id: 'pathways', label: 'Pathways', count: pathways.length, icon: <TrendingUp className="h-4 w-4" /> },
                { id: 'progress', label: 'Progress', count: completedExercises.length, icon: <Award className="h-4 w-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-2 sm:px-4 border-b-2 font-medium text-sm sm:text-base whitespace-nowrap flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Exercises Tab */}
        {activeTab === 'exercises' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-5 sm:p-6 border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                      {getTypeIcon(exercise.type)}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{exercise.name}</h3>
                  </div>
                  {completedExercises.includes(exercise.id) && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">{exercise.description}</p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>{exercise.duration} min</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(exercise.difficulty)}`}>
                    {exercise.difficulty}
                  </span>
                </div>
                
                <button
                  onClick={() => handleExerciseStart(exercise)}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2.5 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all flex items-center justify-center font-medium shadow-md hover:shadow-lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Exercise
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pathways Tab */}
        {activeTab === 'pathways' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pathways.map((pathway) => (
              <div
                key={pathway.id}
                className={`bg-gradient-to-br ${pathway.color} rounded-xl shadow-lg hover:shadow-xl transition-all p-6 sm:p-8 text-white relative overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      {pathway.icon}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold">{pathway.name}</h3>
                  </div>
                  
                  <p className="text-white/90 mb-6 text-sm sm:text-base leading-relaxed">{pathway.description}</p>
                  
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white/90">Exercises in this pathway:</span>
                      <span className="text-sm text-white/80 bg-white/20 px-2 py-1 rounded-full">
                        {pathway.exercises.length} exercises
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pathway.exercises.map((exercise) => (
                        <div key={exercise.id} className="flex items-center space-x-2 text-sm text-white/90 bg-white/10 rounded-lg p-2">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          <span>{exercise.name}</span>
                          <span className="text-white/60 ml-auto">({exercise.duration} min)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handlePathwayStart(pathway)}
                    className="w-full bg-white text-gray-900 py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors font-semibold shadow-lg"
                  >
                    Start Pathway
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
            <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">Your Progress</h3>
            
            {completedExercises.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Activity className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-gray-600 text-lg mb-2">You haven't completed any exercises yet.</p>
                <p className="text-sm text-gray-500">Start with an exercise to track your progress!</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-center border border-green-200">
                    <div className="text-4xl font-bold text-green-600 mb-2">{completedExercises.length}</div>
                    <div className="text-sm text-green-700 font-medium">Exercises Completed</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center border border-blue-200">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {Math.round((completedExercises.length / exercises.length) * 100)}%
                    </div>
                    <div className="text-sm text-blue-700 font-medium">Completion Rate</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 text-center border border-purple-200">
                    <div className="text-4xl font-bold text-purple-600 mb-2">
                      {completedExercises.reduce((sum, id) => {
                        const ex = exercises.find(e => e.id === id);
                        return sum + (ex?.duration || 0);
                      }, 0)}
                    </div>
                    <div className="text-sm text-purple-700 font-medium">Total Minutes</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4 text-lg">Completed Exercises</h4>
                  <div className="space-y-3">
                    {completedExercises.map((exerciseId) => {
                      const exercise = exercises.find(ex => ex.id === exerciseId);
                      return exercise ? (
                        <div key={exerciseId} className="flex items-center justify-between bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <span className="text-gray-900 font-medium">{exercise.name}</span>
                              <p className="text-xs text-gray-500">{exercise.description}</p>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">{exercise.duration} min</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfCare;
