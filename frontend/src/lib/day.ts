import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/** India has no DST, so a fixed UTC+05:30 offset is correct and needs no tz database. */
export const IST_OFFSET_MINUTES = 330;

/** Returns a dayjs (in UTC mode) whose wall-clock fields are IST local time, regardless of host timezone. */
export function istMoment(instant: Date | number | string = new Date()): Dayjs {
  return dayjs.utc(instant).add(IST_OFFSET_MINUTES, 'minute');
}

/**
 * The "day" rolls over at `rolloverHour` (default 4am IST), so logging between
 * midnight and the rollover still counts for the previous calendar day.
 */
export function logicalDate(instant: Date | number | string = new Date(), rolloverHour = 4): string {
  return istMoment(instant).subtract(rolloverHour, 'hour').format('YYYY-MM-DD');
}

export function today(rolloverHour = 4): string {
  return logicalDate(new Date(), rolloverHour);
}

/** A logical date is editable if it's today or within the last `backfillDays` days. */
export function isEditable(date: string, rolloverHour = 4, backfillDays = 3, now: Date = new Date()): boolean {
  const todayStr = logicalDate(now, rolloverHour);
  const earliest = dayjs(todayStr).subtract(backfillDays, 'day');
  const target = dayjs(date);
  return !target.isBefore(earliest, 'day') && !target.isAfter(dayjs(todayStr), 'day');
}

export function daysBetween(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let cur = dayjs(startDate);
  const end = dayjs(endDate);
  while (!cur.isAfter(end, 'day')) {
    out.push(cur.format('YYYY-MM-DD'));
    cur = cur.add(1, 'day');
  }
  return out;
}

export function addDays(date: string, n: number): string {
  return dayjs(date).add(n, 'day').format('YYYY-MM-DD');
}

export function diffDays(a: string, b: string): number {
  return dayjs(a).diff(dayjs(b), 'day');
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const d = dayjs(date);
  const isoDay = (d.day() + 6) % 7; // Monday = 0 ... Sunday = 6
  return d.subtract(isoDay, 'day').format('YYYY-MM-DD');
}

export function weekEnd(date: string): string {
  return addDays(weekStart(date), 6);
}

/** Stable key (the Monday) for grouping logs into a week. */
export function weekKey(date: string): string {
  return weekStart(date);
}

export function weekDates(mondayDate: string): string[] {
  return daysBetween(mondayDate, addDays(mondayDate, 6));
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60) % 24;
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Maps a minutes-of-day (0..1439) wall-clock value onto a continuous minutes-since-rollover
 * axis, so a bedtime just after midnight sorts as *later* than one at 11pm instead of wrapping to 0.
 */
export function minutesSinceRollover(minutesOfDay: number, rolloverHour = 4): number {
  const rolloverMin = rolloverHour * 60;
  let delta = minutesOfDay - rolloverMin;
  if (delta < 0) delta += 24 * 60;
  return delta;
}

export function isSameOrBefore(dateA: string, dateB: string): boolean {
  return !dayjs(dateA).isAfter(dayjs(dateB), 'day');
}
