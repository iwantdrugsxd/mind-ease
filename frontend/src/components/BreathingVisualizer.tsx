import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, RotateCcw, Pause, Play } from 'lucide-react';

interface BreathingVisualizerProps {
  exercise: {
    name: string;
    duration: number;
    pattern: {
      inhale: number;
      hold: number;
      exhale: number;
      pause?: number;
    };
  };
  onClose: () => void;
  onComplete: () => void;
}

const BreathingVisualizer: React.FC<BreathingVisualizerProps> = ({
  exercise,
  onClose,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'pause'>('inhale');
  const [count, setCount] = useState(exercise.pattern.inhale);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      startBreathingCycle();
      startTimer();
    } else {
      stopBreathingCycle();
      stopTimer();
    }

    return () => {
      stopBreathingCycle();
      stopTimer();
    };
  }, [isPlaying, phase, count]);

  const startBreathingCycle = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          // Move to next phase
          if (phase === 'inhale') {
            setPhase('hold');
            return exercise.pattern.hold;
          } else if (phase === 'hold') {
            setPhase('exhale');
            return exercise.pattern.exhale;
          } else if (phase === 'exhale') {
            if (exercise.pattern.pause) {
              setPhase('pause');
              return exercise.pattern.pause;
            } else {
              setPhase('inhale');
              return exercise.pattern.inhale;
            }
          } else {
            // pause -> inhale
            setPhase('inhale');
            return exercise.pattern.inhale;
          }
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopBreathingCycle = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          stopBreathingCycle();
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

  const handleReset = () => {
    stopBreathingCycle();
    stopTimer();
    setPhase('inhale');
    setCount(exercise.pattern.inhale);
    setRemainingTime(exercise.duration * 60);
    setProgress(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'inhale':
        return 'Breathe In';
      case 'hold':
        return 'Hold';
      case 'exhale':
        return 'Breathe Out';
      case 'pause':
        return 'Pause';
    }
  };

  const getCircleSize = () => {
    if (phase === 'inhale') {
      return 100; // Full size
    } else if (phase === 'hold') {
      return 100; // Maintain size
    } else if (phase === 'exhale') {
      return 30; // Small size
    } else {
      return 30; // Pause at small
    }
  };

  const circleSize = getCircleSize();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-primary-700">
        <button
          onClick={onClose}
          className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold">{exercise.name}</h2>
        <button className="p-2 hover:bg-primary-700 rounded-lg transition-colors">
          <Volume2 className="h-6 w-6" />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6">
        {/* Breathing Visualizer */}
        <div className="relative mb-8">
          <div
            className="relative rounded-full bg-primary-400 shadow-2xl transition-all duration-1000 ease-in-out"
            style={{
              width: `${circleSize * 4}px`,
              height: `${circleSize * 4}px`,
              maxWidth: '90vw',
              maxHeight: '90vw',
            }}
          >
            {/* Concentric circles */}
            <div className="absolute inset-0 rounded-full bg-primary-300 opacity-50" style={{ transform: 'scale(0.9)' }}></div>
            <div className="absolute inset-0 rounded-full bg-primary-200 opacity-30" style={{ transform: 'scale(0.8)' }}></div>
            <div className="absolute inset-0 rounded-full bg-primary-100 opacity-20" style={{ transform: 'scale(0.7)' }}></div>
            
            {/* Count display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl sm:text-8xl font-bold text-primary-900">{count}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center mb-8">
          <h3 className="text-2xl sm:text-3xl font-bold mb-2">{getPhaseText()}</h3>
          <p className="text-primary-200 text-sm sm:text-base">Follow the circle's rhythm</p>
        </div>

        {/* Controls */}
        <div className="w-full max-w-md space-y-4">
          {/* Progress Bar */}
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-primary-200">Remaining</span>
            <span className="text-primary-200 font-mono">{formatTime(remainingTime)}</span>
          </div>
          <div className="w-full bg-primary-700 rounded-full h-2">
            <div
              className="bg-primary-400 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="p-3 rounded-full bg-primary-700 hover:bg-primary-600 transition-colors"
            >
              <RotateCcw className="h-5 w-5" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full bg-primary-500 hover:bg-primary-400 flex items-center justify-center transition-all shadow-lg"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8 ml-1" />
              )}
            </button>

            <button className="px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 transition-colors text-sm">
              {exercise.duration} min
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreathingVisualizer;



