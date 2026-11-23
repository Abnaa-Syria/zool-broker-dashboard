import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailLink, Field, Row } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useBookingLedgerEntries } from '../wallet/api';
import { ledgerTypeLabel, signedAmountMinor } from '../wallet/logic';
import { useBooking, useCancelBooking } from './api';
import { BookingTickets } from './BookingTickets';
import { canChangeBooking } from './change';
import { ChangeSeatModal } from './ChangeSeatModal';
import {
  boardingStatusLabel,
  bookingReference,
  bookingStatusLabel,
  channelLabel,
  commissionStatusLabel,
  genderLabel,
  legLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  refundReasonLabel,
  refundStatusLabel,
  routeLabel,
} from './labels';
import type { Booking, CancelResult } from './types';

/**
 * GET /broker/bookings/:id — trip, passengers, tickets (thermal print with the signed QR + PDF) and
 * boarding status, payment and its wallet movements, commission, change history (D-CHG-01) and
 * round-trip leg (D-RT-01). Actions: cancel (refund to wallet — the API has no booking delete),
 * change seat, change trip.
 */
export const BookingDetailPage: React.FC = () => {
  const { id } = useParams();
  const query = useBooking(id);
  const navigate = useNavigate();
  const location = useLocation();
  const changedFrom = (location.state as { changedFrom?: string } | null)?.changedFrom;
  const { employee, can, isManager } = useAuth();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelled, setCancelled] = React.useState<CancelResult | null>(null);
  const [seatOpen, setSeatOpen] = React.useState(false);
  const [seatChanged, setSeatChanged] = React.useState<string | null>(null);
  const ledger = useBookingLedgerEntries(query.data?.id, query.data?.createdAt);

  if (query.isLoading) {
    return (
      <div className="space-y-space-md">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.code === 'NOT_FOUND';
    return (
      <div className="space-y-space-md">
        <DetailCrumbs items={[{ label: 'الحجوزات والتذاكر', path: '/bookings' }, { label: 'حجز' }]} />
        <ErrorState
          title={notFound ? 'الحجز غير موجود' : 'تعذّر تحميل الحجز'}
          message={notFound ? 'قد يكون الحجز لموظف آخر أو غير تابع لمكتبك.' : errorMessage(query.error)}
          onRetry={notFound ? undefined : () => query.refetch()}
        />
      </div>
    );
  }

  const b = query.data;
  const status = bookingStatusLabel(b.status);
  const canBook = can('broker.book');
  const canCancel = canBook && b.status === 'CONFIRMED' && (isManager || b.employee?.id === employee?.id);
  const canChange = canChangeBooking(b, canBook);
  const wholeOffice = isManager || can('broker.reports.view');
  const leg = legLabel(b.leg);

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[{ label: 'الحجوزات والتذاكر', path: '/bookings' }, { label: `حجز ${bookingReference(b)}` }]} />
      <PageHeader
        title={`حجز ${bookingReference(b)}`}
        subtitle={`${b.trip.company.name} • ${routeLabel(b.trip.origin, b.trip.destination)}`}
        badge={
          <div className="flex gap-1">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            {leg && <Badge variant="info">{leg}</Badge>}
          </div>
        }
        actions={
          canCancel || canChange ? (
            <div className="flex flex-wrap gap-2">
              {canChange && (
                <>
                  <Button variant="outline" icon="airline_seat_recline_normal" onClick={() => setSeatOpen(true)}>
                    تغيير المقعد
                  </Button>
                  <Button variant="outline" icon="published_with_changes" onClick={() => navigate(`/bookings/${b.id}/change`)}>
                    تغيير الرحلة
                  </Button>
                </>
              )}
              {canCancel && (
                <Button variant="danger" icon="cancel" onClick={() => setCancelOpen(true)}>
                  إلغاء الحجز
                </Button>
              )}
            </div>
          ) : undefined
        }
        className="mb-0"
      />

      {changedFrom && (
        <div role="status" className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7] px-space-md py-2 text-sm text-[#15803D]">
          تم تعديل الرحلة: هذا هو الحجز الجديد بدلًا من {changedFrom} (أصبح «مُعدّل» وتذاكره ملغاة). اطبع التذاكر الجديدة للمسافرين.
        </div>
      )}
      {seatChanged && (
        <div role="status" className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7] px-space-md py-2 text-sm text-[#15803D]">
          {seatChanged}
        </div>
      )}
      {b.status === 'CHANGED' && (
        <div role="status" className="rounded-lg border border-secondary/30 bg-surface-container-low px-space-md py-2 text-sm">
          نُقل هذا الحجز إلى رحلة أخرى وصدر بدلًا منه حجز جديد بتذاكر جديدة؛ تذاكر هذا الحجز لم تعد صالحة للصعود.{' '}
          {b.replacedByBookingId ? (
            <Link to={`/bookings/${b.replacedByBookingId}`} className="font-semibold text-secondary underline">
              فتح الحجز الجديد
            </Link>
          ) : (
            'ابحث عن الحجز الجديد في قائمة الحجوزات باسم المسافر.'
          )}
        </div>
      )}

      {cancelled && (
        <div role="status" className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7] px-space-md py-2 text-sm text-[#15803D]">
          أُلغي الحجز وأُعيد {formatSdg(cancelled.refundedAmountMinor)} إلى محفظة المكتب. الرصيد الآن {formatSdg(cancelled.balanceAfterMinor)}.
          {cancelled.commissionClawedBackMinor > 0 && <> واستُردت عمولة قدرها {formatSdg(cancelled.commissionClawedBackMinor)}.</>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">الرحلة</h2>
            <DetailLink to={`/trips/${b.trip.id}`} className="text-sm">
              تفاصيل الرحلة والمقاعد
            </DetailLink>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="شركة النقل">{b.trip.company.name}</Field>
            <Field label="خط الرحلة">{routeLabel(b.trip.origin, b.trip.destination)}</Field>
            <Field label="موعد المغادرة">{formatDateTime(b.trip.departureAt)}</Field>
            <Field label="المقاعد">{b.tickets.map((t) => t.seatLabel ?? '—').join('، ')}</Field>
            <Field label="الموظف">
              {b.employee ? (
                can('broker.staff.manage') ? (
                  <DetailLink to={`/staff/${b.employee.id}`}>{b.employee.displayName}</DetailLink>
                ) : (
                  b.employee.displayName
                )
              ) : (
                '—'
              )}
            </Field>
            <Field label="المكتب">{b.office ? `${b.office.name} (${b.office.code})` : '—'}</Field>
            <Field label="تاريخ التأكيد">{formatDateTime(b.confirmedAt ?? b.createdAt)}</Field>
            <Field label="تاريخ الإنشاء">{formatDateTime(b.createdAt)}</Field>
            {b.status === 'CANCELLED' && <Field label="تاريخ الإلغاء">{formatDateTime(b.cancelledAt)}</Field>}
            {b.cancelReason && <Field label="سبب الإلغاء">{b.cancelReason}</Field>}
          </dl>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المبالغ والعمولة</h2>
          <dl className="space-y-3 text-sm">
            <Row label="إجمالي التذاكر (خُصم من المحفظة)" strong>
              {formatSdg(b.totalAmountMinor)}
            </Row>
            <Row label="العمولة المكتسبة">{formatSdg(b.commissionAmountMinor)}</Row>
            <Row label="حالة العمولة">{commissionStatusLabel(b.commissionStatus)}</Row>
          </dl>
          {b.status === 'CANCELLED' && <p className="text-xs text-on-surface-variant">أُعيد إجمالي التذاكر إلى محفظة المكتب عند الإلغاء.</p>}
          {can('broker.reports.view') && b.commissionStatus && (
            <DetailLink to={`/commissions/booking/${b.id}`} className="text-sm">
              سجل العمولة
            </DetailLink>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="space-y-space-sm">
          <h2 className="font-bold">الدفع</h2>
          <dl className="space-y-3 text-sm">
            <Row label="القناة">{channelLabel(b.channel)}</Row>
            <Row label="طريقة الدفع">{paymentMethodLabel(b.paymentMethod)}</Row>
            <Row label="حالة الدفع">{paymentStatusLabel(b.paymentStatus)}</Row>
          </dl>
          <div className="pt-2 border-t border-outline-variant/30 space-y-2">
            <h3 className="text-xs font-bold text-on-surface-variant">الاستردادات</h3>
            {(b.refunds ?? []).length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                لا توجد سجلات استرداد.{b.status === 'CANCELLED' ? ' استرداد إلغاء المكتب يُعاد مباشرة إلى المحفظة (انظر حركات المحفظة).' : ''}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(b.refunds ?? []).map((r) => {
                  const st = refundStatusLabel(r.status);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-1">
                      <span className="tabular-nums font-semibold">{formatSdg(r.amountMinor)}</span>
                      <Badge size="sm" variant={st.variant}>
                        {st.label}
                      </Badge>
                      <span className="basis-full text-xs text-on-surface-variant">
                        {refundReasonLabel(r.reason)} • {formatDateTime(r.createdAt)}
                        {r.processedAt ? ` • نُفّذ ${formatDateTime(r.processedAt)}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">حركات المحفظة لهذا الحجز</h2>
          {ledger.isLoading ? (
            <p className="text-sm text-on-surface-variant">جارٍ التحميل…</p>
          ) : ledger.isError ? (
            <p className="text-sm text-on-surface-variant">{errorMessage(ledger.error, 'تعذّر تحميل حركات المحفظة.')}</p>
          ) : (ledger.data ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">لا توجد حركات محفظة مسجلة لهذا الحجز.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/30 text-sm">
              {(ledger.data ?? []).map((e) => {
                const signed = signedAmountMinor(e);
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link to={`/wallet/ledger/${e.id}`} state={{ entry: e }} className="text-secondary hover:underline">
                      {ledgerTypeLabel(e.type)}
                    </Link>
                    <span className="text-xs text-on-surface-variant">{formatDateTime(e.createdAt)}</span>
                    <span className={cn('tabular-nums font-semibold', signed < 0 ? 'text-error' : 'text-[#15803D]')} dir="ltr">
                      {signed < 0 ? '−' : '+'}
                      {formatSdg(Math.abs(signed))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="space-y-space-sm">
        <h2 className="font-bold">سجل التعديلات</h2>
        <ul className="space-y-2 text-sm">
          <li>
            تأكيد الحجز: <strong>{formatDateTime(b.confirmedAt ?? b.createdAt)}</strong>
          </li>
          {b.replacesBookingId && (
            <li>
              صدر هذا الحجز بتعديل رحلة <DetailLink to={`/bookings/${b.replacesBookingId}`}>الحجز السابق</DetailLink>.
            </li>
          )}
          {b.replacedByBookingId && (
            <li>
              نُقل هذا الحجز إلى رحلة أخرى في <DetailLink to={`/bookings/${b.replacedByBookingId}`}>الحجز الجديد</DetailLink>.
            </li>
          )}
          <li>
            عدد التعديلات (تغيير مقعد أو رحلة): <strong className="tabular-nums">{b.changeCount ?? 0}</strong>
          </li>
          {b.status === 'CANCELLED' && (
            <li>
              الإلغاء: <strong>{formatDateTime(b.cancelledAt)}</strong>
              {b.cancelReason ? ` — ${b.cancelReason}` : ''}
            </li>
          )}
          {leg && (
            <li>
              {leg} ضمن حجز ذهاب وعودة{wholeOffice ? '؛ الرحلة الأخرى تظهر في قائمة الحجوزات باسم المسافر نفسه' : ''}.
            </li>
          )}
        </ul>
      </Card>

      <section className="space-y-space-sm">
        <h2 className="font-bold">المسافرون ({b.passengers.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {b.passengers.map((p) => {
            const ticket = b.tickets.find((t) => t.passengerId === p.id);
            const seat = ticket?.seatLabel;
            const boarding = ticket && ticket.status === 'CONFIRMED' ? boardingStatusLabel(ticket.boardingStatus) : null;
            return (
              <Card key={p.id} variant="flat" className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.fullName}</div>
                  <div className="text-xs text-on-surface-variant" dir="ltr">{p.phone ?? '—'}</div>
                  {p.idNumber && <div className="text-xs text-on-surface-variant">هوية: {p.idNumber}</div>}
                  {genderLabel(p.gender) && <div className="text-xs text-on-surface-variant">{genderLabel(p.gender)}</div>}
                  {ticket && (
                    <div className="text-[11px] font-mono text-on-surface-variant" dir="ltr">
                      {ticket.ticketNumber}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {seat && <Badge variant="info">مقعد {seat}</Badge>}
                  {boarding && (
                    <Badge size="sm" variant={boarding.variant} title="حالة الصعود">
                      {boarding.label}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <BookingTickets booking={b} canAct={canBook} />

      {canChange && (
        <ChangeSeatModal
          booking={b}
          open={seatOpen}
          onClose={() => setSeatOpen(false)}
          onChanged={(msg) => {
            setSeatChanged(msg);
            setSeatOpen(false);
          }}
        />
      )}

      <CancelBookingModal
        booking={b}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onCancelled={(r) => {
          setCancelled(r);
          setCancelOpen(false);
        }}
      />
    </div>
  );
};

const CancelBookingModal: React.FC<{
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onCancelled: (result: CancelResult) => void;
}> = ({ booking, open, onClose, onCancelled }) => {
  const cancel = useCancelBooking(booking.id);
  const settled = booking.commissionStatus === 'SETTLED' || booking.commissionStatus === 'RESERVED';
  return (
    <Modal open={open} onOpenChange={(o) => !o && !cancel.isPending && onClose()}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>إلغاء الحجز {bookingReference(booking)}؟</ModalTitle>
          <ModalDescription>لا يمكن التراجع عن الإلغاء.</ModalDescription>
        </ModalHeader>
        <ul className="text-sm space-y-2 list-disc pr-5">
          <li>
            سيُعاد <strong>{formatSdg(booking.totalAmountMinor)}</strong> إلى محفظة المكتب.
          </li>
          <li>
            تُسترد عمولة الحجز ({formatSdg(booking.commissionAmountMinor)}){settled ? ' رغم أنها دخلت في تسوية سابقة' : ''}.
          </li>
          <li>تُلغى {booking.tickets.length} تذكرة وتعود المقاعد متاحة للبيع.</li>
        </ul>
        {cancel.isError && <p className="text-xs text-error">{errorMessage(cancel.error)}</p>}
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            تراجع
          </Button>
          <Button variant="danger" isLoading={cancel.isPending} onClick={() => cancel.mutate(undefined, { onSuccess: onCancelled })}>
            تأكيد الإلغاء
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
