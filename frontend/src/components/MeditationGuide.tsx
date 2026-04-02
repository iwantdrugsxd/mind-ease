import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';

interface MeditationGuideProps {
  exercise: {
    name: string;
    duration: number;
    instructions: string;
  };
  onClose: () => void;
  onComplete: () => void;
}

const sessionShellBackground =
  'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(180deg,#0f172a_0%,#172554_55%,#111827_100%)]';

const MeditationGuide: React.FC<MeditationGuideProps> = ({ exercise, onClose, onComplete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = useMemo(() => exercise.instructions.split('\n').filter((step) => step.trim()), [exercise.instructions]);
  const totalSeconds = exercise.duration * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingTime) / totalSeconds) * 100 : 0;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentStep(0);
    setRemainingTime(totalSeconds);
  }, [exercise, totalSeconds]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setIsPlaying(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, onComplete]);

  useEffect(() => {
    if (!steps.length) return;
    const elapsed = totalSeconds - remainingTime;
    const ratio = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    const nextStep = Math.min(steps.length - 1, Math.floor(ratio * steps.length));
    setCurrentStep(nextStep);
  }, [remainingTime, steps.length, totalSeconds]);

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
    setCurrentStep(0);
    setRemainingTime(totalSeconds);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-200/75">Meditation session</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{exercise.name}</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-sm font-semibold text-violet-100">
                <Sparkles className="h-4 w-4" />
                Guided focus
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/75">Current focus</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    {formatTime(remainingTime)} left
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-300 transition-all duration-1000"
                    style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                  />
                </div>

                <div className="mt-8 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="text-6xl">🧘</div>
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/70">
                    Step {currentStep + 1} of {Math.max(steps.length, 1)}
                  </p>
                  <h3 className="mt-3 text-3xl font-bold">
                    {steps[currentStep] || 'Take a quiet breath and settle into the session.'}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-300">
                    Move at a calm pace. If you lose focus, return to the current instruction without judgment.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/75">Controls</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsPlaying((value) => !value)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? 'Pause session' : 'Start session'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200/75">Session map</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {exercise.duration} min
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {steps.map((step, index) => {
                  const isCurrent = index === currentStep;
                  const isComplete = index < currentStep;
                  return (
                    <div
                      key={`${step}-${index}`}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                        isCurrent
                          ? 'border-violet-300/35 bg-violet-400/10'
                          : isComplete
                            ? 'border-emerald-300/20 bg-emerald-400/10'
                            : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isComplete ? (
                          <CheckCircle className="h-5 w-5 text-emerald-300" />
                        ) : (
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
                            isCurrent ? 'border-violet-200 text-violet-100' : 'border-white/15 text-slate-300'
                          }`}>
                            {index + 1}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-white' : 'text-slate-200'}`}>{step}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {isCurrent ? 'Current focus' : isComplete ? 'Completed' : 'Upcoming step'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeditationGuide;
