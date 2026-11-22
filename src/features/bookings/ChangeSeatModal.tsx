import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { cn } from '../../lib/utils';
import { useTripDetail } from '../booking/api';
import { SeatMap } from '../booking/SeatMap';
import { toggleSeat } from '../booking/seats';
import { useChangeSeat } from './api';
import { activeTickets } from './change';
import { bookingReference } from './labels';
import type { Booking } from './types';

/**
 * D-CHG-01 seat change on the same trip (free): pick the passenger's ticket, then a free seat on the
 * trip's seat map → POST /broker/bookings/:id/change-seat. The ticket number stays the same.
 */
export const ChangeSeatModal: React.FC<{
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onChanged: (msg: string) => void;
}> = ({ booking, open, onClose, onChanged }) => {
  const tickets = activeTickets(booking);
  const [from, setFrom] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const trip = useTripDetail(open ? booking.trip.id : null);
  const change = useChangeSeat(booking.id);

  const fromLabel = from ?? tickets[0]?.seatLabel ?? null;
  const target = trip.data?.seats.find((s) => s.id === selected[0]);
  const current = tickets.map((t) => t.seatId).filter((id): id is string => id !== null);

  const close = () => {
    if (change.isPending) return;
    setFrom(null);
    setSelected([]);
    change.reset();
    onClose();
  };

  const submit = () => {
    if (!fromLabel || !target) return;
    change.mutate(
      { fromSeatLabel: fromLabel, toSeatLabel: target.label },
      {
        onSuccess: () => {
          onChanged(`نُقل المسافر من المقعد ${fromLabel} إلى المقعد ${target.label}. رقم التذكرة لم يتغير؛ أعد طباعتها بالمقعد الجديد.`);
          setFrom(null);
          setSelected([]);
          change.reset();
        },
        onError: () => void trip.refetch(),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()}>
      <ModalContent size="lg" className="max-h-[92vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>تغيير المقعد — {bookingReference(booking)}</ModalTitle>
          <ModalDescription>على نفس الرحلة وبدون رسوم. اختر المسافر ثم المقعد الجديد.</ModalDescription>
        </ModalHeader>

        <div className="space-y-space-md">
          <div role="radiogroup" aria-label="المسافر" className="flex flex-wrap gap-2">
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.seatLabel === fromLabel}
                onClick={() => setFrom(t.seatLabel)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm text-right',
                  t.seatLabel === fromLabel ? 'border-secondary bg-surface-container-high font-semibold' : 'border-outline-variant/60 hover:bg-surface-container',
                )}
              >
                {t.passengerName ?? '—'} <span className="font-mono text-secondary">({t.seatLabel ?? '—'})</span>
              </button>
            ))}
          </div>

          {trip.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : trip.isError || !trip.data ? (
            <ErrorState title="تعذّر تحميل المقاعد" message={errorMessage(trip.error)} onRetry={() => trip.refetch()} className="my-0" />
          ) : (
            <SeatMap
              seats={trip.data.seats}
              layout={trip.data.layout}
              selected={selected}
              onToggle={(seat) => setSelected(toggleSeat(selected, seat, 1))}
              highlight={current}
              highlightLabel="مقاعد الحجز الحالية"
            />
          )}

          {target && (
            <p className="text-sm">
              المقعد <span className="font-mono font-bold">{fromLabel}</span> ← <span className="font-mono font-bold">{target.label}</span>
              {target.isWomenOnly && <span className="text-pink-600"> — مقعد مخصص للسيدات: يُقبل فقط إذا كانت المسافرة أنثى.</span>}
            </p>
          )}
          {change.isError && <p role="alert" className="text-xs text-error">{errorMessage(change.error)}</p>}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={close} disabled={change.isPending}>
            إغلاق
          </Button>
          <Button icon="airline_seat_recline_normal" onClick={submit} isLoading={change.isPending} disabled={!fromLabel || !target}>
            تأكيد تغيير المقعد
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
