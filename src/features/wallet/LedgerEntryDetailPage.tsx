import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailLink, DetailSkeleton, Field, Row } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useBooking } from '../bookings/api';
import { bookingReference, bookingStatusLabel, routeLabel } from '../bookings/labels';
import { useLedgerEntry, useTopUp, type LedgerEntry } from './api';
import { LEDGER_REFERENCE_LABELS, balanceBeforeMinor, ledgerReferencePath, ledgerTypeLabel, signedAmountMinor } from './logic';
import { TopUpStatusBadge } from './TopUpModal';

const CRUMBS = [{ label: 'المحفظة والشحن', path: '/wallet' }];

const TYPE_HINTS: Record<string, string> = {
  CREDIT_TOPUP: 'إضافة رصيد بعد تأكيد طلب شحن.',
  DEBIT_BOOKING: 'خصم قيمة تذاكر حجز مؤكد (أو فرق سعر عند تعديل الرحلة).',
  CREDIT_REFUND: 'إعادة قيمة حجز ملغى (أو فرق سعر عند تعديل الرحلة) إلى المحفظة.',
  DEBIT_COMMISSION_PAYOUT: 'حركة تسوية عمولة أجرتها المنصة.',
};

/**
 * /wallet/ledger/:entryId — one wallet movement with its balance before/after and the record it
 * belongs to (booking or top-up request). Ledger entries are immutable: there are no actions.
 */
export const LedgerEntryDetailPage: React.FC = () => {
  const { entryId } = useParams();
  const seed = (useLocation().state as { entry?: LedgerEntry } | null)?.entry ?? null;
  const query = useLedgerEntry(entryId, seed);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return (
      <DetailError
        crumbs={[...CRUMBS, { label: 'حركة محفظة' }]}
        notFound={!query.isError}
        notFoundTitle="الحركة غير موجودة"
        notFoundMessage="لم تُعثر على هذه الحركة في سجل محفظة المكتب."
        title="تعذّر تحميل الحركة"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const e = query.data;
  const signed = signedAmountMinor(e);
  const refPath = ledgerReferencePath(e);

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[...CRUMBS, { label: `${ledgerTypeLabel(e.type)} • ${formatDateTime(e.createdAt)}` }]} />
      <PageHeader
        title={ledgerTypeLabel(e.type)}
        subtitle={formatDateTime(e.createdAt)}
        badge={
          <Badge variant={e.direction === 'CREDIT' ? 'success' : 'neutral'} dot>
            {e.direction === 'CREDIT' ? 'إضافة' : 'خصم'}
          </Badge>
        }
        className="mb-0"
      />
      {TYPE_HINTS[e.type] && <p className="text-sm text-on-surface-variant -mt-space-sm">{TYPE_HINTS[e.type]}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المبلغ والرصيد</h2>
          <dl className="space-y-3 text-sm">
            <Row label="الرصيد قبل الحركة">{formatSdg(balanceBeforeMinor(e))}</Row>
            <Row label="المبلغ">
              <span className={cn('font-semibold', signed < 0 ? 'text-error' : 'text-[#15803D]')} dir="ltr">
                {signed < 0 ? '−' : '+'}
                {formatSdg(Math.abs(signed))}
              </span>
            </Row>
            <Row label="الرصيد بعد الحركة" strong>
              {formatSdg(e.balanceAfterMinor)}
            </Row>
          </dl>
        </Card>
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">بيانات الحركة</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="النوع">{ledgerTypeLabel(e.type)}</Field>
            <Field label="الاتجاه">{e.direction === 'CREDIT' ? 'إضافة للرصيد' : 'خصم من الرصيد'}</Field>
            <Field label="التاريخ">{formatDateTime(e.createdAt)}</Field>
            <Field label="المرجع">
              {e.referenceType ? (
                refPath ? (
                  <DetailLink to={refPath}>{LEDGER_REFERENCE_LABELS[e.referenceType] ?? e.referenceType}</DetailLink>
                ) : (
                  (LEDGER_REFERENCE_LABELS[e.referenceType] ?? e.referenceType)
                )
              ) : (
                '—'
              )}
            </Field>
            <Field label="رقم الحركة" mono>
              {e.id}
            </Field>
            {e.referenceId && (
              <Field label="رقم المرجع" mono>
                {e.referenceId}
              </Field>
            )}
          </dl>
        </Card>
      </div>

      {e.referenceType === 'booking' && e.referenceId && <BookingReference bookingId={e.referenceId} />}
      {e.referenceType === 'top_up_intent' && e.referenceId && <TopUpReference intentId={e.referenceId} />}
      {e.referenceType === 'commission_settlement' && (
        <p className="text-xs text-on-surface-variant">تفاصيل تسويات العمولة تديرها المنصة ولا تتوفر لها صفحة في لوحة المكتب.</p>
      )}
    </div>
  );
};

const BookingReference: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const q = useBooking(bookingId);
  return (
    <Card className="space-y-space-sm">
      <h2 className="font-bold">الحجز المرتبط</h2>
      {q.isLoading ? (
        <p className="text-sm text-on-surface-variant">جارٍ التحميل…</p>
      ) : q.isError || !q.data ? (
        <p className="text-sm text-on-surface-variant">{errorMessage(q.error, 'تعذّر تحميل الحجز.')} قد يكون الحجز لموظف آخر.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <DetailLink to={`/bookings/${q.data.id}`} className="font-mono">
              {bookingReference(q.data)}
            </DetailLink>
            <div className="text-on-surface-variant">
              {q.data.trip.company.name} • {routeLabel(q.data.trip.origin, q.data.trip.destination)} • {formatDateTime(q.data.trip.departureAt)}
            </div>
            <div className="text-xs text-on-surface-variant">
              {q.data.passengers.length} مسافر • {formatSdg(q.data.totalAmountMinor)}
              {q.data.employee ? ` • ${q.data.employee.displayName}` : ''}
            </div>
          </div>
          <Badge variant={bookingStatusLabel(q.data.status).variant} dot>
            {bookingStatusLabel(q.data.status).label}
          </Badge>
        </div>
      )}
    </Card>
  );
};

const TopUpReference: React.FC<{ intentId: string }> = ({ intentId }) => {
  const { can, isManager } = useAuth();
  const allowed = can('broker.wallet.topup') || isManager;
  const q = useTopUp(allowed ? intentId : null);
  return (
    <Card className="space-y-space-sm">
      <h2 className="font-bold">طلب الشحن المرتبط</h2>
      {!allowed ? (
        <p className="text-sm text-on-surface-variant">طلبات الشحن متاحة لمدير المكتب ولمن يملك صلاحية الشحن.</p>
      ) : q.isLoading ? (
        <p className="text-sm text-on-surface-variant">جارٍ التحميل…</p>
      ) : q.isError || !q.data ? (
        <p className="text-sm text-on-surface-variant">{errorMessage(q.error, 'تعذّر تحميل طلب الشحن.')}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <DetailLink to={`/wallet/top-ups/${q.data.id}`}>طلب شحن {formatSdg(q.data.amountMinor)}</DetailLink>
            <div className="text-xs text-on-surface-variant">أُنشئ {formatDateTime(q.data.createdAt)}</div>
          </div>
          <TopUpStatusBadge status={q.data.status} />
        </div>
      )}
    </Card>
  );
};
