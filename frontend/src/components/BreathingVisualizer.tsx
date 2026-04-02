import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Wind } from 'lucide-react';

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

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'pause';

const phaseCopy: Record<BreathPhase, { title: string; body: string }> = {
  inhale: { title: 'Breathe in', body: 'Expand slowly and follow the outer ring.' },
  hold: { title: 'Hold steady', body: 'Stay soft in the shoulders and jaw.' },
  exhale: { title: 'Breathe out', body: 'Let the circle settle as you release tension.' },
  pause: { title: 'Pause', body: 'Rest briefly before the next breath begins.' },
};

const sessionShellBackground =
  'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(180deg,#0f172a_0%,#172554_55%,#111827_100%)]';

const BreathingVisualizer: React.FC<BreathingVisualizerProps> = ({ exercise, onClose, onComplete }) => {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [count, setCount] = useState(exercise.pattern.inhale);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(exercise.duration * 60);
  const [completedCycles, setCompletedCycles] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const phaseDurations = useMemo(
    () => ({
      inhale: exercise.pattern.inhale,
      hold: exercise.pattern.hold,
      exhale: exercise.pattern.exhale,
      pause: exercise.pattern.pause || 0,
    }),
    [exercise.pattern]
  );

  const totalSeconds = exercise.duration * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingTime) / totalSeconds) * 100 : 0;
  const cycleSeconds = phaseDurations.inhale + phaseDurations.hold + phaseDurations.exhale + phaseDurations.pause;
  const estimatedCycles = cycleSeconds > 0 ? Math.max(1, Math.floor(totalSeconds / cycleSeconds)) : 1;

  useEffect(() => {
    setPhase('inhale');
    setCount(exercise.pattern.inhale);
    setRemainingTime(exercise.duration * 60);
    setCompletedCycles(0);
    setIsPlaying(false);
  }, [exercise]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsPlaying(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });

      setCount((prevCount) => {
        if (prevCount > 1) return prevCount - 1;

        if (phase === 'inhale') {
          setPhase('hold');
          return phaseDurations.hold;
        }
        if (phase === 'hold') {
          setPhase('exhale');
          return phaseDurations.exhale;
        }
        if (phase === 'exhale') {
          if (phaseDurations.pause > 0) {
            setPhase('pause');
            return phaseDurations.pause;
          }
          setPhase('inhale');
          setCompletedCycles((value) => value + 1);
          return phaseDurations.inhale;
        }

        setPhase('inhale');
        setCompletedCycles((value) => value + 1);
        return phaseDurations.inhale;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isPlaying, onComplete, phase, phaseDurations]);

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsPlaying(false);
    setPhase('inhale');
    setCount(phaseDurations.inhale);
    setRemainingTime(totalSeconds);
    setCompletedCycles(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const circleScale = {
    inhale: 'scale-[1]',
    hold: 'scale-[1]',
    exhale: 'scale-[0.72]',
    pause: 'scale-[0.68]',
  }[phase];

  const currentCopy = phaseCopy[phase];

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
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200/75">Breathing session</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{exercise.name}</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100">
                <Wind className="h-4 w-4" />
                Guided pace
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <SessionPill label={`${exercise.duration} min session`} />
                <SessionPill label={`${completedCycles}/${estimatedCycles} cycles`} subtle />
                <SessionPill label={formatTime(remainingTime)} subtle />
              </div>

              <div className="mt-8 flex flex-col items-center">
                <div className={`relative flex h-[18rem] w-[18rem] items-center justify-center transition-transform duration-1000 ease-in-out sm:h-[22rem] sm:w-[22rem] ${circleScale}`}>
                  <div className="absolute inset-0 rounded-full bg-sky-400/15 blur-2xl" />
                  <div className="absolute inset-[8%] rounded-full border border-white/10 bg-sky-300/10" />
                  <div className="absolute inset-[16%] rounded-full border border-white/10 bg-sky-300/15" />
                  <div className="absolute inset-[24%] rounded-full border border-white/10 bg-sky-200/15" />
                  <div className="absolute inset-[31%] rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(125,211,252,0.92)_45%,_rgba(14,116,144,0.8)_100%)] shadow-[0_0_80px_rgba(56,189,248,0.35)]" />
                  <div className="relative z-10 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-900/55">Count</p>
                    <p className="mt-2 text-6xl font-black text-slate-950 sm:text-7xl">{count}</p>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200/75">Current phase</p>
                  <h3 className="mt-2 text-3xl font-bold">{currentCopy.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{currentCopy.body}</p>
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/80">
                  <span>Session progress</span>
                  <span>{formatTime(remainingTime)} left</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 transition-all duration-1000"
                    style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">Breathing pattern</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <PatternCard label="Inhale" value={`${phaseDurations.inhale}s`} active={phase === 'inhale'} />
                  <PatternCard label="Hold" value={`${phaseDurations.hold}s`} active={phase === 'hold'} />
                  <PatternCard label="Exhale" value={`${phaseDurations.exhale}s`} active={phase === 'exhale'} />
                  <PatternCard label="Pause" value={`${phaseDurations.pause || 0}s`} active={phase === 'pause'} />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/75">Controls</p>
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
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Keep your breath soft. The goal is steady pacing, not perfection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SessionPill({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
        subtle ? 'border-white/10 bg-white/5 text-slate-200' : 'border-sky-300/20 bg-sky-400/10 text-sky-100'
      }`}
    >
      {label}
    </span>
  );
}

function PatternCard({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition ${
        active ? 'border-sky-300/40 bg-sky-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-200'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-inherit/80">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default BreathingVisualizer;
