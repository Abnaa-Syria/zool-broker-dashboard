import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { DateRange } from './range';

type Range = { range: { from: string; to: string } };

export type ReportSummary = Range & {
  ticketsSold: number;
  grossSalesMinor: number;
  commissionAccruedMinor: number;
  cancellations: number;
  refundsMinor: number;
};

type SalesRow = { ticketsSold: number; grossSalesMinor: number; commissionAccruedMinor: number };
export type EmployeeRow = SalesRow & { employeeId: string; displayName: string };
export type CarrierRow = SalesRow & { companyId: string; key: string; name: string };

type Bucket = { totalMinor: number; count: number };
export type WalletActivity = Range & { topUps: Bucket; bookingDebits: Bucket; refunds: Bucket; commissionPayouts: Bucket };

function useReport<T>(path: string, range: DateRange, enabled: boolean) {
  return useQuery<T>({
    queryKey: ['broker-report', path, range.from, range.to],
    queryFn: ({ signal }) => api.get<T>(`/broker/reports/${path}`, { from: range.from, to: range.to }, signal).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useReportSummary = (r: DateRange, enabled: boolean) => useReport<ReportSummary>('summary', r, enabled);
export const useReportByEmployee = (r: DateRange, enabled: boolean) => useReport<Range & { items: EmployeeRow[] }>('by-employee', r, enabled);
export const useReportByCarrier = (r: DateRange, enabled: boolean) => useReport<Range & { items: CarrierRow[] }>('by-carrier', r, enabled);
export const useWalletActivity = (r: DateRange, enabled: boolean) => useReport<WalletActivity>('wallet-activity', r, enabled);
