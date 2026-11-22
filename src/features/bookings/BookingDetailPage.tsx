import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
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
import { useAuth } from '../auth/auth-context';
import { useBooking, useCancelBooking } from './api';
import { BookingTickets } from './BookingTickets';
import { bookingReference, routeLabel, bookingStatusLabel, commissionStatusLabel } from './labels';
import type { Booking, CancelResult } from './types';

/** GET /broker/bookings/:id — details, cancel (refund to wallet), tickets (thermal print + PDF). */
export const BookingDetailPage: React.FC = () => {
  const { id } = useParams();
  const query = useBooking(id);
  const { employee, can, isManager } = useAuth();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelled, setCancelled] = React.useState<CancelResult | null>(null);

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
        <BackLink />
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

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <BackLink />
      <PageHeader
        title={`حجز ${bookingReference(b)}`}
        subtitle={`${b.trip.company.name} • ${routeLabel(b.trip.origin, b.trip.destination)}`}
        badge={<Badge variant={status.variant} dot>{status.label}</Badge>}
        actions={
          canCancel ? (
            <Button variant="danger" icon="cancel" onClick={() => setCancelOpen(true)}>
              إلغاء الحجز
            </Button>
          ) : undefined
        }
        className="mb-0"
      />

      {cancelled && (
        <div role="status" className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7] px-space-md py-2 text-sm text-[#15803D]">
          أُلغي الحجز وأُعيد {formatSdg(cancelled.refundedAmountMinor)} إلى محفظة المكتب. الرصيد الآن {formatSdg(cancelled.balanceAfterMinor)}.
          {cancelled.commissionClawedBackMinor > 0 && <> واستُردت عمولة قدرها {formatSdg(cancelled.commissionClawedBackMinor)}.</>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">الرحلة</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Item label="شركة النقل" value={b.trip.company.name} />
            <Item label="خط الرحلة" value={routeLabel(b.trip.origin, b.trip.destination)} />
            <Item label="موعد المغادرة" value={formatDateTime(b.trip.departureAt)} />
            <Item label="المقاعد" value={b.tickets.map((t) => t.seatLabel ?? '—').join('، ')} />
            <Item label="الموظف" value={b.employee?.displayName ?? '—'} />
            <Item label="تاريخ التأكيد" value={formatDateTime(b.confirmedAt ?? b.createdAt)} />
            {b.status === 'CANCELLED' && <Item label="تاريخ الإلغاء" value={formatDateTime(b.cancelledAt)} />}
            {b.cancelReason && <Item label="سبب الإلغاء" value={b.cancelReason} />}
          </dl>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المبالغ</h2>
          <dl className="space-y-3 text-sm">
            <Row label="إجمالي التذاكر (خُصم من المحفظة)" value={formatSdg(b.totalAmountMinor)} strong />
            <Row label="العمولة المكتسبة" value={formatSdg(b.commissionAmountMinor)} />
            <Row label="حالة العمولة" value={commissionStatusLabel(b.commissionStatus)} />
          </dl>
          {b.status === 'CANCELLED' && <p className="text-xs text-on-surface-variant">أُعيد إجمالي التذاكر إلى محفظة المكتب عند الإلغاء.</p>}
        </Card>
      </div>

      <section className="space-y-space-sm">
        <h2 className="font-bold">المسافرون ({b.passengers.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {b.passengers.map((p) => {
            const seat = b.tickets.find((t) => t.passengerId === p.id)?.seatLabel;
            return (
              <Card key={p.id} variant="flat" className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.fullName}</div>
                  <div className="text-xs text-on-surface-variant" dir="ltr">{p.phone ?? '—'}</div>
                  {p.idNumber && <div className="text-xs text-on-surface-variant">هوية: {p.idNumber}</div>}
                </div>
                {seat && <Badge variant="info">مقعد {seat}</Badge>}
              </Card>
            );
          })}
        </div>
      </section>

      <BookingTickets booking={b} canAct={canBook} />

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

const BackLink = () => (
  <Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline self-start">
    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    الحجوزات
  </Link>
);

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={strong ? 'font-bold tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  );
}

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
