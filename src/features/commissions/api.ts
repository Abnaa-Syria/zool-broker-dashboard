import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';

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
