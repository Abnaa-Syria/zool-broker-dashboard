import { lastDays, sudanDate } from '../../lib/dates';
import type { Booking } from './types';

export type StatusTab = 'ALL' | 'CONFIRMED' | 'CANCELLED' | 'CHANGED';
export type RangePreset = 'all' | 'today' | '7days' | '30days' | 'custom';

export type BookingFilters = {
  tab: StatusTab;
  range: RangePreset;
  /** YYYY-MM-DD, used when range = custom */
  from: string;
  to: string;
  employeeId: string;
  companyId: string;
  page: number;
};

export const DEFAULT_FILTERS: BookingFilters = {
  tab: 'ALL',
  range: 'all',
  from: '',
  to: '',
  employeeId: '',
  companyId: '',
  page: 1,
};

/** GET /broker/bookings query (from/to are Sudan days on `confirmedAt`). */
export type BookingsQuery = {
  page: number;
  pageSize: number;
  status?: 'CONFIRMED' | 'CANCELLED' | 'CHANGED';
  from?: string;
  to?: string;
  employeeId?: string;
  companyId?: string;
};

export function dateRange(filters: Pick<BookingFilters, 'range' | 'from' | 'to'>, now: Date = new Date()): { from?: string; to?: string } {
  switch (filters.range) {
    case 'today': {
      const d = sudanDate(now);
      return { from: d, to: d };
    }
    case '7days':
      return lastDays(7, now);
    case '30days':
      return lastDays(30, now);
    case 'custom': {
      let from = filters.from || undefined;
      let to = filters.to || undefined;
      if (from && to && from > to) [from, to] = [to, from];
      return { from, to };
    }
    default:
      return {};
  }
}

export function toBookingsQuery(filters: BookingFilters, opts: { canFilterEmployee: boolean }, now: Date = new Date()): BookingsQuery {
  const { from, to } = dateRange(filters, now);
  return {
    page: filters.page,
    pageSize: 20,
    ...(filters.tab !== 'ALL' ? { status: filters.tab } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(opts.canFilterEmployee && filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
  };
}

/**
 * Client-side search within the loaded page (the broker list API has no `q` yet):
 * reference, id, passenger name/phone, ticket number, route.
 */
export function matchesSearch(booking: Booking, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    booking.bookingRef ?? '',
    booking.id,
    booking.trip.origin,
    booking.trip.destination,
    ...booking.passengers.flatMap((p) => [p.fullName, p.phone ?? '']),
    ...booking.tickets.map((t) => t.ticketNumber),
  ];
  return haystack.some((v) => v.toLowerCase().includes(q));
}

const TABS: readonly StatusTab[] = ['ALL', 'CONFIRMED', 'CANCELLED', 'CHANGED'];
const RANGES: readonly RangePreset[] = ['all', 'today', '7days', '30days', 'custom'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Filters live in the URL so "back" from a booking restores the list. */
export function filtersFromParams(params: URLSearchParams): BookingFilters {
  const tab = params.get('status') as StatusTab | null;
  const range = params.get('range') as RangePreset | null;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page'));
  return {
    tab: tab && TABS.includes(tab) ? tab : DEFAULT_FILTERS.tab,
    range: range && RANGES.includes(range) ? range : DEFAULT_FILTERS.range,
    from: YMD.test(from) ? from : '',
    to: YMD.test(to) ? to : '',
    employeeId: params.get('employee') ?? '',
    companyId: params.get('carrier') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function filtersToParams(filters: BookingFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab !== DEFAULT_FILTERS.tab) params.set('status', filters.tab);
  if (filters.range !== DEFAULT_FILTERS.range) params.set('range', filters.range);
  if (filters.range === 'custom' && filters.from) params.set('from', filters.from);
  if (filters.range === 'custom' && filters.to) params.set('to', filters.to);
  if (filters.employeeId) params.set('employee', filters.employeeId);
  if (filters.companyId) params.set('carrier', filters.companyId);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}
