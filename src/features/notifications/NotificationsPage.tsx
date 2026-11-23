import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { useMarkRead, useNotifications, useUnreadCount } from './api';
import { notificationIcon, notificationTypeLabel } from './logic';

/** /notifications — the employee's full feed; each item opens /notifications/:id. */
export const NotificationsPage: React.FC = () => {
  const feed = useNotifications(true);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const [onlyUnread, setOnlyUnread] = React.useState(false);
  const all = feed.data?.pages.flatMap((p) => p.data) ?? [];
  const items = onlyUnread ? all.filter((n) => !n.isRead) : all;

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      <PageHeader
        title="الإشعارات"
        subtitle={unread.data ? `${unread.data} غير مقروءة` : 'لا إشعارات جديدة'}
        actions={
          <div className="flex gap-2">
            <Button variant={onlyUnread ? 'secondary' : 'outline'} size="sm" icon="filter_list" onClick={() => setOnlyUnread((v) => !v)}>
              {onlyUnread ? 'عرض الكل' : 'غير المقروءة فقط'}
            </Button>
            <Button variant="outline" size="sm" icon="done_all" disabled={!unread.data || markRead.isPending} onClick={() => markRead.mutate('all')}>
              تعليم الكل كمقروء
            </Button>
          </div>
        }
        className="mb-0"
      />

      {feed.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : feed.isError ? (
        <ErrorState title="تعذّر تحميل الإشعارات" message={errorMessage(feed.error)} onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications_off"
          title={onlyUnread ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات'}
          description="ستظهر هنا تنبيهات المكتب، مثل إلغاء الرحلات واسترداد المبالغ وإصدار التذاكر."
        />
      ) : (
        <ul className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest divide-y divide-outline-variant/30">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={`/notifications/${n.id}`} className={cn('flex items-start gap-3 px-space-md py-3 hover:bg-surface-container', !n.isRead && 'bg-surface-container-low')}>
                <span className={cn('material-symbols-outlined text-[22px] mt-0.5', n.isRead ? 'text-outline' : 'text-secondary')}>{notificationIcon(n.type)}</span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-sm', n.isRead ? 'font-medium' : 'font-bold')}>{n.title}</span>
                  <span className="block text-xs text-on-surface-variant">{n.body}</span>
                  <span className="block text-[11px] text-outline mt-0.5">
                    {notificationTypeLabel(n.type)} • {formatDateTime(n.createdAt)}
                  </span>
                </span>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-secondary mt-2 shrink-0" aria-label="غير مقروء" />}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {feed.hasNextPage && (
        <Button variant="outline" className="self-center" isLoading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
          عرض المزيد
        </Button>
      )}
    </div>
  );
};
