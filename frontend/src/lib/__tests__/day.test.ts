import { describe, it, expect } from 'vitest';
import {
  logicalDate,
  isEditable,
  weekStart,
  weekEnd,
  weekDates,
  minutesSinceRollover,
  hhmmToMinutes,
  daysBetween,
  addDays,
} from '../day';

describe('logicalDate', () => {
  it('rolls over at 4am IST: 2am counts as the previous day', () => {
    // 2026-01-10T02:00:00 IST == 2026-01-09T20:30:00Z
    const d = logicalDate('2026-01-09T20:30:00Z');
    expect(d).toBe('2026-01-09');
  });

  it('5am IST counts as the new day', () => {
    // 2026-01-10T05:00:00 IST == 2026-01-09T23:30:00Z
    const d = logicalDate('2026-01-09T23:30:00Z');
    expect(d).toBe('2026-01-10');
  });

  it('11pm IST is the current calendar day', () => {
    // 2026-01-10T23:00:00 IST == 2026-01-10T17:30:00Z
    const d = logicalDate('2026-01-10T17:30:00Z');
    expect(d).toBe('2026-01-10');
  });

  it('respects a custom rollover hour', () => {
    const d = logicalDate('2026-01-10T01:00:00Z', 0); // 06:30 IST, rollover at midnight
    expect(d).toBe('2026-01-10');
  });
});

describe('isEditable', () => {
  const now = new Date('2026-01-10T12:00:00Z'); // ~17:30 IST -> logical date 2026-01-10
  it('allows today', () => {
    expect(isEditable('2026-01-10', 4, 3, now)).toBe(true);
  });
  it('allows within the backfill window', () => {
    expect(isEditable('2026-01-08', 4, 3, now)).toBe(true);
    expect(isEditable('2026-01-07', 4, 3, now)).toBe(true);
  });
  it('rejects dates older than the backfill window', () => {
    expect(isEditable('2026-01-06', 4, 3, now)).toBe(false);
  });
  it('rejects future dates', () => {
    expect(isEditable('2026-01-11', 4, 3, now)).toBe(false);
  });
});

describe('week helpers', () => {
  it('finds the Monday of the week for a mid-week date', () => {
    expect(weekStart('2026-01-14')).toBe('2026-01-12'); // Wed -> Mon
  });
  it('finds the Monday for a Sunday date (end of ISO week)', () => {
    expect(weekStart('2026-01-18')).toBe('2026-01-12');
  });
  it('weekEnd is Sunday', () => {
    expect(weekEnd('2026-01-14')).toBe('2026-01-18');
  });
  it('weekDates returns all 7 days Mon-Sun', () => {
    expect(weekDates('2026-01-12')).toEqual([
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
      '2026-01-17',
      '2026-01-18',
    ]);
  });
});

describe('minutesSinceRollover', () => {
  it('orders a late bedtime after an earlier one, across midnight', () => {
    const elevenOhSeven = minutesSinceRollover(hhmmToMinutes('23:07'));
    const halfPastMidnight = minutesSinceRollover(hhmmToMinutes('00:30'));
    expect(halfPastMidnight).toBeGreaterThan(elevenOhSeven);
  });
  it('maps the rollover hour itself to 0', () => {
    expect(minutesSinceRollover(hhmmToMinutes('04:00'), 4)).toBe(0);
  });
});

describe('daysBetween / addDays', () => {
  it('is inclusive of both endpoints', () => {
    expect(daysBetween('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
  it('addDays supports negative offsets', () => {
    expect(addDays('2026-01-03', -2)).toBe('2026-01-01');
  });
});
