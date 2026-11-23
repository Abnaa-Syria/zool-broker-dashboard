import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { findInPages, SCAN_PAGE_SIZE } from '../../lib/api/findInPages';

export type AccrualStatus = 'UNSETTLED' | 'RESERVED' | 'SETTLED' | 'CLAWED_BACK';

/** `toAccrualDto` (commissions.service). */
export type CommissionAccrual = {
  id: string;
  bookingId: string;
  officeId: string;
  officeCode: string;
  amountMinor: number;
  status: AccrualStatus;
  settlementId: string | null;
  booking: { tripId: string; totalAmountMinor: number; status: string; employeeId: string | null; confirmedAt: string | null };
  createdAt: string;
  updatedAt: string;
};

/** GET /broker/commissions?status= (default UNSETTLED). The totals always describe unsettled accruals. */
export type BrokerCommissions = {
  totalUnsettledMinor: number;
  unsettledCount: number;
  lastSettledAt: string | null;
  items: CommissionAccrual[];
};

export const COMMISSIONS_PAGE_SIZE = 20;

export function useBrokerCommissions(page: number, status: AccrualStatus, enabled: boolean) {
  return useQuery({
    queryKey: ['broker-commissions', status, page],
    queryFn: ({ signal }) => api.get<BrokerCommissions>('/broker/commissions', { page, pageSize: COMMISSIONS_PAGE_SIZE, status }, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const ACCRUAL_STATUS: Record<AccrualStatus, { label: string; variant: 'warning' | 'info' | 'success' | 'error' }> = {
  UNSETTLED: { label: 'غير مُسوّاة', variant: 'warning' },
  RESERVED: { label: 'محجوزة لتسوية', variant: 'info' },
  SETTLED: { label: 'مُسوّاة', variant: 'success' },
  CLAWED_BACK: { label: 'مستردة (إلغاء)', variant: 'error' },
};

/** Status tabs, in lifecycle order. */
export const ACCRUAL_TABS: AccrualStatus[] = ['UNSETTLED', 'RESERVED', 'SETTLED', 'CLAWED_BACK'];

export const ACCRUAL_TAB_HINTS: Record<AccrualStatus, string> = {
  UNSETTLED: 'عمولات الحجوزات المؤكدة التي لم تدخل تسوية بعد.',
  RESERVED: 'عمولات أدرجتها المنصة في مسودة تسوية قيد الإعداد.',
  SETTLED: 'عمولات تمت تسويتها ودفعها للمكتب من المنصة.',
  CLAWED_BACK: 'عمولات أُلغيت لأن الحجز أُلغي قبل التسوية.',
};

/**
 * One accrual for /commissions/:id (or /commissions/booking/:bookingId). The API has no GET-by-id, so
 * the page starts from the row it was opened from (router state) and otherwise scans every status tab.
 */
export function useCommission(key: { accrualId?: string; bookingId?: string }, enabled: boolean, seed?: CommissionAccrual | null) {
  const match = (a: CommissionAccrual) => (key.accrualId ? a.id === key.accrualId : a.bookingId === key.bookingId);
  return useQuery({
    queryKey: ['broker-commission', key.accrualId ?? null, key.bookingId ?? null],
    enabled: enabled && Boolean(key.accrualId || key.bookingId),
    initialData: seed && match(seed) ? seed : undefined,
    queryFn: async ({ signal }) => {
      for (const status of ACCRUAL_TABS) {
        const found = await findInPages(
          (page) =>
            api
              .get<BrokerCommissions>('/broker/commissions', { page, pageSize: SCAN_PAGE_SIZE, status }, signal)
              .then((r) => ({ items: r.data.items, totalPages: r.meta?.totalPages ?? 1 })),
          match,
        );
        if (found) return found;
      }
      return null;
    },
  });
}

/** Effective commission rate of an accrual (percent of the booking total, 2 decimals); null without a total. */
export function commissionRate(amountMinor: number, totalMinor: number): number | null {
  if (!totalMinor) return null;
  return Math.round((amountMinor / totalMinor) * 10_000) / 100;
}
