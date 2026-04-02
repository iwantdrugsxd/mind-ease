import React from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  GitBranchPlus,
  ShieldAlert,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  ConsultationListRow,
  StaffAssignmentRow,
  StaffClinicianRow,
  deactivateStaffAssignment,
  fetchOrphanedConsultationCases,
  fetchStaffAssignments,
  fetchStaffClinicians,
  transferStaffAssignment,
} from '../utils/clinicianApi';

const panel =
  'rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)]';
const sectionLabel = 'text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500';

const ClinicianAssignments: React.FC = () => {
  const [assignments, setAssignments] = React.useState<StaffAssignmentRow[]>([]);
  const [orphanedCases, setOrphanedCases] = React.useState<ConsultationListRow[]>([]);
  const [clinicians, setClinicians] = React.useState<StaffClinicianRow[]>([]);
  const [selectedTargets, setSelectedTargets] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [staffDenied, setStaffDenied] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [assignmentRows, orphanedRows, clinicianRows] = await Promise.all([
        fetchStaffAssignments(),
        fetchOrphanedConsultationCases(),
        fetchStaffClinicians(),
      ]);
      setAssignments(assignmentRows);
      setOrphanedCases(orphanedRows);
      setClinicians(clinicianRows);
      setStaffDenied(false);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setStaffDenied(true);
      } else {
        setError(e?.response?.data?.detail || e?.message || 'Could not load assignment operations.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const clinicianLabel = React.useCallback((row: StaffClinicianRow) => {
    const full = `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim();
    return full || row.user?.email || `Clinician #${row.id}`;
  }, []);

  const handleTransfer = async (patientId: number, targetId?: number, notes?: string, key?: string) => {
    if (!targetId) {
      setError('Choose a clinician before transferring the assignment.');
      return;
    }
    setSavingKey(key || `transfer-${patientId}`);
    setError(null);
    setFeedback(null);
    try {
      await transferStaffAssignment({ patient: patientId, to_clinician: targetId, notes });
      setFeedback('Assignment updated.');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Could not transfer the assignment.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeactivate = async (assignmentId: number) => {
    setSavingKey(`deactivate-${assignmentId}`);
    setError(null);
    setFeedback(null);
    try {
      await deactivateStaffAssignment(assignmentId);
      setFeedback('Assignment deactivated.');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Could not deactivate this assignment.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-slate-600">Loading assignment operations…</div>;
  }

  if (staffDenied) {
    return (
      <div className={`${panel} p-6`}>
        <p className={sectionLabel}>Assignments</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Staff access required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Assignment routing and transfer workflows are intentionally restricted to internal staff accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={panel}>
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
        <div className="p-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className={sectionLabel}>Operations</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Assignment routing</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Manage who owns active patients, rescue consultation cases that lost assignment linkage, and keep clinician
              queues operationally correct.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <MetricCard icon={<Users className="h-4 w-4" />} label="Active assignments" value={String(assignments.filter((row) => row.is_active).length)} />
            <MetricCard icon={<ShieldAlert className="h-4 w-4" />} label="Orphaned cases" value={String(orphanedCases.length)} />
            <MetricCard icon={<GitBranchPlus className="h-4 w-4" />} label="Available clinicians" value={String(clinicians.length)} />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">{error}</div>
      ) : null}
      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">{feedback}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={panel}>
          <div className="px-5 py-4 border-b border-slate-100">
            <p className={sectionLabel}>Current ownership</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Active assignments</h3>
          </div>
          <div className="p-5 space-y-4">
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-600">No assignments yet.</p>
            ) : (
              assignments.map((row) => {
                const transferKey = `assignment-${row.id}`;
                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{row.patient_name || `Patient #${row.patient}`}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Owned by {row.clinician_name || `Clinician #${row.clinician}`} · Assigned{' '}
                          {new Date(row.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <select
                        value={selectedTargets[transferKey] || ''}
                        onChange={(e) => setSelectedTargets((current) => ({ ...current, [transferKey]: Number(e.target.value) }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                      >
                        <option value="">Move to clinician…</option>
                        {clinicians
                          .filter((clinician) => clinician.id !== row.clinician)
                          .map((clinician) => (
                            <option key={clinician.id} value={clinician.id}>
                              {clinicianLabel(clinician)} · {clinician.specialization}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => void handleTransfer(row.patient, selectedTargets[transferKey], row.notes, transferKey)}
                        disabled={savingKey === transferKey}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Transfer
                      </button>
                      <button
                        onClick={() => void handleDeactivate(row.id)}
                        disabled={savingKey === `deactivate-${row.id}` || !row.is_active}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        <UserMinus className="h-4 w-4" />
                        Deactivate
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`${panel} h-fit`}>
          <div className="px-5 py-4 border-b border-slate-100">
            <p className={sectionLabel}>Recovery queue</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Orphaned consultation cases</h3>
          </div>
          <div className="p-5 space-y-4">
            {orphanedCases.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No consultation cases are missing assignment ownership right now.
              </div>
            ) : (
              orphanedCases.map((caseRow) => {
                const transferKey = `orphaned-${caseRow.id}`;
                return (
                  <div key={caseRow.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-950">{caseRow.patient_name || `Patient #${caseRow.patient}`}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Case #{caseRow.id} · {caseRow.priority} priority · {caseRow.status.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">{caseRow.trigger_reason || 'No trigger reason recorded.'}</p>
                        <div className="mt-4 grid gap-3">
                          <select
                            value={selectedTargets[transferKey] || ''}
                            onChange={(e) => setSelectedTargets((current) => ({ ...current, [transferKey]: Number(e.target.value) }))}
                            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                          >
                            <option value="">Assign to clinician…</option>
                            {clinicians.map((clinician) => (
                              <option key={clinician.id} value={clinician.id}>
                                {clinicianLabel(clinician)} · {clinician.specialization}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void handleTransfer(caseRow.patient, selectedTargets[transferKey], 'Recovered from orphaned consultation case', transferKey)}
                            disabled={savingKey === transferKey}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Restore ownership
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</p>
        <div>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

export default ClinicianAssignments;
