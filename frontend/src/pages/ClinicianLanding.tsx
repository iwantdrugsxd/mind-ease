import React from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  Activity,
  LayoutDashboard,
  FileText,
  Shield,
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  Bell,
  TrendingUp,
  Lock,
  UserCheck,
} from 'lucide-react';

/** Curated UI composition suggesting the clinician console—not a live dashboard. */
const ProductPreviewMock: React.FC = () => {
  return (
    <div
      className="relative clinician-reveal clinician-delay-2 mx-auto w-full max-w-lg lg:max-w-none"
      aria-hidden
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-slate-200/80 via-cyan-100/40 to-slate-100/60 blur-2xl clinician-blob opacity-90" />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.2)] backdrop-blur-xl overflow-hidden">
        <div className="flex h-[min(420px,70vw)] min-h-[280px]">
          <div className="hidden sm:flex w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-200/60 bg-slate-900 py-4">
            <div className="h-8 w-8 rounded-lg bg-slate-700/80" />
            <div className="h-2 w-6 rounded-full bg-slate-600" />
            <div className="h-2 w-6 rounded-full bg-slate-700" />
            <div className="h-2 w-6 rounded-full bg-slate-800" />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-4 py-3 bg-slate-50/80">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Console preview</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Live roster
              </span>
            </div>
            <div className="clinician-shimmer-bar h-0.5 w-full" />
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-100">
              <div className="rounded-lg bg-slate-50 px-2 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Patients</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">24</p>
              </div>
              <div className="rounded-lg bg-amber-50/80 px-2 py-2 border border-amber-100/80">
                <p className="text-[10px] text-amber-800/80 uppercase tracking-wide">Priority</p>
                <p className="text-lg font-semibold text-amber-900 tabular-nums">3</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Due</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">5</p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2">
                <Bell className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-950 truncate">Reassessment due — 2 assigned</p>
                  <p className="text-[10px] text-amber-800/70">Based on screening intervals</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white/90">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <span>Patient</span>
                  <span>PHQ</span>
                  <span>Risk</span>
                </div>
                {[
                  { id: 'P-1042', phq: '14', risk: 'High', tone: 'text-rose-700 bg-rose-50' },
                  { id: 'P-1088', phq: '6', risk: 'Low', tone: 'text-emerald-700 bg-emerald-50' },
                  { id: 'P-1101', phq: '11', risk: 'Med', tone: 'text-amber-800 bg-amber-50' },
                ].map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 border-t border-slate-50 text-xs"
                  >
                    <span className="font-mono text-slate-700 truncate">{row.id}</span>
                    <span className="tabular-nums text-slate-600">{row.phq}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${row.tone}`}>{row.risk}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1 h-14 px-1 pt-2 border-t border-slate-100">
                <div className="flex-1 flex items-end gap-0.5 h-full">
                  {[40, 55, 48, 62, 58, 70, 65, 72, 68, 75].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-primary-600/30 to-primary-500/70 min-w-0"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <TrendingUp className="h-4 w-4 text-primary-600 shrink-0 mb-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClinicianLanding: React.FC = () => {
  const benefits = [
    {
      title: 'Assigned patient monitoring',
      body: 'A single roster with screening scores, last activity, and assignment context.',
      icon: <Users className="h-6 w-6 text-slate-800" aria-hidden />,
    },
    {
      title: 'Risk prioritization',
      body: 'Surface who may need attention first—high-risk, reassessment due, and follow-up signals.',
      icon: <Activity className="h-6 w-6 text-slate-800" aria-hidden />,
    },
    {
      title: 'Trend & follow-up insight',
      body: 'Directional trends and suggested next steps informed by screening history—not generic tips.',
      icon: <TrendingUp className="h-6 w-6 text-slate-800" aria-hidden />,
    },
    {
      title: 'Notes & workflow hooks',
      body: 'Tie appointments and clinical notes to the same assignment-scoped record.',
      icon: <FileText className="h-6 w-6 text-slate-800" aria-hidden />,
    },
  ];

  const steps = [
    { n: 1, title: 'Apply', body: 'Create your provider account and open an application.' },
    { n: 2, title: 'Submit credentials', body: 'Share professional details and upload requested documentation.' },
    { n: 3, title: 'Verification', body: 'Our team reviews before any patient summaries are exposed.' },
    { n: 4, title: 'Dashboard access', body: 'Approved clinicians sign in to the operational console.' },
  ];

  const trustPills = [
    { icon: <Lock className="h-3.5 w-3.5" />, label: 'Verification required' },
    { icon: <Shield className="h-3.5 w-3.5" />, label: 'Consent-aware summaries' },
    { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: 'Clinician workflow' },
    { icon: <UserCheck className="h-3.5 w-3.5" />, label: 'Role-based access' },
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
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <div className="clinician-reveal inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-sm shadow-sm">
                <Stethoscope className="h-4 w-4 text-primary-700" aria-hidden />
                MindEase · Provider platform
              </div>
              <h1 className="clinician-reveal clinician-delay-1 mt-6 text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-950 tracking-tight leading-[1.1]">
                Operational clarity for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-primary-800 to-slate-800">
                  assigned patients
                </span>
              </h1>
              <p className="clinician-reveal clinician-delay-2 mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
                A verification-gated workspace to monitor screening signals, prioritize follow-up, and document care—built
                for clinicians, separate from the patient wellness experience.
              </p>
              <div className="clinician-reveal clinician-delay-3 mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
                <Link
                  to="/clinician/register"
                  className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-7 py-3.5 text-base font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                >
                  Apply now
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/clinician/login"
                  className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300/90 bg-white/70 px-7 py-3.5 text-base font-semibold text-slate-800 backdrop-blur-sm hover:bg-white hover:border-slate-400"
                >
                  Sign in
                </Link>
              </div>
              <p className="clinician-reveal clinician-delay-4 mt-5 text-sm text-slate-500 max-w-md">
                Dashboard access unlocks only after approval. Already verified? Use Sign in.
              </p>
            </div>
            <ProductPreviewMock />
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

      {/* Why clinicians */}
      <section className="relative py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-primary-800/80">Why clinicians use it</h2>
            <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">Built for clinical operations</p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Not a wellness feed—a structured view of assignment-scoped signals you can act on.
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
              <p className="mt-3 text-3xl font-bold text-slate-950 tracking-tight">From application to console</p>
            </div>
            <p className="text-slate-600 max-w-md text-sm sm:text-base leading-relaxed">
              Approval exists to protect patients and meet provider standards—not to slow you down without reason.
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

      {/* Eligibility */}
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
                  <span className="text-sm font-semibold uppercase tracking-widest">Application & eligibility</span>
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">Who should apply</h2>
                <p className="mt-4 text-slate-300 leading-relaxed">
                  Licensed or credentialed professionals who will receive formal patient assignments in MindEase and need
                  a secure console for screening summaries and follow-up—not open public access.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-200">
                  {[
                    'Professional identity and affiliation',
                    'License or credential documentation when requested',
                    'Review timeline communicated after submission',
                    'No patient data until verification completes',
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-white">After you submit</h3>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  Your application is reviewed for completeness and fit. Approved accounts can sign in and see only patients
                  assigned to them, with fields gated by patient consent and platform policy.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/clinician/register"
                    className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-100"
                  >
                    Start application
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    to="/clinician/login"
                    className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Already registered?
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
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">Join the clinician workspace</h2>
          <p className="mt-4 text-lg text-slate-600">
            Apply to get verified—or sign in if your organization has already approved your access.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/clinician/register"
              className="clinician-btn-primary inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 text-white px-8 py-4 text-base font-semibold shadow-xl shadow-slate-900/20 hover:bg-slate-800"
            >
              Apply as clinician
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              to="/clinician/login"
              className="clinician-btn-ghost inline-flex justify-center items-center rounded-xl border-2 border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-800 hover:border-slate-400"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-10">
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              ← Back to patient home
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default ClinicianLanding;
