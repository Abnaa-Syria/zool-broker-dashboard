import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { ConfirmResult } from '../bookings/types';
import type { AssignedCarrier, BookingQuote, BrokerTrip, BrokerTripDetail, HoldsResult, PassengerInput } from './types';

export type TripSearch = { origin: string; destination: string; date: string; passengers: number };

export function useTripSearch(search: TripSearch | null, page: number) {
  return useQuery({
    queryKey: ['broker-trips', search, page],
    enabled: search !== null,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.get<BrokerTrip[]>(
        '/broker/trips',
        { origin: search?.origin.trim(), destination: search?.destination.trim(), date: search?.date, page, pageSize: 20 },
        signal,
      ),
  });
}

/** City suggestions = origins/destinations of upcoming bookable trips (there is no broker cities endpoint). */
export function useCitySuggestions() {
  return useQuery({
    queryKey: ['broker-trip-cities'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<BrokerTrip[]>('/broker/trips', { pageSize: 100 }, signal);
      const set = new Set<string>();
      for (const t of data) {
        set.add(t.origin);
        set.add(t.destination);
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
    },
  });
}

export function useAssignedCarriers() {
  return useQuery({
    queryKey: ['broker-carriers'],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => api.get<AssignedCarrier[]>('/broker/carriers', undefined, signal).then((r) => r.data),
  });
}

export function useTripDetail(tripId: string | null) {
  return useQuery({
    queryKey: ['broker-trip', tripId],
    enabled: tripId !== null,
    queryFn: ({ signal }) => api.get<BrokerTripDetail>(`/broker/trips/${tripId}`, undefined, signal).then((r) => r.data),
  });
}

export const bookingApi = {
  hold: (tripId: string, seatIds: string[]) =>
    api.post<HoldsResult>(`/broker/trips/${tripId}/holds`, { mode: 'MANUAL', seatIds }).then((r) => r.data),
  release: (holdId: string) => api.delete<unknown>(`/broker/holds/${holdId}`),
  quote: (body: { tripId: string; seatIds: string[]; passengers: PassengerInput[] }) =>
    api.post<BookingQuote>('/broker/bookings/quote', body).then((r) => r.data),
  confirm: (body: { tripId: string; seatIds: string[]; passengers: PassengerInput[]; idempotencyKey: string }) =>
    api.post<ConfirmResult>('/broker/bookings/confirm', body).then((r) => r.data),
};

/** Best-effort release (back / cancel / leaving the page); expired or already-released holds are ignored. */
export function releaseHolds(holdIds: readonly string[]): Promise<void> {
  return Promise.allSettled(holdIds.map((id) => bookingApi.release(id))).then(() => undefined);
}
