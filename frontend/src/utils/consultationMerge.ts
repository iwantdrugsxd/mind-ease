/** Merge API rows into previous list order so inbox UIs do not jump on soft refresh. */
export function mergeByIdPreserveOrder<T extends { id: number }>(prev: T[], incoming: T[]): T[] {
  if (!prev.length) return incoming;
  const map = new Map(incoming.map((r) => [r.id, r]));
  const out: T[] = [];
  const seen = new Set<number>();
  for (const r of prev) {
    const u = map.get(r.id);
    if (u) {
      out.push(u);
      seen.add(r.id);
    }
  }
  for (const r of incoming) {
    if (!seen.has(r.id)) out.push(r);
  }
  return out.length ? out : incoming;
}
