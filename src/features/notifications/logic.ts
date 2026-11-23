import type { AppNotification } from './types';

/** Material icon per notification type. */
export function notificationIcon(type: string): string {
  switch (type) {
    case 'TRIP_CANCELLED':
      return 'event_busy';
    case 'TICKET_ISSUED':
      return 'confirmation_number';
    case 'BOOKING_REFUNDED':
      return 'currency_exchange';
    case 'DEPARTURE_REMINDER':
      return 'schedule';
    case 'PAYMENT_SUCCEEDED':
    case 'PAYMENT_FAILED':
      return 'account_balance_wallet';
    default:
      return 'notifications';
  }
}

/** Where a notification leads in the panel, from its `data` (null when it has no target). */
export function notificationTarget(n: Pick<AppNotification, 'data'>): string | null {
  return notificationLinks(n)[0]?.path ?? null;
}

/**
 * Deep links of a notification, most specific first: its booking, its top-up request, or — for a
 * cancelled trip (`data.tripId`, the trip is no longer bookable) — the office's cancelled bookings.
 */
export function notificationLinks(n: Pick<AppNotification, 'data'>): Array<{ path: string; label: string }> {
  const d = n.data ?? {};
  const str = (k: string) => (typeof d[k] === 'string' && d[k] !== '' ? (d[k] as string) : null);
  const links: Array<{ path: string; label: string }> = [];
  const bookingId = str('bookingId');
  if (bookingId) links.push({ path: `/bookings/${encodeURIComponent(bookingId)}`, label: 'فتح الحجز' });
  const topUpId = str('topUpRequestId') ?? str('topUpId') ?? str('intentId');
  if (topUpId) links.push({ path: `/wallet/top-ups/${encodeURIComponent(topUpId)}`, label: 'فتح طلب الشحن' });
  if (str('tripId') && !bookingId) links.push({ path: '/bookings?status=CANCELLED', label: 'الحجوزات الملغاة' });
  return links;
}

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'TRIP_CANCELLED':
      return 'إلغاء رحلة';
    case 'TICKET_ISSUED':
      return 'إصدار تذاكر';
    case 'BOOKING_REFUNDED':
      return 'استرداد حجز';
    case 'DEPARTURE_REMINDER':
      return 'تذكير بموعد المغادرة';
    case 'PAYMENT_SUCCEEDED':
      return 'نجاح الدفع';
    case 'PAYMENT_FAILED':
      return 'فشل الدفع';
    default:
      return type;
  }
}

/** Badge text: "9+" above nine; null when there is nothing unread. */
export function unreadBadge(unread: number | undefined): string | null {
  if (!unread || unread <= 0) return null;
  return unread > 9 ? '9+' : String(unread);
}

/** Optimistic local read: mark one (or all) as read in a loaded page. */
export function markReadLocally(items: readonly AppNotification[], id: string | 'all', now: string = new Date().toISOString()): AppNotification[] {
  return items.map((n) => (n.isRead || (id !== 'all' && n.id !== id) ? n : { ...n, isRead: true, readAt: now }));
}
