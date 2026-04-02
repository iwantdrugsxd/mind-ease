/** Shared Tailwind fragments — clinician internal app (not landing). */

export const clinPanel =
  'rounded-xl border border-slate-200/90 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(15,23,42,0.08)] backdrop-blur-sm';

export const clinPanelMuted =
  'rounded-xl border border-slate-200/70 bg-slate-50/80 shadow-sm backdrop-blur-sm';

export const clinPanelHeader = 'px-4 py-3 border-b border-slate-100/90 bg-slate-50/90';

export const clinPanelAccentTop =
  'h-1 w-full rounded-t-xl bg-gradient-to-r from-slate-800 via-primary-600 to-slate-800 shrink-0';

export const clinInput =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-[border-color,box-shadow] duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export const clinLabel = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5';

export const clinBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0';

export const clinBtnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-px active:translate-y-0 disabled:opacity-50';

export const clinTableHead =
  'bg-slate-50/95 border-b border-slate-200/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500';

export const clinTableRow =
  'transition-colors duration-200 hover:bg-slate-50/95 clinician-triage-row';

/** In-page section title (below global header) */
export const clinEyebrow = 'text-[10px] font-bold uppercase tracking-[0.2em] text-primary-800/90';

export const clinSectionTitle = 'text-base font-bold text-slate-900 tracking-tight';

export const clinSectionDesc = 'text-sm text-slate-600 mt-1 font-medium leading-relaxed';

/** Console page content wrapper — pairs with CSS stagger */
export const clinConsoleStack = 'space-y-6 clinician-console-stack';
