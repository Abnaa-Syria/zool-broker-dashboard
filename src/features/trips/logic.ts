import { sudanDate } from '../../lib/dates';
import type { BookingSearch } from '../booking/roundTrip';
import type { BrokerTrip } from '../booking/types';

/** "5 س 30 د" / "45 د"; null or negative → "—". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} د`;
  return m === 0 ? `${h} س` : `${h} س ${m} د`;
}

export function serviceClassLabel(c: string): string {
  return c === 'VIP' ? 'VIP' : c === 'STANDARD' ? 'عادية' : c;
}

export function stopKindLabel(kind: string): string {
  switch (kind) {
    case 'ORIGIN':
      return 'نقطة الانطلاق';
    case 'DESTINATION':
      return 'الوصول';
    default:
      return 'توقف';
  }
}

/** Intermediate stops only (the API's stop list includes the origin and destination). */
export function intermediateStops<T extends { kind: string }>(stops: readonly T[]): T[] {
  return stops.filter((s) => s.kind === 'STOP');
}

/** Seat-occupancy percentage (sold + held) rounded; 0 when the trip has no seats. */
export function occupancyPercent(a: { free: number; held: number; sold: number; total: number }): number {
  if (a.total <= 0) return 0;
  return Math.round(((a.sold + a.held) / a.total) * 100);
}

/**
 * Search that the booking flow starts from when "book this trip" is pressed on a trip page:
 * the trip's cities and Sudan departure day, one-way.
 */
export function searchForTrip(trip: Pick<BrokerTrip, 'origin' | 'destination' | 'departureAt'>, passengers = 1): BookingSearch {
  return {
    fromCityId: trip.origin.city.id ?? '',
    toCityId: trip.destination.city.id ?? '',
    date: sudanDate(new Date(trip.departureAt)),
    passengers: Math.max(1, passengers),
    tripType: 'ONE_WAY',
    returnDate: '',
  };
}
