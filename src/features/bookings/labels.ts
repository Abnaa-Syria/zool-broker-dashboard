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
