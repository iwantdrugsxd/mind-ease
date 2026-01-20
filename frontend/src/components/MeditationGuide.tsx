import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Volume2, RotateCcw, Pause, Play, CheckCircle } from 'lucide-react';

interface MeditationGuideProps {
  exercise: {
    name: string;
    duration: number;
    instructions: string;
  };
  onClose: () => void;
  onComplete: () => void;
}

const MeditationGuide: React.FC<MeditationGuideProps> = ({
  exercise,
  onClose,
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = exercise.instructions.split('\n').filter(s => s.trim());

  useEffect(() => {
    if (isPlaying) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => stopTimer();
  }, [isPlaying]);

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

  const handleReset = () => {
    stopTimer();
    setCurrentStep(0);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-700">
        <button
          onClick={onClose}
          className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold">{exercise.name}</h2>
        <button className="p-2 hover:bg-purple-700 rounded-lg transition-colors">
          <Volume2 className="h-6 w-6" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-purple-200">Remaining</span>
            <span className="text-purple-200 font-mono">{formatTime(remainingTime)}</span>
          </div>
          <div className="w-full bg-purple-700 rounded-full h-2">
            <div
              className="bg-purple-400 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-purple-800/50 rounded-2xl p-6 sm:p-8 mb-6 min-h-[300px] flex flex-col justify-center">
          <div className="text-center">
            <div className="text-6xl mb-6">🧘</div>
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              Step {currentStep + 1} of {steps.length}
            </h3>
            <p className="text-lg sm:text-xl text-purple-100 leading-relaxed">
              {steps[currentStep] || 'Take a moment to breathe...'}
            </p>
          </div>
        </div>

        {/* Steps List */}
        <div className="bg-purple-800/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold mb-3 text-purple-200">Meditation Steps</h4>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-2 rounded-lg ${
                  index === currentStep
                    ? 'bg-purple-600 text-white'
                    : index < currentStep
                    ? 'bg-purple-700/50 text-purple-200'
                    : 'text-purple-300'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-purple-400 mt-0.5 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs">{index + 1}</span>
                  </div>
                )}
                <span className="text-sm">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="p-3 rounded-full bg-purple-700 hover:bg-purple-600 transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => {
                if (currentStep > 0) setCurrentStep(currentStep - 1);
              }}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(currentStep + 1);
                }
              }}
              disabled={currentStep === steps.length - 1}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-400 flex items-center justify-center transition-all shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-1" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeditationGuide;



