import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/DropdownMenu';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { useMarkRead, useNotifications, useUnreadCount } from './api';
import { notificationIcon, notificationTarget, unreadBadge } from './logic';
import type { AppNotification } from './types';

/**
 * Header bell: unread badge (GET /broker/notifications/unread-count, polled every 60 s) and a
 * dropdown feed (GET /broker/notifications) with mark-as-read / read-all.
 */
export const NotificationsBell: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const feed = useNotifications(open);
  const markRead = useMarkRead();
  const items = feed.data?.pages.flatMap((p) => p.data) ?? [];
  const badge = unreadBadge(unread.data);

  const select = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    // Straight to the booking / top-up it is about; otherwise its own page.
    navigate(notificationTarget(n) ?? `/notifications/${n.id}`);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          void unread.refetch();
          if (feed.data) void feed.refetch();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={badge ? `الإشعارات: ${unread.data} غير مقروءة` : 'الإشعارات'}
          className="relative p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/40"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {badge && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-surface-container-lowest tabular-nums">
              {badge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-2 text-right">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-outline-variant/30">
          <span className="text-xs font-bold text-on-surface">الإشعارات</span>
          {badge ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-secondary hover:underline disabled:opacity-50"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate('all')}
            >
              تعليم الكل كمقروء
            </button>
          ) : (
            <span className="text-[10px] text-on-surface-variant">لا جديد</span>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {feed.isLoading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : feed.isError ? (
            <div className="p-3 text-xs text-error space-y-1">
              <p>{errorMessage(feed.error, 'تعذّر تحميل الإشعارات.')}</p>
              <button type="button" className="underline" onClick={() => void feed.refetch()}>
                إعادة المحاولة
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] text-outline">notifications_off</span>
              <span className="text-xs font-semibold">لا توجد إشعارات</span>
              <span className="text-[11px]">ستظهر هنا تنبيهات المكتب، مثل إلغاء الرحلات واسترداد المبالغ.</span>
            </div>
          ) : (
            items.map((n) => (
              <DropdownMenuItem key={n.id} onSelect={() => select(n)} className={cn('items-start gap-2 py-2', !n.isRead && 'bg-surface-container')}>
                <span className={cn('material-symbols-outlined text-[18px] mt-0.5', n.isRead ? 'text-outline' : 'text-secondary')}>{notificationIcon(n.type)}</span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-xs', n.isRead ? 'font-medium text-on-surface' : 'font-bold text-on-surface')}>{n.title}</span>
                  <span className="block text-[11px] text-on-surface-variant whitespace-normal">{n.body}</span>
                  <span className="block text-[10px] text-outline mt-0.5">{formatDateTime(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" aria-label="غير مقروء" />}
              </DropdownMenuItem>
            ))
          )}
          {items.length > 0 && (
            <button
              type="button"
              className="w-full py-2 text-[11px] font-semibold text-secondary hover:underline border-t border-outline-variant/30"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              عرض كل الإشعارات
            </button>
          )}
          {feed.hasNextPage && (
            <button
              type="button"
              className="w-full py-2 text-[11px] font-semibold text-secondary hover:underline disabled:opacity-50"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              {feed.isFetchingNextPage ? 'جارٍ التحميل…' : 'عرض المزيد'}
            </button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
