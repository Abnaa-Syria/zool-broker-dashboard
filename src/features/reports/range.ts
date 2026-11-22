import { lastDays, sudanDate } from '../../lib/dates';

/** Inclusive Sudan calendar days (YYYY-MM-DD); the API treats date-only bounds as Sudan days. */
export type DateRange = { from: string; to: string };

export const RANGE_PRESETS = [
  { key: 'today', label: 'اليوم' },
  { key: '7days', label: 'آخر 7 أيام' },
  { key: '30days', label: 'آخر 30 يومًا' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'custom', label: 'مخصص' },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]['key'];

export function presetRange(key: Exclude<RangePresetKey, 'custom'>, now: Date = new Date()): DateRange {
  switch (key) {
    case 'today':
      return lastDays(1, now);
    case '7days':
      return lastDays(7, now);
    case '30days':
      return lastDays(30, now);
    case 'month': {
      const to = sudanDate(now);
      return { from: `${to.slice(0, 8)}01`, to };
    }
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Arabic validation message, or null when the range can be sent. */
export function validateRange(range: DateRange): string | null {
  if (!range.from || !range.to) return 'اختر تاريخ البداية والنهاية.';
  if (!DATE_ONLY.test(range.from) || !DATE_ONLY.test(range.to)) return 'صيغة التاريخ غير صحيحة.';
  if (range.from > range.to) return 'تاريخ البداية يجب أن يسبق تاريخ النهاية.';
  return null;
}
