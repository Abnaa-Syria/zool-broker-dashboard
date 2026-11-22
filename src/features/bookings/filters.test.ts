import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, dateRange, filtersFromParams, filtersToParams, matchesSearch, toBookingsQuery } from './filters';
import type { Booking } from './types';

// 2026-11-22 01:00 Khartoum (UTC+2) = 2026-11-21 23:00 UTC
const NOW = new Date('2026-11-21T23:00:00Z');

describe('bookings filters', () => {
  it('uses Sudan days for presets', () => {
    expect(dateRange({ range: 'today', from: '', to: '' }, NOW)).toEqual({ from: '2026-11-22', to: '2026-11-22' });
    expect(dateRange({ range: '7days', from: '', to: '' }, NOW)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(dateRange({ range: 'all', from: '', to: '' }, NOW)).toEqual({});
  });

  it('swaps an inverted custom range', () => {
    expect(dateRange({ range: 'custom', from: '2026-11-20', to: '2026-11-01' })).toEqual({ from: '2026-11-01', to: '2026-11-20' });
    expect(dateRange({ range: 'custom', from: '2026-11-01', to: '' })).toEqual({ from: '2026-11-01', to: undefined });
  });

  it('builds the API query and only sends employeeId when allowed', () => {
    const f = { ...DEFAULT_FILTERS, tab: 'CANCELLED' as const, employeeId: 'e1', companyId: 'c1', page: 2 };
    expect(toBookingsQuery(f, { canFilterEmployee: false }, NOW)).toEqual({ page: 2, pageSize: 20, status: 'CANCELLED', companyId: 'c1' });
    expect(toBookingsQuery(f, { canFilterEmployee: true }, NOW).employeeId).toBe('e1');
    expect(toBookingsQuery(DEFAULT_FILTERS, { canFilterEmployee: true }, NOW)).toEqual({ page: 1, pageSize: 20 });
  });

  it('round-trips through URL params and rejects junk', () => {
    const f = { ...DEFAULT_FILTERS, tab: 'CONFIRMED' as const, range: 'custom' as const, from: '2026-11-01', to: '2026-11-05', page: 3 };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersFromParams(new URLSearchParams('status=X&range=y&from=bad&page=-1'))).toEqual(DEFAULT_FILTERS);
  });

  it('searches reference, passengers and ticket numbers', () => {
    const b = {
      id: 'cm123',
      bookingRef: 'ZG-ABC',
      trip: { origin: 'Khartoum', destination: 'Kassala' },
      passengers: [{ fullName: 'Ahmed Ali', phone: '+249912345678' }],
      tickets: [{ ticketNumber: 'ZG-20261122-ABCDE' }],
    } as unknown as Booking;
    expect(matchesSearch(b, '')).toBe(true);
    expect(matchesSearch(b, 'zg-abc')).toBe(true);
    expect(matchesSearch(b, 'ahmed')).toBe(true);
    expect(matchesSearch(b, '912345')).toBe(true);
    expect(matchesSearch(b, 'ABCDE')).toBe(true);
    expect(matchesSearch(b, 'port sudan')).toBe(false);
  });
});
