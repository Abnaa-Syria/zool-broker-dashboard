import { ApiError } from '../../lib/api/client';
import { sdgToMinor } from '../../lib/money';

/** `WalletLedgerType` (wallet.prisma). */
export type LedgerType = 'CREDIT_TOPUP' | 'DEBIT_BOOKING' | 'CREDIT_REFUND' | 'DEBIT_COMMISSION_PAYOUT';

export const LEDGER_TYPE_LABELS: Record<LedgerType, string> = {
  CREDIT_TOPUP: 'شحن المحفظة',
  DEBIT_BOOKING: 'خصم حجز',
  CREDIT_REFUND: 'استرداد إلغاء',
  DEBIT_COMMISSION_PAYOUT: 'تسوية عمولة',
};

export function ledgerTypeLabel(type: string): string {
  return LEDGER_TYPE_LABELS[type as LedgerType] ?? type;
}

/** Ledger amounts are positive; the direction decides the sign shown to the office. */
export function signedAmountMinor(entry: { direction: 'CREDIT' | 'DEBIT'; amountMinor: number }): number {
  return entry.direction === 'DEBIT' ? -Math.abs(entry.amountMinor) : Math.abs(entry.amountMinor);
}

/** `TopUpIntentStatus` (payment.prisma). */
export const TOP_UP_STATUS_LABELS: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'error' }> = {
  PENDING: { label: 'بانتظار تأكيد الدفع', variant: 'warning' },
  PENDING_REVIEW: { label: 'قيد مراجعة المنصة', variant: 'info' },
  CONFIRMED: { label: 'تم الشحن', variant: 'success' },
  FAILED: { label: 'مرفوض / فشل', variant: 'error' },
};

/** Poll interval for a top-up detail: fast while awaiting the provider, slow during platform review. */
export function topUpPollInterval(status: string | undefined): number | false {
  if (status === 'PENDING') return 5_000;
  if (status === 'PENDING_REVIEW') return 30_000;
  return false;
}

/**
 * Parse an SDG amount typed by the user ("12,500" / "12500.5") into minor units.
 * Returns null for empty, non-numeric, non-positive or more-than-2-decimals input.
 */
export function parseSdgInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = sdgToMinor(Number(cleaned));
  return minor > 0 ? minor : null;
}

/**
 * The API replays an idempotency key only for the same amount (a different amount → 409 CONFLICT).
 * Keep the key while the amount is unchanged (safe retry after a network error); otherwise mint a new one.
 */
export function idempotencyKeyFor(
  previous: { amountMinor: number; key: string } | null,
  amountMinor: number,
  newKey: () => string,
): { amountMinor: number; key: string } {
  if (previous && previous.amountMinor === amountMinor) return previous;
  return { amountMinor, key: newKey() };
}

/** `details.minTopUpMinor` from a TOP_UP_BELOW_MINIMUM error, if present. */
export function minTopUpFromError(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== 'TOP_UP_BELOW_MINIMUM') return null;
  const d = error.details as { minTopUpMinor?: unknown } | null | undefined;
  return typeof d?.minTopUpMinor === 'number' ? d.minTopUpMinor : null;
}

/** Same limits as the backend (receipt-file.ts): PDF / JPEG / PNG, at most 5 MB. */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function validateReceipt(file: { size: number; type: string; name: string } | null): string | null {
  if (!file) return 'أرفق صورة الإيصال أو ملف PDF.';
  const byExt = /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!RECEIPT_TYPES.has(file.type) && !byExt) return 'نوع الملف غير مدعوم. استخدم PDF أو JPG أو PNG.';
  if (file.size > RECEIPT_MAX_BYTES) return 'حجم الملف يتجاوز 5 ميغابايت.';
  if (file.size === 0) return 'الملف فارغ.';
  return null;
}
