import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../lib/api/client';
import type { BookingsQuery } from './filters';
import type { Booking, CancelResult, DispatchResult } from './types';

export function useBookings(query: BookingsQuery) {
  return useQuery({
    queryKey: ['broker-bookings', query],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Booking[]>('/broker/bookings', query, signal),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['broker-booking', id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => api.get<Booking>(`/broker/bookings/${id}`, undefined, signal).then((r) => r.data),
  });
}

/** Employee filter options; GET /broker/staff needs `broker.staff.manage`. */
export function useStaffOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['broker-bookings-staff-options'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      api
        .get<Array<{ id: string; displayName: string }>>('/broker/staff', undefined, signal)
        .then((r) => r.data.map((e) => ({ id: e.id, displayName: e.displayName }))),
  });
}

export function useCancelBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CancelResult>(`/broker/bookings/${id}/cancel`).then((r) => r.data),
    onSuccess: (result) => {
      qc.setQueryData(['broker-booking', id], result.booking);
      void qc.invalidateQueries({ queryKey: ['broker-bookings'] });
      void qc.invalidateQueries({ queryKey: ['broker-wallet'] });
      void qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
    },
  });
}

/** Print-ready TicketDocument (+ whole-booking PDF). Recorded as a dispatch attempt on the API. */
export function dispatchTickets(bookingId: string): Promise<DispatchResult> {
  return api.post<DispatchResult>(`/broker/bookings/${bookingId}/dispatch`, { channel: 'download' }).then((r) => r.data);
}

export function downloadTicketPdf(bookingId: string, ticketNumber: string): Promise<void> {
  return downloadFile(
    `/broker/bookings/${bookingId}/tickets/${encodeURIComponent(ticketNumber)}/pdf`,
    undefined,
    `${ticketNumber}.pdf`,
  );
}

/** Save the base64 PDF that dispatch returns (all tickets of the booking). */
export function saveBase64Pdf(base64: string, filename: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
