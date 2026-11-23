import { describe, expect, it } from 'vitest';
import { markReadLocally, notificationIcon, notificationLinks, notificationTarget, notificationTypeLabel, unreadBadge } from './logic';
import type { AppNotification } from './types';

const n = (id: string, isRead = false, data: AppNotification['data'] = null): AppNotification => ({
  id,
  type: 'TRIP_CANCELLED',
  title: 't',
  body: 'b',
  data,
  isRead,
  readAt: isRead ? '2026-11-20T00:00:00.000Z' : null,
  createdAt: '2026-11-20T00:00:00.000Z',
});

describe('notifications', () => {
  it('badge text', () => {
    expect(unreadBadge(undefined)).toBeNull();
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe('3');
    expect(unreadBadge(12)).toBe('9+');
  });

  it('target from data', () => {
    expect(notificationTarget(n('1', false, { bookingId: 'b1' }))).toBe('/bookings/b1');
    expect(notificationTarget(n('1', false, { tripId: 't1' }))).toBe('/bookings?status=CANCELLED');
    expect(notificationTarget(n('1', false, { topUpRequestId: 'x' }))).toBe('/wallet/top-ups/x');
    expect(notificationTarget(n('1'))).toBeNull();
  });

  it('lists every deep link', () => {
    expect(notificationLinks(n('1', false, { bookingId: 'b1', tripId: 't1' })).map((l) => l.path)).toEqual(['/bookings/b1']);
    expect(notificationLinks(n('1', false, { bookingId: 'b1', topUpId: 'x' })).map((l) => l.path)).toEqual(['/bookings/b1', '/wallet/top-ups/x']);
    expect(notificationLinks(n('1', false, { bookingId: 5 }))).toEqual([]);
  });

  it('type labels', () => {
    expect(notificationTypeLabel('TRIP_CANCELLED')).toBe('إلغاء رحلة');
    expect(notificationTypeLabel('NEW_TYPE')).toBe('NEW_TYPE');
  });

  it('icons fall back to the bell', () => {
    expect(notificationIcon('TRIP_CANCELLED')).toBe('event_busy');
    expect(notificationIcon('SOMETHING_NEW')).toBe('notifications');
  });

  it('marks one or all as read locally', () => {
    const items = [n('1'), n('2'), n('3', true)];
    const one = markReadLocally(items, '2', 'now');
    expect(one.map((x) => x.isRead)).toEqual([false, true, true]);
    expect(one[1].readAt).toBe('now');
    expect(one[2]).toBe(items[2]);
    expect(markReadLocally(items, 'all', 'now').every((x) => x.isRead)).toBe(true);
  });
});
