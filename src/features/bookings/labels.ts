import type { BadgeProps } from '../../components/ui/Badge';

export function bookingStatusLabel(status: string): { label: string; variant: NonNullable<BadgeProps['variant']> } {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'مؤكد', variant: 'success' };
    case 'CANCELLED':
      return { label: 'ملغى', variant: 'error' };
    case 'PENDING_PAYMENT':
      return { label: 'بانتظار الدفع', variant: 'warning' };
    case 'CHANGED':
      return { label: 'مُعدّل', variant: 'info' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function commissionStatusLabel(status: string | null): string {
  switch (status) {
    case 'UNSETTLED':
      return 'مستحقة — تُسوّى لاحقًا';
    case 'RESERVED':
      return 'قيد التسوية';
    case 'SETTLED':
      return 'تمت تسويتها';
    case 'CLAWED_BACK':
      return 'مستردة بسبب الإلغاء';
    case null:
      return '—';
    default:
      return status;
  }
}

/** Human booking reference, falling back to a short id for old rows without one. */
export function bookingReference(b: { bookingRef: string | null; id: string }): string {
  return b.bookingRef ?? `#${b.id.slice(-8).toUpperCase()}`;
}

/**
 * "origin ← destination" that reads right-to-left even for Latin city names: each name is a
 * first-strong isolate (FSI…PDI), so the arrow follows the RTL paragraph instead of joining an LTR run.
 */
export function routeLabel(origin: string, destination: string): string {
  return `⁨${origin}⁩ ← ⁨${destination}⁩`;
}

export function ticketStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'سارية';
    case 'CANCELLED':
      return 'ملغاة';
    case 'CHANGED':
      return 'مستبدلة بحجز آخر';
    default:
      return status;
  }
}

export function boardingStatusLabel(status: string | null | undefined): { label: string; variant: NonNullable<BadgeProps['variant']> } {
  switch (status) {
    case 'BOARDED':
      return { label: 'صعد الحافلة', variant: 'success' };
    case 'NO_SHOW':
      return { label: 'لم يحضر', variant: 'error' };
    case 'PENDING':
    case null:
    case undefined:
      return { label: 'لم يصعد بعد', variant: 'neutral' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

/** QR content: the server-signed boarding code; the ticket number only when there is none (old data). */
export function ticketQrValue(ticketNumber: string, ...payloads: Array<string | null | undefined>): string {
  return payloads.find((p): p is string => typeof p === 'string' && p.length > 0) ?? ticketNumber;
}

export function channelLabel(channel: string | null | undefined): string {
  switch (channel) {
    case 'BROKER':
      return 'مكتب الوكيل';
    case 'DIRECT':
      return 'تطبيق العميل';
    default:
      return channel ?? '—';
  }
}

export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case 'WALLET':
      return 'محفظة المكتب (رصيد مسبق)';
    case 'ONLINE':
      return 'دفع إلكتروني';
    case 'CASH_ON_BOARD':
      return 'نقدًا للسائق';
    default:
      return method ?? '—';
  }
}

export function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'PAID':
      return 'مدفوع';
    case 'PENDING':
      return 'بانتظار الدفع';
    case 'UNPAID_CASH':
      return 'يُدفع نقدًا';
    case 'PAID_CASH':
      return 'مدفوع نقدًا';
    case 'REFUNDED':
      return 'مسترد';
    case 'PARTIALLY_REFUNDED':
      return 'مسترد جزئيًا';
    default:
      return status ?? '—';
  }
}

export function refundStatusLabel(status: string): { label: string; variant: NonNullable<BadgeProps['variant']> } {
  switch (status) {
    case 'PENDING':
      return { label: 'قيد المعالجة', variant: 'warning' };
    case 'SUCCEEDED':
      return { label: 'تم الاسترداد', variant: 'success' };
    case 'FAILED':
      return { label: 'فشل', variant: 'error' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function refundReasonLabel(reason: string | null): string {
  switch (reason) {
    case 'CHANGE_DIFFERENCE':
      return 'فرق سعر تعديل الرحلة';
    case 'CUSTOMER_CANCEL':
      return 'إلغاء من العميل';
    case 'CARRIER_CANCEL':
      return 'إلغاء الرحلة من شركة النقل';
    case 'ADMIN':
      return 'استرداد من إدارة المنصة';
    case null:
      return '—';
    default:
      return reason;
  }
}

export function genderLabel(gender: string | null | undefined): string | null {
  if (gender === 'FEMALE') return 'أنثى';
  if (gender === 'MALE') return 'ذكر';
  return null;
}

export function legLabel(leg: string | null | undefined): string | null {
  if (leg === 'OUTBOUND') return 'رحلة الذهاب';
  if (leg === 'RETURN') return 'رحلة العودة';
  return null;
}
