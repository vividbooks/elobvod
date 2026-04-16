/**
 * Kořen aplikace (např. "" nebo "/elobvod") podle Vite `base`.
 */
export function appBasePath(): string {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** Absolutní URL stránky úkolu pro studenta. */
export function assignmentPublicUrl(assignmentId: string): string {
  const path = `${appBasePath()}/ukol/${assignmentId}`;
  return `${window.location.origin}${path}`;
}

/** Absolutní URL odevzdané práce (pro učitele). */
export function submissionPublicUrl(submissionId: string): string {
  const path = `${appBasePath()}/odpoved/${submissionId}`;
  return `${window.location.origin}${path}`;
}
