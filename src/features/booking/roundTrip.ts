import type { TripSearch } from './api';
import type { BookingQuote } from './types';

/**
 * Round trip (D-RT-01): outbound A→B, then the return B→A on the return date, leaving after the
 * outbound arrives. Same passengers on both legs (passenger i ↔ seat i of each leg).
 */
export type TripType = 'ONE_WAY' | 'ROUND_TRIP';

/** Search form: the trip search + trip type and return date. */
export type BookingSearch = TripSearch & { tripType: TripType; returnDate: string };

export const INITIAL_SEARCH: BookingSearch = { fromCityId: '', toCityId: '', date: '', passengers: 1, tripType: 'ONE_WAY', returnDate: '' };

/** Only the GET /broker/trips fields (keeps the query key stable while editing the return date). */
export function outboundSearch(s: BookingSearch): TripSearch {
  return { fromCityId: s.fromCityId, toCityId: s.toCityId, date: s.date, passengers: s.passengers };
}

/** Return leg search: swapped cities on the return date. */
export function returnSearch(s: BookingSearch): TripSearch {
  return { fromCityId: s.toCityId, toCityId: s.fromCityId, date: s.returnDate, passengers: s.passengers };
}

/** Arabic validation message for the search form, or null when it can be submitted. */
export function searchError(s: BookingSearch): string | null {
  if (s.fromCityId !== '' && s.fromCityId === s.toCityId) return 'اختر مدينتين مختلفتين.';
  if (s.tripType === 'ROUND_TRIP') {
    if (!s.fromCityId || !s.toCityId) return 'حدّد مدينتي الذهاب والوصول لرحلة ذهاب وعودة.';
    if (!s.date) return 'حدّد تاريخ الذهاب.';
    if (!s.returnDate) return 'حدّد تاريخ العودة.';
    if (s.returnDate < s.date) return 'تاريخ العودة يجب أن يكون في يوم الذهاب أو بعده.';
  }
  return null;
}

type LegTimes = { departureAt: string; arrivalAt: string | null };

/** Earliest allowed departure of the return trip: the outbound arrival (its departure when unknown), like the API. */
export function returnNotBefore(outbound: LegTimes): string {
  return outbound.arrivalAt ?? outbound.departureAt;
}

/** The API rejects a return that leaves before the outbound arrives (ROUND_TRIP_INVALID). */
export function isValidReturn(outbound: LegTimes, candidate: Pick<LegTimes, 'departureAt'>): boolean {
  return new Date(candidate.departureAt).getTime() >= new Date(returnNotBefore(outbound)).getTime();
}

/** Split search results into selectable return trips and the ones hidden by the leg-order rule. */
export function filterReturnTrips<T extends LegTimes>(outbound: LegTimes, trips: readonly T[]): { trips: T[]; hidden: number } {
  const ok = trips.filter((t) => isValidReturn(outbound, t));
  return { trips: ok, hidden: trips.length - ok.length };
}

/** Wallet total for the quote: both legs for a round trip. */
export function quoteTotal(q: BookingQuote): number {
  return q.combinedTotalMinor ?? q.totalAmountMinor;
}

export function quoteCommission(q: BookingQuote): number {
  return q.combinedCommissionMinor ?? q.expectedCommissionMinor;
}

/**
 * Daily ticket ceiling: confirm counts the tickets of BOTH legs, while each leg's quote only checks
 * its own seats; so the combined check is done here.
 */
export function withinCeiling(q: BookingQuote): boolean {
  const tickets = q.seatCount + (q.returnLeg?.seatCount ?? 0);
  return q.exposure.usedToday + tickets <= q.exposure.ceiling;
}

/**
 * Which leg a confirm error (SEAT_UNAVAILABLE / HOLD_REQUIRED …) is about, from the seat ids in its
 * details. 'return' only when it names return seats and no outbound seat; otherwise 'outbound'.
 */
export function failedLeg(details: unknown, outboundSeatIds: readonly string[], returnSeatIds: readonly string[]): 'outbound' | 'return' {
  const ids = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') ids.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(details);
  const hitsReturn = returnSeatIds.some((id) => ids.has(id));
  const hitsOutbound = outboundSeatIds.some((id) => ids.has(id));
  return hitsReturn && !hitsOutbound ? 'return' : 'outbound';
}
