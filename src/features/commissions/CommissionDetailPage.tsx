import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailLink, DetailSkeleton, Field, Row } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { useAuth } from '../auth/auth-context';
import { formatPercent } from '../booking/totals';
import { useBooking } from '../bookings/api';
import { bookingReference, bookingStatusLabel, routeLabel } from '../bookings/labels';
import { ACCRUAL_STATUS, ACCRUAL_TAB_HINTS, commissionRate, useCommission, type CommissionAccrual } from './api';

const CRUMBS = [{ label: 'العمولات', path: '/commissions' }];

/**
 * /commissions/:accrualId and /commissions/booking/:bookingId — one commission accrual with its booking.
 * Settlement and payout are done by the platform (D-SET-01): there are no office actions here; a booking's
 * commission is clawed back by cancelling the booking from its page.
 */
export const CommissionDetailPage: React.FC = () => {
  const { accrualId, bookingId } = useParams();
  const { can } = useAuth();
  const allowed = can('broker.reports.view');
  const seed = (useLocation().state as { accrual?: CommissionAccrual } | null)?.accrual ?? null;
  const query = useCommission({ accrualId, bookingId }, allowed, seed);

  if (!allowed) {
    return (
      <div className="space-y-space-md">
        <DetailCrumbs items={[...CRUMBS, { label: 'عمولة' }]} />
        <EmptyState icon="lock" title="لا تملك صلاحية عرض العمولات" description="العمولات متاحة لمدير المكتب ولمن يملك صلاحية التقارير." />
      </div>
    );
  }
  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return (
      <DetailError
        crumbs={[...CRUMBS, { label: 'عمولة' }]}
        notFound={!query.isError}
        notFoundTitle="العمولة غير موجودة"
        notFoundMessage={bookingId ? 'لا توجد عمولة مسجلة لهذا الحجز.' : 'لم تُعثر على هذه العمولة في سجل عمولات المكتب.'}
        title="تعذّر تحميل العمولة"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const a = query.data;
  const status = ACCRUAL_STATUS[a.status] ?? { label: a.status, variant: 'info' as const };
  const rate = commissionRate(a.amountMinor, a.booking.totalAmountMinor);

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[...CRUMBS, { label: `عمولة ${formatSdg(a.amountMinor)}` }]} />
      <PageHeader
        title={`عمولة ${formatSdg(a.amountMinor)}`}
        subtitle={`مكتب ${a.officeCode} • ${formatDateTime(a.booking.confirmedAt ?? a.createdAt)}`}
        badge={
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        }
        className="mb-0"
      />
      <p className="text-sm text-on-surface-variant -mt-space-sm">{ACCRUAL_TAB_HINTS[a.status]}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المبالغ</h2>
          <dl className="space-y-3 text-sm">
            <Row label="قيمة الحجز">{formatSdg(a.booking.totalAmountMinor)}</Row>
            <Row label="نسبة العمولة">{rate === null ? '—' : formatPercent(rate)}</Row>
            <Row label="العمولة" strong>
              {formatSdg(a.amountMinor)}
            </Row>
          </dl>
        </Card>
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">بيانات العمولة</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="الحالة">{status.label}</Field>
            <Field label="تاريخ الاستحقاق">{formatDateTime(a.createdAt)}</Field>
            <Field label="آخر تحديث">{formatDateTime(a.updatedAt)}</Field>
            <Field label="حالة الحجز">{bookingStatusLabel(a.booking.status).label}</Field>
            <Field label="التسوية" mono={Boolean(a.settlementId)}>
              {a.settlementId ?? 'لم تدخل تسوية بعد'}
            </Field>
            <Field label="رقم العمولة" mono>
              {a.id}
            </Field>
          </dl>
          <p className="text-xs text-on-surface-variant">تتولى المنصة تسوية العمولات ودفعها للمكتب؛ لا يمكن سحبها أو تعديلها من هنا.</p>
        </Card>
      </div>

      <BookingCard bookingId={a.bookingId} />
    </div>
  );
};

const BookingCard: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const q = useBooking(bookingId);
  const b = q.data;
  return (
    <Card className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">الحجز</h2>
        {b && <DetailLink to={`/bookings/${b.id}`}>فتح الحجز</DetailLink>}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-on-surface-variant">جارٍ التحميل…</p>
      ) : q.isError || !b ? (
        <p className="text-sm text-on-surface-variant">{errorMessage(q.error, 'تعذّر تحميل الحجز.')}</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-space-lg gap-y-3 text-sm">
          <Field label="رقم الحجز" mono>
            {bookingReference(b)}
          </Field>
          <Field label="شركة النقل">{b.trip.company.name}</Field>
          <Field label="خط الرحلة">{routeLabel(b.trip.origin, b.trip.destination)}</Field>
          <Field label="المغادرة">{formatDateTime(b.trip.departureAt)}</Field>
          <Field label="المسافرون">{b.passengers.map((p) => p.fullName).join('، ')}</Field>
          <Field label="الموظف">{b.employee?.displayName ?? '—'}</Field>
        </dl>
      )}
    </Card>
  );
};
