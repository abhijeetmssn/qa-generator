// Date helpers for product manufacturing / expiry dates.
// Products can store dates at two precisions:
//   - month + year       → "YYYY-MM"
//   - day + month + year → "YYYY-MM-DD"
// All formatting uses LOCAL date parts (never toISOString) to avoid the
// UTC off-by-one shift for users in timezones like IST.

export type DatePrecision = 'month' | 'day';

/** Format a Date as "YYYY-MM" using local time. */
export function toMonthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Format a Date as "YYYY-MM-DD" using local time. */
export function toDayStr(date: Date): string {
  return `${toMonthStr(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Format a Date at the given precision. */
export function formatByPrecision(date: Date, precision: DatePrecision): string {
  return precision === 'day' ? toDayStr(date) : toMonthStr(date);
}

/** Parse a stored "YYYY-MM" or "YYYY-MM-DD" string into a local Date. */
export function parseDateStr(val?: string | null): Date | null {
  if (!val) return null;
  const [y, m, d] = val.split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, d || 1);
}

/** True if the stored value carries a day component. */
export function hasDayPart(val?: string | null): boolean {
  return !!val && val.split('-').length >= 3;
}

/**
 * Display a stored date string.
 *  - "YYYY-MM-DD" → "DD/MM/YYYY"
 *  - "YYYY-MM"    → "MM/YY"
 */
export function formatProductDate(val?: string): string {
  if (!val) return '—';
  const [year, month, day] = val.split('-');
  if (!year || !month) return val;
  if (day) return `${day}/${month}/${year}`;
  return `${month}/${year.slice(-2)}`;
}
