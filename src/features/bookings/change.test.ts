import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import { changeNotAllowedMessage, errorMessage } from '../../lib/api/errors';
import { activeTickets, canChangeBooking, defaultChangeDate, pairNewSeats, walletEffect } from './change';
import { DEFAULT_FILTERS, filtersFromParams, toBookingsQuery } from './filters';
import { boardingStatusLabel, bookingStatusLabel, ticketQrValue, ticketStatusLabel } from './labels';
import type { BookingTicket } from './types';

const ticket = (seatLabel: string, patch: Partial<BookingTicket> = {}): BookingTicket => ({
  id: `t-${seatLabel}`,
  ticketNumber: `ZG-${seatLabel}`,
  status: 'CONFIRMED',
  seatId: `s-${seatLabel}`,
  seatLabel,
  passengerId: `p-${seatLabel}`,
  passengerName: `P${seatLabel}`,
  boardingStatus: 'PENDING',
  qrPayload: null,
  ...patch,
});

const NOW = new Date('2026-11-22T12:00:00.000Z');
const trip = (departureAt: string) => ({ id: 't', origin: 'A', destination: 'B', departureAt, company: { id: 'c', key: 'k', name: 'C' } });

describe('booking change rules', () => {
  it('only confirmed, not departed, with broker.book', () => {
    const future = trip('2026-11-23T05:00:00.000Z');
    expect(canChangeBooking({ status: 'CONFIRMED', trip: future }, true, NOW)).toBe(true);
    expect(canChangeBooking({ status: 'CONFIRMED', trip: future }, false, NOW)).toBe(false);
    expect(canChangeBooking({ status: 'CHANGED', trip: future }, true, NOW)).toBe(false);
    expect(canChangeBooking({ status: 'CANCELLED', trip: future }, true, NOW)).toBe(false);
    expect(canChangeBooking({ status: 'CONFIRMED', trip: trip('2026-11-22T11:00:00.000Z') }, true, NOW)).toBe(false);
  });

  it('pairs passengers and new seats by seat-label order, like the API', () => {
    const tickets = [ticket('10'), ticket('2'), ticket('5', { status: 'CANCELLED' })];
    expect(activeTickets({ tickets }).map((t) => t.seatLabel)).toEqual(['2', '10']);
    expect(pairNewSeats({ tickets }, ['14', '3'])).toEqual([
      { passengerName: 'P2', oldSeat: '2', newSeat: '3' },
      { passengerName: 'P10', oldSeat: '10', newSeat: '14' },
    ]);
  });

  it('wallet effect: debit, credit or nothing', () => {
    expect(walletEffect({ payMinor: 500, refundMinor: 0 })).toEqual({ kind: 'pay', amountMinor: 500 });
    expect(walletEffect({ payMinor: 0, refundMinor: 300 })).toEqual({ kind: 'refund', amountMinor: 300 });
    expect(walletEffect({ payMinor: 0, refundMinor: 0 })).toEqual({ kind: 'none', amountMinor: 0 });
  });

  it('defaults the options day to the departure day in Sudan, never before today', () => {
    expect(defaultChangeDate('2026-11-24T22:30:00.000Z', NOW)).toBe('2026-11-25'); // 00:30 next day in Khartoum (UTC+2)
    expect(defaultChangeDate('2026-11-01T10:00:00.000Z', NOW)).toBe('2026-11-22');
  });

  it('explains CHANGE_NOT_ALLOWED from its details', () => {
    expect(changeNotAllowedMessage({ cutoffMinutes: 120 })).toMatch(/120/);
    expect(changeNotAllowedMessage({ max: 2 })).toMatch(/\(2\)/);
    expect(changeNotAllowedMessage(undefined)).toBe('لا يمكن تعديل هذا الحجز.');
    expect(errorMessage(new ApiError({ status: 409, code: 'CHANGE_NOT_ALLOWED', message: 'x', details: { max: 1 } }))).toMatch(/\(1\)/);
    expect(errorMessage(new ApiError({ status: 422, code: 'WOMEN_ONLY_SEAT', message: 'x' }))).toMatch(/للسيدات/);
    expect(errorMessage(new ApiError({ status: 422, code: 'ROUND_TRIP_INVALID', message: 'x' }))).toMatch(/العودة/);
  });

  it('CHANGED status everywhere: label, list filter and query', () => {
    expect(bookingStatusLabel('CHANGED').label).toBe('مُعدّل');
    expect(ticketStatusLabel('CHANGED')).toMatch(/مستبدلة/);
    expect(filtersFromParams(new URLSearchParams('status=CHANGED')).tab).toBe('CHANGED');
    expect(toBookingsQuery({ ...DEFAULT_FILTERS, tab: 'CHANGED' }, { canFilterEmployee: false }).status).toBe('CHANGED');
  });
});

describe('tickets: QR and boarding', () => {
  it('encodes the signed payload, falling back to the ticket number', () => {
    expect(ticketQrValue('ZG-1', 'signed.abc', 'doc.copy')).toBe('signed.abc');
    expect(ticketQrValue('ZG-1', null, 'doc.copy')).toBe('doc.copy');
    expect(ticketQrValue('ZG-1', null, undefined)).toBe('ZG-1');
    expect(ticketQrValue('ZG-1', '')).toBe('ZG-1');
  });

  it('labels boarding status', () => {
    expect(boardingStatusLabel('BOARDED')).toEqual({ label: 'صعد الحافلة', variant: 'success' });
    expect(boardingStatusLabel('NO_SHOW').variant).toBe('error');
    expect(boardingStatusLabel('PENDING').label).toBe('لم يصعد بعد');
    expect(boardingStatusLabel(undefined).label).toBe('لم يصعد بعد');
  });
});
