import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';

/** GET /broker/dashboard — today's KPIs (office-wide for managers/report viewers, own sales otherwise). */
export type BrokerDashboard = {
  date: string;
  scope: 'OFFICE' | 'SELF';
  bookingsCount: number;
  ticketsSold: number;
  grossSalesMinor: number;
  commissionAccruedMinor: number;
  currency: 'SDG';
};

/** GET /broker/wallet (`walletsService.getOfficeWallet`). */
export type BrokerWallet = {
  balanceMinor: number;
  currency: 'SDG';
  lowBalance: boolean;
  lowBalanceThresholdMinor: number;
  [key: string]: unknown;
};

export function useBrokerDashboard() {
  return useQuery({
    queryKey: ['broker-dashboard'],
    queryFn: ({ signal }) => api.get<BrokerDashboard>('/broker/dashboard', undefined, signal).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useBrokerWallet() {
  return useQuery({
    queryKey: ['broker-wallet'],
    queryFn: ({ signal }) => api.get<BrokerWallet>('/broker/wallet', undefined, signal).then((r) => r.data),
  });
}
