import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Pause, Play, RotateCcw } from 'lucide-react';

interface ProgressiveRelaxationProps {
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
] as const;

type RelaxPhase = 'tense' | 'release';

const ProgressiveRelaxation: React.FC<ProgressiveRelaxationProps> = ({ exercise, onClose, onComplete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [phase, setPhase] = useState<RelaxPhase>('tense');
  const [count, setCount] = useState(5);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalSeconds = exercise.duration * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingTime) / totalSeconds) * 100 : 0;
  const group = muscleGroups[currentGroup];
  const phaseCopy =
    phase === 'tense'
      ? 'Gently tense this area without straining.'
      : 'Release slowly and notice the difference in sensation.';

  useEffect(() => {
    setIsPlaying(false);
    setCurrentGroup(0);
    setPhase('tense');
    setCount(5);
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

      setCount((prev) => {
        if (prev > 1) return prev - 1;

        if (phase === 'tense') {
          setPhase('release');
          return 5;
        }

        if (currentGroup >= muscleGroups.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setIsPlaying(false);
          onComplete();
          return 0;
        }

        setCurrentGroup((value) => value + 1);
        setPhase('tense');
        return 5;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [currentGroup, isPlaying, onComplete, phase]);

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
    setCurrentGroup(0);
    setPhase('tense');
    setCount(5);
    setRemainingTime(totalSeconds);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedGroups = useMemo(() => muscleGroups.slice(0, currentGroup).map((item) => item.name), [currentGroup]);

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
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-200/75">Relaxation session</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{exercise.name}</h2>
              </div>
              <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-2 text-sm font-semibold text-indigo-100">
                {exercise.duration} min
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-200/75">Current muscle group</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    {formatTime(remainingTime)} left
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-300 transition-all duration-1000"
                    style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                  />
                </div>

                <div
                  className={`mt-8 rounded-[28px] border p-8 text-center transition-all ${
                    phase === 'tense'
                      ? 'border-rose-300/35 bg-rose-400/10 shadow-[0_0_0_1px_rgba(251,113,133,0.12)]'
                      : 'border-emerald-300/35 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(74,222,128,0.12)]'
                  }`}
                >
                  <div className="text-7xl">{group.emoji}</div>
                  <h3 className="mt-5 text-4xl font-bold">{group.name}</h3>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-200/75">
                    {phase === 'tense' ? 'Tense' : 'Release'}
                  </p>
                  <p className="mt-3 text-6xl font-black">{count}</p>
                  <p className="mt-4 text-lg text-slate-200">{phaseCopy}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-200/75">Controls</p>
                <div className="mt-4 flex items-center gap-3">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-200/75">Body map</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {completedGroups.length}/{muscleGroups.length} complete
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {muscleGroups.map((item, index) => {
                  const isCurrent = index === currentGroup;
                  const isComplete = index < currentGroup;
                  return (
                    <div
                      key={item.name}
                      className={`rounded-2xl border px-3 py-4 text-center transition ${
                        isCurrent
                          ? phase === 'tense'
                            ? 'border-rose-300/35 bg-rose-400/10'
                            : 'border-emerald-300/35 bg-emerald-400/10'
                          : isComplete
                            ? 'border-indigo-200/20 bg-indigo-400/10'
                            : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="mb-2 flex justify-center">
                        {isComplete ? <CheckCircle className="h-4 w-4 text-emerald-300" /> : <span className="text-2xl">{item.emoji}</span>}
                      </div>
                      <p className="text-xs font-semibold text-slate-100">{item.name}</p>
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

export default ProgressiveRelaxation;
