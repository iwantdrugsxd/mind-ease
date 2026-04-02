import React, { useCallback, useEffect, useState } from 'react';
import { fetchClinicianPatientSummaries, sortPatientSummariesForPriority } from '../utils/clinicianApi';
import type { ClinicianPatientSummary } from '../utils/clinicianApi';
import ClinicianPatientTable, { PatientTableFilter } from '../components/clinician/ClinicianPatientTable';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import ClinicianFilterBar from '../components/clinician/ClinicianFilterBar';
import { clinPanel, clinBtnSecondary, clinConsoleStack } from '../components/clinician/clinicianUiClasses';

const ClinicianPatients: React.FC = () => {
  const [summaries, setSummaries] = useState<ClinicianPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PatientTableFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchClinicianPatientSummaries();
      setSummaries(sortPatientSummariesForPriority(rows));
    } catch (e: any) {
      setError(e?.message || 'Could not load patients.');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ClinicianLoadingState message="Loading roster…" showSkeleton />;
  }

  if (error) {
    return (
      <div className={`${clinPanel} border-red-200/90 bg-red-50/50 p-6`}>
        <p className="text-sm font-semibold text-red-900">{error}</p>
        <button type="button" onClick={() => void load()} className={`${clinBtnSecondary} mt-4`}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={clinConsoleStack}>
      <ClinicianPageIntro
        eyebrow="Operations"
        title="Patient roster"
        description="Everyone currently assigned to you in MindEase. Use filters to focus on risk, reassessment, or follow-up workload."
        actions={
          <ClinicianFilterBar search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} />
        }
      />
      <ClinicianPatientTable rows={summaries} search={search} filter={filter} />
    </div>
  );
};

export default ClinicianPatients;
