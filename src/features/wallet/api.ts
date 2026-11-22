import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { topUpPollInterval, type LedgerType } from './logic';

export { useBrokerWallet } from '../home/api';

/** GET /broker/wallet/ledger item (`LedgerEntryDto`). `amountMinor` is always positive. */
export type LedgerEntry = {
  id: string;
  type: LedgerType;
  direction: 'CREDIT' | 'DEBIT';
  amountMinor: number;
  balanceAfterMinor: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

/** `TopUpIntentDto` (payments.service). */
export type TopUpIntent = {
  id: string;
  officeId: string;
  amountMinor: number;
  status: 'PENDING' | 'PENDING_REVIEW' | 'CONFIRMED' | 'FAILED';
  confirmationPath: 'AUTOMATIC' | 'MANUAL_FALLBACK';
  provider: string;
  providerRef: string | null;
  paymentReferenceNormalized: string | null;
  idempotencyKey: string;
  hasEvidence: boolean;
  /** Office receipt note, or the platform's rejection note once FAILED. */
  note: string | null;
  createdAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
  /** True only in non-production with the mock provider while PENDING. */
  mockConfirmAvailable: boolean;
};

export type TopUpStatus = TopUpIntent['status'];

export const LEDGER_PAGE_SIZE = 20;

export function useWalletLedger(page: number) {
  return useQuery({
    queryKey: ['broker-wallet-ledger', page],
    queryFn: ({ signal }) => api.get<LedgerEntry[]>('/broker/wallet/ledger', { page, pageSize: LEDGER_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

function invalidateWallet(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['broker-wallet'] });
  void qc.invalidateQueries({ queryKey: ['broker-wallet-ledger'] });
  void qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
  void qc.invalidateQueries({ queryKey: ['broker-top-ups'] });
}

/** Store a fresh intent in the detail cache and refresh lists (and the balance once confirmed). */
function storeIntent(qc: QueryClient, intent: TopUpIntent) {
  qc.setQueryData(['broker-top-up', intent.id], intent);
  if (intent.status === 'CONFIRMED') invalidateWallet(qc);
  else void qc.invalidateQueries({ queryKey: ['broker-top-ups'] });
}

export const TOP_UPS_PAGE_SIZE = 10;

/** GET /broker/wallet/top-ups (broker.wallet.topup or manager), newest first. */
export function useTopUps(page: number, status: TopUpStatus | '', enabled: boolean) {
  return useQuery({
    queryKey: ['broker-top-ups', page, status],
    queryFn: ({ signal }) =>
      api.get<TopUpIntent[]>('/broker/wallet/top-ups', { page, pageSize: TOP_UPS_PAGE_SIZE, status: status || undefined }, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * GET /broker/wallet/top-ups/:id, polled while the outcome is still open
 * (provider confirmation every 5 s, platform review every 30 s).
 */
export function useTopUp(intentId: string | null, seed?: TopUpIntent | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['broker-top-up', intentId],
    queryFn: async ({ signal }) => {
      const prev = qc.getQueryData<TopUpIntent>(['broker-top-up', intentId]);
      const { data } = await api.get<TopUpIntent>(`/broker/wallet/top-ups/${encodeURIComponent(intentId!)}`, undefined, signal);
      if (prev && prev.status !== data.status) {
        if (data.status === 'CONFIRMED') invalidateWallet(qc);
        else void qc.invalidateQueries({ queryKey: ['broker-top-ups'] });
      }
      return data;
    },
    enabled: intentId !== null,
    initialData: seed && seed.id === intentId ? seed : undefined,
    initialDataUpdatedAt: 0,
    refetchInterval: (q) => topUpPollInterval(q.state.data?.status),
  });
}

export function useCreateTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { amountMinor: number; idempotencyKey: string }) =>
      api.post<TopUpIntent>('/broker/wallet/top-ups', body).then((r) => r.data),
    onSuccess: (intent) => storeIntent(qc, intent),
  });
}

/** Manual fallback: receipt + bank/payment reference → PENDING_REVIEW (platform approves). */
export function useSubmitTopUpEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { intentId: string; receipt: File; paymentReference: string; note?: string }) => {
      const form = new FormData();
      form.append('paymentReference', input.paymentReference);
      if (input.note) form.append('note', input.note);
      form.append('receipt', input.receipt);
      return api.post<TopUpIntent>(`/broker/wallet/top-ups/${encodeURIComponent(input.intentId)}/evidence`, form).then((r) => r.data);
    },
    onSuccess: (intent) => storeIntent(qc, intent),
  });
}

/** Only when the intent reports `mockConfirmAvailable` (mock provider, non-production, PENDING). */
export function useMockConfirmTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intentId: string) =>
      api
        .post<{ intent: TopUpIntent; balanceMinor: number }>(`/broker/wallet/top-ups/${encodeURIComponent(intentId)}/mock-confirm`)
        .then((r) => r.data),
    onSuccess: (r) => {
      qc.setQueryData(['broker-top-up', r.intent.id], r.intent);
      invalidateWallet(qc);
    },
  });
}
