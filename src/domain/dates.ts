/** Date helpers working on ISO dates (YYYY-MM-DD) in the device's local time zone. Catalan labels. */

const MONTHS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const MONTHS_SHORT = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
const WEEKDAYS = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "22 nov." */
export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Avui", "Ahir" or "Dijous, 20 nov." */
export function formatDayHeading(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Avui';
  if (iso === addDays(today, -1)) return 'Ahir';
  const d = parseISODate(iso);
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatShortDate(iso)}`;
}

/** "Novembre 2026" (month is 1-12). */
export function formatMonth(year: number, month: number): string {
  const name = MONTHS[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
