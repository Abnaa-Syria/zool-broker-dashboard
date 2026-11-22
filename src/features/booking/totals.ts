/**
 * Display-only estimates before the quote (the review step always shows the API quote).
 * Commission = floor(total × percent / 100) in integer basis points, exactly like the backend.
 */
export function computeCommission(totalMinor: number, percent: number): number {
  const basisPoints = Math.round(percent * 100);
  return Math.floor((totalMinor * basisPoints) / 10_000);
}

export type BookingEstimate = { totalMinor: number; commissionMinor: number };

export function estimateBooking(unitPriceMinor: number, seats: number, commissionPercent: number): BookingEstimate {
  const totalMinor = unitPriceMinor * seats;
  return { totalMinor, commissionMinor: computeCommission(totalMinor, commissionPercent) };
}

/**
 * The wallet is debited the FULL ticket total; the commission is earned and settled later
 * (API_CONVENTIONS §5) — there is no "net debit".
 */
export function walletAfter(balanceMinor: number, totalMinor: number): { afterMinor: number; sufficient: boolean } {
  return { afterMinor: balanceMinor - totalMinor, sufficient: balanceMinor >= totalMinor };
}

/** "10%" / "7.5%" */
export function formatPercent(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, '')}%`;
}
