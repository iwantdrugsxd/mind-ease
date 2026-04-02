import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Heart,
  Shield,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Lock,
  ClipboardCheck,
  Calendar,
  Bell,
  TrendingUp,
  Stethoscope,
} from 'lucide-react';

/** Curated UI suggesting the patient app—not live data. Matches clinician landing preview density. */
const PatientProductPreviewMock: React.FC = () => {
  return (
    <div
      className="relative clinician-reveal clinician-delay-2 mx-auto w-full max-w-lg lg:max-w-none"
      aria-hidden
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-slate-200/80 via-cyan-100/40 to-slate-100/60 blur-2xl clinician-blob opacity-90" />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.2)] backdrop-blur-xl overflow-hidden">
        <div className="flex h-[min(420px,70vw)] min-h-[280px]">
          <div className="hidden sm:flex w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-200/60 bg-slate-900 py-4">
            <div className="h-8 w-8 rounded-lg bg-primary-600/90 flex items-center justify-center">
              <Heart className="h-4 w-4 text-white" aria-hidden />
            </div>
            <div className="h-2 w-6 rounded-full bg-slate-600" />
            <div className="h-2 w-6 rounded-full bg-slate-700" />
            <div className="h-2 w-6 rounded-full bg-slate-800" />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-4 py-3 bg-slate-50/80">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Wellness preview</span>
              <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold text-primary-900">
                Your journey
              </span>
            </div>
            <div className="clinician-shimmer-bar h-0.5 w-full" />
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-100">
              <div className="rounded-lg bg-slate-50 px-2 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Mood</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">Calm</p>
              </div>
              <div className="rounded-lg bg-primary-50/80 px-2 py-2 border border-primary-100/80">
                <p className="text-[10px] text-primary-800/80 uppercase tracking-wide">Screen</p>
                <p className="text-lg font-semibold text-primary-950 tabular-nums">Due</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Streak</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">7d</p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-primary-200/70 bg-primary-50/50 px-3 py-2">
                <Calendar className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">PHQ-9 check-in suggested</p>
                  <p className="text-[10px] text-slate-600">Evidence-based screening</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white/90">
                <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <span>Self-care</span>
                  <span>Done</span>
                </div>
                {[
                  { t: 'Breathing exercise', ok: true },
                  { t: 'Mood journal', ok: true },
                  { t: 'Sleep tips', ok: false },
                ].map((row) => (
                  <div
                    key={row.t}
                    className="grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2 border-t border-slate-50 text-xs"
                  >
                    <span className="text-slate-700 truncate">{row.t}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        row.ok ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                      }`}
                    >
                      {row.ok ? 'Yes' : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1 h-14 px-1 pt-2 border-t border-slate-100">
                <div className="flex-1 flex items-end gap-0.5 h-full">
                  {[35, 48, 42, 55, 50, 62, 58, 65, 60, 68].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-primary-600/30 to-primary-500/70 min-w-0"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <TrendingUp className="h-4 w-4 text-primary-600 shrink-0 mb-1" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { user } = useAuth();

  const benefits = [
    {
      title: 'Guided screening',
      body: 'PHQ-9 and GAD-7 style check-ins with clear, supportive language—not a cold form.',
      icon: <Shield className="h-6 w-6 text-white" aria-hidden />,
    },
    {
      title: 'Personalized self-care',
      body: 'Exercises and pathways that fit how you feel day to day, with gentle structure.',
      icon: <Heart className="h-6 w-6 text-white" aria-hidden />,
    },
    {
      title: 'Progress you can see',
      body: 'Trends and reflections so you notice patterns without obsessing over numbers.',
      icon: <BarChart3 className="h-6 w-6 text-white" aria-hidden />,
    },
    {
      title: 'Care team alignment',
      body: 'When your program uses MindEase, clinicians see assignment-scoped context—not your whole life story.',
      icon: <Users className="h-6 w-6 text-white" aria-hidden />,
    },
  ];

  const steps = [
    { n: 1, title: 'Create your account', body: 'Sign up securely and tell us what feels relevant to your care.' },
    { n: 2, title: 'Complete screening', body: 'Answer evidence-based questionnaires at your pace.' },
    { n: 3, title: 'Review insights', body: 'See summaries and signals designed to support—not replace—clinical judgment.' },
    { n: 4, title: 'Practice wellness', body: 'Use self-care tools and check back in when you are ready.' },
  ];

  const trustPills = [
    { icon: <Lock className="h-3.5 w-3.5" />, label: 'Privacy-minded' },
    { icon: <Shield className="h-3.5 w-3.5" />, label: 'Consent-aware sharing' },
    { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Structured screening' },
    { icon: <Heart className="h-3.5 w-3.5" />, label: 'Human-centered design' },
  ];

  const checklist = [
    'Screenings you can complete on your own schedule',
    'Self-care activities grounded in behavioral health practice',
    'Optional connection to assigned clinicians when your program enables it',
    'Crisis resources when you need immediate help',
  ];

  return (
    <div className="clinician-app clinician-landing relative min-h-screen bg-slate-100 text-slate-900 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="clinician-blob absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-cyan-200/50 via-slate-200/40 to-transparent blur-3xl" />
        <div className="clinician-blob-slow absolute top-1/3 -left-32 h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-slate-300/35 via-primary-200/25 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-gradient-to-tl from-slate-300/30 to-transparent blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative border-b border-slate-200/80">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="clinician-reveal inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-sm shadow-sm">
                <Heart className="h-4 w-4 text-primary-700" aria-hidden />
                MindEase · For you
              </div>
              <h1 className="clinician-reveal clinician-delay-1 mt-6 text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-950 tracking-tight leading-[1.1]">
                Mental health support that feels{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-primary-800 to-slate-800">
                  clear and calm
                </span>
              </h1>
              <p className="clinician-reveal clinician-delay-2 mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
                Structured screening, gentle self-care, and optional connections to your care team—built to respect your
                privacy and pace.
              </p>
              <div className="clinician-reveal clinician-delay-3 mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
                {user ? (
                  <>
                    <Link
                      to="/screening"
                      className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-7 py-3.5 text-base font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                    >
                      Start screening
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </Link>
                    <Link
                      to="/selfcare"
                      className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300/90 bg-white/70 px-7 py-3.5 text-base font-semibold text-slate-800 backdrop-blur-sm hover:bg-white hover:border-slate-400"
                    >
                      Self-care
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-7 py-3.5 text-base font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                    >
                      Get started
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </Link>
                    <Link
                      to="/login"
                      className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300/90 bg-white/70 px-7 py-3.5 text-base font-semibold text-slate-800 backdrop-blur-sm hover:bg-white hover:border-slate-400"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
              <div className="clinician-reveal clinician-delay-4 mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-sm text-slate-500 max-w-md">
                  Providers use a separate workspace. Looking to join as a clinician?
                </p>
                <Link
                  to="/clinicians"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-800 hover:text-primary-950 transition-colors"
                >
                  Provider platform
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
            <PatientProductPreviewMock />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative border-b border-slate-200/80 bg-white/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="clinician-reveal-fade flex flex-wrap justify-center gap-2 sm:gap-3">
            {trustPills.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
              >
                <span className="text-primary-700">{p.icon}</span>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Why MindEase */}
      <section className="relative py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-primary-800/80">Why MindEase</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">Built for real life</p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Not a generic wellness feed—structured tools that complement professional care when your program uses the
              platform.
            </p>
          </div>
          <ul className="clinician-stagger mt-14 grid sm:grid-cols-2 gap-5 lg:gap-6">
            {benefits.map((b) => (
              <li
                key={b.title}
                className="clinician-card-hover group rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md group-hover:scale-105 transition-transform duration-300">
                  {b.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-20 sm:py-24 border-y border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">How it works</h2>
              <p className="mt-3 text-3xl font-bold text-slate-950 tracking-tight">From sign-up to support</p>
            </div>
            <p className="text-slate-600 max-w-md text-sm sm:text-base leading-relaxed">
              You stay in control. Complete steps when you are ready—there is no pressure to share more than you choose.
            </p>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((s, i) => (
              <li key={s.n} className="relative">
                {i < steps.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-10 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-px bg-gradient-to-r from-slate-300 to-transparent"
                    aria-hidden
                  />
                )}
                <div className="relative rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm h-full clinician-card-hover">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900 text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety & crisis */}
      <section className="relative py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl shadow-slate-900/25 overflow-hidden">
            <div
              className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-500/40 via-transparent to-transparent pointer-events-none"
              aria-hidden
            />
            <div className="relative grid lg:grid-cols-2 gap-10 p-8 sm:p-12 lg:p-14">
              <div>
                <div className="flex items-center gap-2 text-primary-300">
                  <ClipboardCheck className="h-6 w-6" aria-hidden />
                  <span className="text-sm font-semibold uppercase tracking-widest">Safety & expectations</span>
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">MindEase is a support tool</h2>
                <p className="mt-4 text-slate-300 leading-relaxed">
                  It does not replace emergency services or your clinician. If you are in crisis, use the resources below
                  immediately.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-200">
                  {checklist.map((t) => (
                    <li key={t} className="flex gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-300" aria-hidden />
                  Crisis support
                </h3>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  If you are thinking about hurting yourself or someone else, or need help right now, reach out 24/7.
                </p>
                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">988 Suicide & Crisis Lifeline</span>
                    <a href="tel:988" className="text-amber-200 hover:text-amber-100 font-semibold tabular-nums">
                      Call or text 988
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">Crisis Text Line</span>
                    <span className="text-amber-200">Text HOME to 741741</span>
                  </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  {user ? (
                    <Link
                      to="/screening"
                      className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-100"
                    >
                      Go to screening
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : (
                    <Link
                      to="/register"
                      className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-100"
                    >
                      Create account
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                  <Link
                    to="/clinicians"
                    className="clinician-btn-ghost inline-flex justify-center items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <Stethoscope className="h-4 w-4" aria-hidden />
                    Clinician platform
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 sm:py-24 pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">Start when you are ready</h2>
          <p className="mt-4 text-lg text-slate-600">
            Create an account to use screening and self-care—or sign in to continue your journey.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-8 py-4 text-base font-semibold shadow-xl shadow-slate-900/20 hover:bg-slate-800"
                >
                  Open dashboard
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/selfcare"
                  className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-800 hover:border-slate-400"
                >
                  Self-care
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-8 py-4 text-base font-semibold shadow-xl shadow-slate-900/20 hover:bg-slate-800"
                >
                  Create account
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/login"
                  className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-800 hover:border-slate-400"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
          <p className="mt-10">
            <Link to="/clinicians" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              Clinician workspace →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
