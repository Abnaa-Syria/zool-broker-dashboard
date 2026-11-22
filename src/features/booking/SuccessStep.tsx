import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { BookingTickets } from '../bookings/BookingTickets';
import { bookingReference, routeLabel } from '../bookings/labels';
import type { ConfirmResult } from '../bookings/types';

export const SuccessStep: React.FC<{ result: ConfirmResult; onNew: () => void }> = ({ result, onNew }) => {
  const b = result.booking;
  return (
    <div className="space-y-space-md max-w-4xl">
      <Card className="flex flex-wrap items-center justify-between gap-space-md border-[#BBF7D0] bg-[#F0FDF4]">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[36px] text-[#15803D]">check_circle</span>
          <div>
            <div className="text-sm text-on-surface-variant">تم تأكيد الحجز</div>
            <div className="text-2xl font-extrabold font-mono" dir="ltr">
              {bookingReference(b)}
            </div>
            <div className="text-xs text-on-surface-variant">
              {b.trip.company.name} • {routeLabel(b.trip.origin, b.trip.destination)} • {formatDateTime(b.trip.departureAt)}
            </div>
          </div>
        </div>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between gap-6">
            <dt className="text-on-surface-variant">خُصم من المحفظة</dt>
            <dd className="font-bold tabular-nums">{formatSdg(b.totalAmountMinor)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-on-surface-variant">عمولتك المكتسبة</dt>
            <dd className="tabular-nums">{formatSdg(b.commissionAmountMinor)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-on-surface-variant">رصيد المحفظة الآن</dt>
            <dd className="tabular-nums">{formatSdg(result.balanceAfterMinor)}</dd>
          </div>
        </dl>
      </Card>

      <BookingTickets booking={b} canAct />

      <div className="flex flex-wrap gap-2">
        <Button icon="add_circle" onClick={onNew}>
          حجز جديد
        </Button>
        <Link
          to={`/bookings/${b.id}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-outline-variant text-sm hover:bg-surface-container"
        >
          تفاصيل الحجز
        </Link>
      </div>
    </div>
  );
};
