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
  const d = n.data ?? {};
  const str = (k: string) => (typeof d[k] === 'string' && d[k] !== '' ? (d[k] as string) : null);
  const bookingId = str('bookingId');
  if (bookingId) return `/bookings/${encodeURIComponent(bookingId)}`;
  if (str('topUpRequestId') || str('topUpId')) return '/wallet';
  if (str('tripId')) return '/bookings';
  return null;
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
