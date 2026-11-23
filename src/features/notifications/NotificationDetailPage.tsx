import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailSkeleton, Field } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { useBooking } from '../bookings/api';
import { bookingReference, bookingStatusLabel, routeLabel } from '../bookings/labels';
import { useMarkRead, useNotification } from './api';
import { notificationIcon, notificationLinks, notificationTypeLabel } from './logic';

const CRUMBS = [{ label: 'الإشعارات', path: '/notifications' }];

/**
 * /notifications/:id — one notification (marked as read on open) with deep links to its booking /
 * top-up request and a summary of the booking it is about.
 */
export const NotificationDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useNotification(id);
  const markRead = useMarkRead();
  const n = query.data;
  const unreadId = n && !n.isRead ? n.id : null;
  const { mutate } = markRead;

  React.useEffect(() => {
    if (unreadId) mutate(unreadId);
  }, [unreadId, mutate]);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !n) {
    return (
      <DetailError
        crumbs={[...CRUMBS, { label: 'إشعار' }]}
        notFound={!query.isError}
        notFoundTitle="الإشعار غير موجود"
        notFoundMessage="لم يُعثر على هذا الإشعار في إشعاراتك."
        title="تعذّر تحميل الإشعار"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const links = notificationLinks(n);
  const bookingId = typeof n.data?.bookingId === 'string' ? n.data.bookingId : null;

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[...CRUMBS, { label: n.title }]} />
      <PageHeader
        title={n.title}
        subtitle={`${notificationTypeLabel(n.type)} • ${formatDateTime(n.createdAt)}`}
        badge={<Badge variant={n.isRead ? 'neutral' : 'info'}>{n.isRead ? 'مقروء' : 'جديد'}</Badge>}
        actions={
          links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {links.map((l, i) => (
                <Button key={l.path} variant={i === 0 ? 'secondary' : 'outline'} icon="open_in_new" onClick={() => navigate(l.path)}>
                  {l.label}
                </Button>
              ))}
            </div>
          ) : undefined
        }
        className="mb-0"
      />

      <Card className="flex items-start gap-space-md">
        <span className="material-symbols-outlined text-[32px] text-secondary">{notificationIcon(n.type)}</span>
        <div className="space-y-space-sm flex-1">
          <p className="text-sm leading-relaxed">{n.body}</p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-space-lg gap-y-3 text-sm">
            <Field label="النوع">{notificationTypeLabel(n.type)}</Field>
            <Field label="التاريخ">{formatDateTime(n.createdAt)}</Field>
            <Field label="قُرئ في">{n.readAt ? formatDateTime(n.readAt) : 'الآن'}</Field>
          </dl>
        </div>
      </Card>

      {bookingId && <NotificationBooking bookingId={bookingId} />}
    </div>
  );
};

const NotificationBooking: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const q = useBooking(bookingId);
  const b = q.data;
  return (
    <Card className="space-y-space-sm">
      <h2 className="font-bold">الحجز</h2>
      {q.isLoading ? (
        <p className="text-sm text-on-surface-variant">جارٍ التحميل…</p>
      ) : q.isError || !b ? (
        <p className="text-sm text-on-surface-variant">{errorMessage(q.error, 'تعذّر تحميل الحجز.')}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <div className="font-mono font-semibold">{bookingReference(b)}</div>
            <div className="text-on-surface-variant">
              {b.trip.company.name} • {routeLabel(b.trip.origin, b.trip.destination)} • {formatDateTime(b.trip.departureAt)}
            </div>
            <div className="text-xs text-on-surface-variant">
              {b.passengers.map((p) => p.fullName).join('، ')} • {formatSdg(b.totalAmountMinor)}
            </div>
          </div>
          <Badge variant={bookingStatusLabel(b.status).variant} dot>
            {bookingStatusLabel(b.status).label}
          </Badge>
        </div>
      )}
    </Card>
  );
};
