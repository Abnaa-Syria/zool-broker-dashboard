import { describe, expect, it } from 'vitest';
import { resizeDrafts, toPassengerInput, validatePassenger, womenOnlyPassengers } from './passengers';
import {
  failedLeg,
  filterReturnTrips,
  INITIAL_SEARCH,
  isValidReturn,
  outboundSearch,
  quoteCommission,
  quoteTotal,
  returnNotBefore,
  returnSearch,
  searchError,
  withinCeiling,
  type BookingSearch,
} from './roundTrip';
import type { BookingQuote } from './types';

const rt = (patch: Partial<BookingSearch> = {}): BookingSearch => ({
  ...INITIAL_SEARCH,
  tripType: 'ROUND_TRIP',
  fromCityId: 'KRT',
  toCityId: 'PZU',
  date: '2026-11-23',
  returnDate: '2026-11-24',
  passengers: 2,
  ...patch,
});

const quote = (patch: Partial<BookingQuote> = {}): BookingQuote => ({
  tripId: 't1',
  seats: [],
  seatCount: 2,
  unitPriceMinor: 1000,
  totalAmountMinor: 2000,
  commissionPercent: 10,
  expectedCommissionMinor: 200,
  walletBalanceMinor: 10_000,
  balanceAfterMinor: 8000,
  sufficientBalance: true,
  heldByMe: true,
  exposure: { ceiling: 10, usedToday: 6, remaining: 4, withinCeiling: true },
  ...patch,
});

describe('round trip search', () => {
  it('one way keeps the old rules (only different cities)', () => {
    expect(searchError({ ...INITIAL_SEARCH })).toBeNull();
    expect(searchError({ ...INITIAL_SEARCH, fromCityId: 'A', toCityId: 'A' })).toMatch(/مختلفتين/);
  });

  it('round trip needs both cities, both dates and return on or after the outbound day', () => {
    expect(searchError(rt())).toBeNull();
    expect(searchError(rt({ returnDate: '2026-11-23' }))).toBeNull(); // same day is allowed
    expect(searchError(rt({ toCityId: '' }))).not.toBeNull();
    expect(searchError(rt({ date: '' }))).not.toBeNull();
    expect(searchError(rt({ returnDate: '' }))).not.toBeNull();
    expect(searchError(rt({ returnDate: '2026-11-22' }))).toMatch(/العودة/);
  });

  it('return search swaps the cities on the return date; outbound search drops the extra fields', () => {
    expect(returnSearch(rt())).toEqual({ fromCityId: 'PZU', toCityId: 'KRT', date: '2026-11-24', passengers: 2 });
    expect(outboundSearch(rt())).toEqual({ fromCityId: 'KRT', toCityId: 'PZU', date: '2026-11-23', passengers: 2 });
  });
});

describe('round trip leg order', () => {
  const outbound = { departureAt: '2026-11-23T05:00:00.000Z', arrivalAt: '2026-11-23T17:00:00.000Z' };

  it('return must leave at or after the outbound arrival (departure when no arrival)', () => {
    expect(returnNotBefore(outbound)).toBe(outbound.arrivalAt);
    expect(returnNotBefore({ ...outbound, arrivalAt: null })).toBe(outbound.departureAt);
    expect(isValidReturn(outbound, { departureAt: '2026-11-23T17:00:00.000Z' })).toBe(true);
    expect(isValidReturn(outbound, { departureAt: '2026-11-23T16:59:00.000Z' })).toBe(false);
    expect(isValidReturn({ ...outbound, arrivalAt: null }, { departureAt: '2026-11-23T06:00:00.000Z' })).toBe(true);
  });

  it('filters the return results and counts the hidden ones', () => {
    const early = { id: 'a', departureAt: '2026-11-23T10:00:00.000Z', arrivalAt: null };
    const late = { id: 'b', departureAt: '2026-11-24T05:00:00.000Z', arrivalAt: null };
    expect(filterReturnTrips(outbound, [early, late])).toEqual({ trips: [late], hidden: 1 });
  });
});

describe('round trip quote', () => {
  const back = quote({ tripId: 't2', totalAmountMinor: 3000, expectedCommissionMinor: 300 });

  it('uses the combined totals when there is a return leg', () => {
    expect(quoteTotal(quote())).toBe(2000);
    expect(quoteCommission(quote())).toBe(200);
    const q = quote({ returnLeg: back, combinedTotalMinor: 5000, combinedCommissionMinor: 500 });
    expect(quoteTotal(q)).toBe(5000);
    expect(quoteCommission(q)).toBe(500);
  });

  it('checks the daily ticket ceiling against both legs', () => {
    expect(withinCeiling(quote())).toBe(true); // 6 + 2 <= 10
    expect(withinCeiling(quote({ returnLeg: back }))).toBe(true); // 6 + 4 <= 10
    expect(withinCeiling(quote({ returnLeg: back, exposure: { ceiling: 9, usedToday: 6, remaining: 3, withinCeiling: true } }))).toBe(false);
  });

  it('finds the leg a seat error is about', () => {
    expect(failedLeg({ unavailableSeatIds: ['r1'] }, ['o1', 'o2'], ['r1', 'r2'])).toBe('return');
    expect(failedLeg({ seatIds: ['o1', 'o2'] }, ['o1', 'o2'], ['r1', 'r2'])).toBe('outbound');
    expect(failedLeg({ seatIds: ['o1', 'r1'] }, ['o1'], ['r1'])).toBe('outbound');
    expect(failedLeg(undefined, ['o1'], ['r1'])).toBe('outbound');
  });
});

describe('passenger gender and women-only seats', () => {
  const ok = { fullName: 'فاطمة', phone: '+249912345678', idNumber: '' };

  it('requires FEMALE for a women-only seat, gender stays optional elsewhere', () => {
    expect(validatePassenger(ok)).toEqual({});
    expect(validatePassenger({ ...ok, gender: 'MALE' })).toEqual({});
    expect(validatePassenger(ok, { womenOnly: true }).gender).toBeDefined();
    expect(validatePassenger({ ...ok, gender: '' }, { womenOnly: true }).gender).toBeDefined();
    expect(validatePassenger({ ...ok, gender: 'MALE' }, { womenOnly: true }).gender).toBeDefined();
    expect(validatePassenger({ ...ok, gender: 'FEMALE' }, { womenOnly: true })).toEqual({});
  });

  it('sends gender only when chosen', () => {
    expect(toPassengerInput({ ...ok, gender: '' })).not.toHaveProperty('gender');
    expect(toPassengerInput({ ...ok, gender: 'FEMALE' }).gender).toBe('FEMALE');
  });

  it('maps passenger i to seat i on every leg', () => {
    const w = { isWomenOnly: true };
    const n = { isWomenOnly: false };
    expect(womenOnlyPassengers(3, [[n, w, n]])).toEqual([false, true, false]);
    expect(womenOnlyPassengers(2, [[n, n], [w, n]])).toEqual([true, false]); // women-only on the return leg only
    expect(womenOnlyPassengers(2, [[n]])).toEqual([false, false]);
  });

  it('new drafts start without gender', () => {
    expect(resizeDrafts([], 1)[0].gender).toBe('');
  });
});
