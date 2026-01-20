import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Volume2, RotateCcw, Pause, Play, CheckCircle } from 'lucide-react';

interface ProgressiveRelaxationProps {
  exercise: {
    name: string;
    duration: number;
    instructions: string;
  };
  onClose: () => void;
  onComplete: () => void;
}

const muscleGroups = [
  { name: 'Toes', emoji: '🦶' },
  { name: 'Calves', emoji: '🦵' },
  { name: 'Thighs', emoji: '🦵' },
  { name: 'Abdomen', emoji: '🤲' },
  { name: 'Hands', emoji: '✋' },
  { name: 'Arms', emoji: '💪' },
  { name: 'Shoulders', emoji: '🤷' },
  { name: 'Neck', emoji: '👤' },
  { name: 'Face', emoji: '😌' },
];

const ProgressiveRelaxation: React.FC<ProgressiveRelaxationProps> = ({
  exercise,
  onClose,
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [isTensing, setIsTensing] = useState(false);
  const [tensionCount, setTensionCount] = useState(5);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tensionRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      startTimer();
      startTensionCycle();
    } else {
      stopTimer();
      stopTensionCycle();
    }

    return () => {
      stopTimer();
      stopTensionCycle();
    };
  }, [isPlaying, currentGroup, isTensing, tensionCount]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          stopTimer();
          onComplete();
          return 0;
        }
        return prev - 1;
      });
      setProgress((prev) => {
        const newProgress = prev + (100 / (exercise.duration * 60));
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTensionCycle = () => {
    if (tensionRef.current) clearInterval(tensionRef.current);

    tensionRef.current = setInterval(() => {
      if (isTensing) {
        setTensionCount((prev) => {
          if (prev <= 1) {
            setIsTensing(false);
            setTensionCount(5);
            return 5;
          }
          return prev - 1;
        });
      } else {
        setTensionCount((prev) => {
          if (prev <= 1) {
            setIsTensing(true);
            if (currentGroup < muscleGroups.length - 1) {
              setCurrentGroup(currentGroup + 1);
            } else {
              stopTimer();
              stopTensionCycle();
              onComplete();
            }
            return 5;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const stopTensionCycle = () => {
    if (tensionRef.current) {
      clearInterval(tensionRef.current);
      tensionRef.current = null;
    }
  };

  const handleReset = () => {
    stopTimer();
    stopTensionCycle();
    setCurrentGroup(0);
    setIsTensing(false);
    setTensionCount(5);
    setRemainingTime(exercise.duration * 60);
    setProgress(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-indigo-700">
        <button
          onClick={onClose}
          className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold">{exercise.name}</h2>
        <button className="p-2 hover:bg-indigo-700 rounded-lg transition-colors">
          <Volume2 className="h-6 w-6" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-indigo-200">Remaining</span>
            <span className="text-indigo-200 font-mono">{formatTime(remainingTime)}</span>
          </div>
          <div className="w-full bg-indigo-700 rounded-full h-2">
            <div
              className="bg-indigo-400 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Current Muscle Group */}
        <div className={`bg-indigo-800/50 rounded-2xl p-8 mb-6 min-h-[300px] flex flex-col justify-center transition-all ${
          isTensing ? 'ring-4 ring-red-400 animate-pulse' : 'ring-2 ring-green-400'
        }`}>
          <div className="text-center">
            <div className="text-8xl mb-6">{muscleGroups[currentGroup].emoji}</div>
            <h3 className="text-3xl sm:text-4xl font-bold mb-4">
              {muscleGroups[currentGroup].name}
            </h3>
            <div className="text-6xl font-bold mb-4">{tensionCount}</div>
            <p className="text-xl sm:text-2xl text-indigo-100">
              {isTensing ? 'Tense and Hold...' : 'Release and Relax...'}
            </p>
          </div>
        </div>

        {/* Muscle Groups Progress */}
        <div className="bg-indigo-800/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold mb-3 text-indigo-200">Muscle Groups</h4>
          <div className="grid grid-cols-3 gap-2">
            {muscleGroups.map((group, index) => (
              <div
                key={index}
                className={`p-2 rounded-lg text-center ${
                  index === currentGroup
                    ? 'bg-indigo-600 text-white'
                    : index < currentGroup
                    ? 'bg-indigo-700/50 text-indigo-200'
                    : 'bg-indigo-800/30 text-indigo-300'
                }`}
              >
                {index < currentGroup ? (
                  <CheckCircle className="h-4 w-4 mx-auto mb-1" />
                ) : null}
                <div className="text-2xl">{group.emoji}</div>
                <div className="text-xs">{group.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="p-3 rounded-full bg-indigo-700 hover:bg-indigo-600 transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-all shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-1" />
            )}
          </button>

          <button className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 transition-colors text-sm">
            {exercise.duration} min
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressiveRelaxation;



