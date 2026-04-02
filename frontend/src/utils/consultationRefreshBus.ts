/**
 * Lightweight pub/sub so consultation-related surfaces can refetch in sync
 * without Redux or websockets. Emit after mutations; subscribers refetch summaries/lists.
 */
export type ConsultationRefreshScope = 'clinician' | 'patient';

const clinicianListeners = new Set<() => void>();
const patientListeners = new Set<() => void>();

export function subscribeConsultationRefresh(scope: ConsultationRefreshScope, fn: () => void): () => void {
  const set = scope === 'clinician' ? clinicianListeners : patientListeners;
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function emitConsultationRefresh(scope: ConsultationRefreshScope): void {
  const set = scope === 'clinician' ? clinicianListeners : patientListeners;
  set.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore subscriber errors */
    }
  });
}
