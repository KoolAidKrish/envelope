// Event times are entered in the event's own time zone and stored in UTC.

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset in ms between a time zone's wall clock and UTC at a given instant. */
function offsetAt(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** "2026-11-14T19:00" in "America/Edmonton" → Date (UTC). */
export function localInputToDate(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = wall - offsetAt(wall, tz);
  guess = wall - offsetAt(guess, tz); // second pass settles DST boundaries
  return new Date(guess);
}

/** Date → "2026-11-14T19:00" on the event's wall clock, for <input type="datetime-local">. */
export function dateToLocalInput(date: Date | null | undefined, tz: string): string {
  if (!date) return '';
  const shifted = new Date(date.getTime() + offsetAt(date.getTime(), tz));
  return shifted.toISOString().slice(0, 16);
}

function fmt(date: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(date);
}

export function eventDateParts(start: Date, end: Date | null, tz: string) {
  const time = (d: Date) => fmt(d, tz, { hour: 'numeric', minute: '2-digit' });
  const sameDay = end && fmt(start, tz, { dateStyle: 'short' }) === fmt(end, tz, { dateStyle: 'short' });
  return {
    weekday: fmt(start, tz, { weekday: 'long' }),
    day: fmt(start, tz, { day: 'numeric' }),
    month: fmt(start, tz, { month: 'long' }),
    year: fmt(start, tz, { year: 'numeric' }),
    fullDate: fmt(start, tz, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    timeRange: end
      ? sameDay
        ? `${time(start)} – ${time(end)}`
        : `${time(start)} – ${fmt(end, tz, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time(end)}`
      : time(start),
    zone: fmt(start, tz, { timeZoneName: 'short' }).split(' ').pop() ?? '',
  };
}

export function shortDate(date: Date, tz: string): string {
  return fmt(date, tz, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "in 12 days", "tomorrow", "today", "happened 3 days ago" */
export function relativeDay(start: Date, tz: string, now = new Date()): string {
  const dayNumber = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day')) / 86400e3;
  };
  const diff = Math.round(dayNumber(start) - dayNumber(now));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return 'Yesterday';
  return `${-diff} days ago`;
}

export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
