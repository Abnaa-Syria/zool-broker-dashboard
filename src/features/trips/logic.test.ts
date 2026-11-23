import { describe, expect, it } from 'vitest';
import { formatDuration, intermediateStops, occupancyPercent, searchForTrip, serviceClassLabel, stopKindLabel } from './logic';

describe('trip logic', () => {
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
    expect(formatDuration(45)).toBe('45 د');
    expect(formatDuration(120)).toBe('2 س');
    expect(formatDuration(330)).toBe('5 س 30 د');
  });

  it('labels', () => {
    expect(serviceClassLabel('VIP')).toBe('VIP');
    expect(serviceClassLabel('STANDARD')).toBe('عادية');
    expect(stopKindLabel('ORIGIN')).toBe('نقطة الانطلاق');
    expect(stopKindLabel('STOP')).toBe('توقف');
  });

  it('keeps only intermediate stops', () => {
    expect(intermediateStops([{ kind: 'ORIGIN' }, { kind: 'STOP' }, { kind: 'DESTINATION' }])).toEqual([{ kind: 'STOP' }]);
  });

  it('occupancy', () => {
    expect(occupancyPercent({ free: 0, held: 0, sold: 0, total: 0 })).toBe(0);
    expect(occupancyPercent({ free: 30, held: 2, sold: 8, total: 40 })).toBe(25);
  });

  it('builds the flow search for a trip (Sudan day)', () => {
    const s = searchForTrip(
      {
        origin: { station: null, city: { id: 'c1', code: null, nameAr: 'أ', nameEn: 'A' } },
        destination: { station: null, city: { id: null, code: null, nameAr: 'ب', nameEn: 'B' } },
        departureAt: '2026-11-23T23:30:00.000Z',
      },
      0,
    );
    expect(s).toEqual({ fromCityId: 'c1', toCityId: '', date: '2026-11-24', passengers: 1, tripType: 'ONE_WAY', returnDate: '' });
  });
});
