import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { ConfirmResult } from '../bookings/types';
import type { AssignedCarrier, BookingQuote, BrokerTrip, BrokerTripDetail, HoldsResult, PassengerInput, ReturnTripInput, StationRef } from './types';

export type TripSearch = { fromCityId: string; toCityId: string; date: string; passengers: number };

/** GET /public/cities (no login): active cities with their stations. */
export type City = { id: string; code: string; nameAr: string; nameEn: string; stations: StationRef[] };

export function useTripSearch(search: TripSearch | null, page: number) {
  return useQuery({
    queryKey: ['broker-trips', search, page],
    enabled: search !== null,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api.get<BrokerTrip[]>(
        '/broker/trips',
        { fromCityId: search?.fromCityId || undefined, toCityId: search?.toCityId || undefined, date: search?.date || undefined, page, pageSize: 20 },
        signal,
      ),
  });
}

export function useCities() {
  return useQuery({
    queryKey: ['public-cities'],
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => api.get<City[]>('/public/cities', undefined, signal).then((r) => r.data),
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
  /** `returnTrip` makes it a round trip (D-RT-01): the quote then carries `returnLeg` and combined totals. */
  quote: (body: { tripId: string; seatIds: string[]; passengers: PassengerInput[]; returnTrip?: ReturnTripInput }) =>
    api.post<BookingQuote>('/broker/bookings/quote', body).then((r) => r.data),
  confirm: (body: { tripId: string; seatIds: string[]; passengers: PassengerInput[]; returnTrip?: ReturnTripInput; idempotencyKey: string }) =>
    api.post<ConfirmResult>('/broker/bookings/confirm', body).then((r) => r.data),
};

/** Best-effort release (back / cancel / leaving the page); expired or already-released holds are ignored. */
export function releaseHolds(holdIds: readonly string[]): Promise<void> {
  return Promise.allSettled(holdIds.map((id) => bookingApi.release(id))).then(() => undefined);
}
