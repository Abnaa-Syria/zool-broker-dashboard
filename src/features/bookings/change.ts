import { sudanDate } from '../../lib/dates';
import { compareSeatLabels } from '../booking/seats';
import type { Booking, BookingTicket, ChangeQuote } from './types';

/**
 * D-CHG-01 helpers. The API pairs passengers and seats by seat-label order on both sides:
 * the current CONFIRMED tickets sorted by label ↔ the new seats sorted by label.
 */

/** Seat / trip changes are offered for CONFIRMED bookings whose trip has not left, to `broker.book` holders. */
export function canChangeBooking(booking: Pick<Booking, 'status' | 'trip'>, canBook: boolean, now: Date = new Date()): boolean {
  return canBook && booking.status === 'CONFIRMED' && new Date(booking.trip.departureAt).getTime() > now.getTime();
}

/** CONFIRMED tickets in seat-label order (the API's passenger order for a change). */
export function activeTickets(booking: Pick<Booking, 'tickets'>): BookingTicket[] {
  return booking.tickets
    .filter((t) => t.status === 'CONFIRMED')
    .sort((a, b) => compareSeatLabels(a.seatLabel ?? '', b.seatLabel ?? ''));
}

/** Passenger → new seat label, in the API's order. Missing labels stay null. */
export function pairNewSeats(
  booking: Pick<Booking, 'tickets'>,
  newSeatLabels: readonly string[],
): Array<{ passengerName: string; oldSeat: string | null; newSeat: string | null }> {
  const sorted = [...newSeatLabels].sort(compareSeatLabels);
  return activeTickets(booking).map((t, i) => ({ passengerName: t.passengerName ?? '—', oldSeat: t.seatLabel, newSeat: sorted[i] ?? null }));
}

/** Net wallet effect of a trip change: debit (pay), credit (refund) or nothing. */
export function walletEffect(q: Pick<ChangeQuote, 'payMinor' | 'refundMinor'>): { kind: 'pay' | 'refund' | 'none'; amountMinor: number } {
  if (q.payMinor > 0) return { kind: 'pay', amountMinor: q.payMinor };
  if (q.refundMinor > 0) return { kind: 'refund', amountMinor: q.refundMinor };
  return { kind: 'none', amountMinor: 0 };
}

/** Default day for change options: the booking's departure day (Sudan), not before today. */
export function defaultChangeDate(departureAt: string, now: Date = new Date()): string {
  const day = sudanDate(new Date(departureAt));
  const today = sudanDate(now);
  return day < today ? today : day;
}
