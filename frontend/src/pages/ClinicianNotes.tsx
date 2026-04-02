import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import ClinicianLoadingState from '../components/clinician/ClinicianLoadingState';
import ClinicianEmptyState from '../components/clinician/ClinicianEmptyState';
import ClinicianPageIntro from '../components/clinician/ClinicianPageIntro';
import { clinPanel, clinBtnSecondary, clinConsoleStack, clinPanelAccentTop } from '../components/clinician/clinicianUiClasses';
import { FileText } from 'lucide-react';

interface NoteRow {
  id: number;
  patient?: number;
  patient_name?: string;
  note_type?: string;
  content?: string;
  created_at?: string;
}

const ClinicianNotes: React.FC = () => {
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ results?: NoteRow[] }>('/clinician/clinical-notes/');
      setRows(res.data.results || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load notes.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ClinicianLoadingState message="Loading documentation…" />;
  }

  if (error) {
    return (
      <div className={`${clinPanel} border-red-200/90 bg-red-50/50 p-6 max-w-lg`}>
        <p className="text-sm font-semibold text-red-900">{error}</p>
        <button type="button" className={`${clinBtnSecondary} mt-4`} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`${clinConsoleStack} max-w-4xl`}>
        <ClinicianPageIntro
          eyebrow="Documentation"
          title="Clinical notes"
          description="Recent documentation on your account: type, timestamp, and patient context."
        />
        <ClinicianEmptyState
          icon={<FileText className="h-6 w-6" aria-hidden />}
          title="No clinical notes yet"
          description="Documentation you add in MindEase will appear here with type, timestamp, and patient context."
        />
      </div>
    );
  }

  return (
    <div className={`${clinConsoleStack} max-w-4xl`}>
      <ClinicianPageIntro
        eyebrow="Documentation"
        title="Clinical notes"
        description="Newest first. Open the patient record for full assignment context."
      />
      <div className="space-y-4">
        {rows.map((n) => (
          <article key={n.id} className={`${clinPanel} overflow-hidden transition-all duration-200 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.12)] hover:-translate-y-0.5`}>
            <div className={clinPanelAccentTop} />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap justify-between gap-3 items-start border-b border-slate-100/90 pb-4 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary-900 bg-primary-50 border border-primary-100/90 px-2.5 py-1 rounded-lg">
                  {n.note_type?.replace(/_/g, ' ') || 'Note'}
                </span>
                <time className="text-xs font-bold text-slate-500 tabular-nums tracking-tight">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </time>
              </div>
              {n.patient ? (
                <Link
                  to={`/clinician/patients/${n.patient}`}
                  className="text-sm font-bold text-slate-900 hover:text-primary-700 transition-colors"
                >
                  {n.patient_name || `Patient #${n.patient}`}
                </Link>
              ) : null}
              <p className="text-sm text-slate-800 mt-3 whitespace-pre-wrap leading-relaxed line-clamp-[8]">{n.content || '—'}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ClinicianNotes;
