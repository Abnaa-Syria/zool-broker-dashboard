import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { hasLayout, layoutGrid, seatView, sortSeats, toggleSeat, type SeatView } from './seats';
import { estimateBooking } from './totals';
import type { BrokerTripDetail, TripSeat } from './types';

const VIEW_CLASS: Record<SeatView, string> = {
  selected: 'bg-secondary text-on-secondary border-secondary',
  free: 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-secondary hover:bg-surface-container',
  mine: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] hover:border-secondary',
  taken: 'bg-surface-container-high text-outline border-transparent cursor-not-allowed line-through',
};

const VIEW_LABEL: Record<SeatView, string> = {
  selected: 'مختار',
  free: 'متاح',
  mine: 'محجوز مؤقتًا لك',
  taken: 'غير متاح',
};

export const SeatStep: React.FC<{
  trip: BrokerTripDetail | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  passengers: number;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
  holding: boolean;
}> = ({ trip, loading, error, onRetry, passengers, selected, onSelect, onBack, onContinue, holding }) => {
  if (loading) return <Skeleton className="h-72 rounded-xl" />;
  if (error || !trip) return <ErrorState title="تعذّر تحميل المقاعد" message={errorMessage(error)} onRetry={onRetry} />;

  const seats = trip.seats;
  const anyWomen = seats.some((s) => s.isWomenOnly);
  const remaining = passengers - selected.length;
  const estimate = estimateBooking(trip.basePrice, Math.max(selected.length, 1), trip.commissionPercent);

  const renderSeat = (seat: TripSeat) => {
    const view = seatView(seat, selected);
    return (
      <button
        key={seat.id}
        type="button"
        disabled={view === 'taken'}
        aria-pressed={view === 'selected'}
        aria-label={`مقعد ${seat.label}: ${VIEW_LABEL[view]}${seat.isWomenOnly ? '، مخصص للسيدات' : ''}`}
        onClick={() => onSelect(toggleSeat(selected, seat, passengers))}
        className={cn(
          'relative h-11 min-w-11 px-2 rounded-lg border text-sm font-mono font-bold transition-colors',
          VIEW_CLASS[view],
          seat.isWomenOnly && view !== 'selected' && 'ring-2 ring-pink-300',
        )}
      >
        {seat.label}
        {seat.isWomenOnly && <span className="material-symbols-outlined absolute -top-2 -left-2 text-[14px] text-pink-500 bg-white rounded-full">woman</span>}
      </button>
    );
  };

  return (
    <div className="space-y-space-md">
      <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        {(['free', 'selected', 'mine', 'taken'] as SeatView[]).map((v) => (
          <span key={v} className="flex items-center gap-1">
            <span className={cn('inline-block w-4 h-4 rounded border', VIEW_CLASS[v])} /> {VIEW_LABEL[v]}
          </span>
        ))}
        {anyWomen && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded border ring-2 ring-pink-300" /> مخصص للسيدات
          </span>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md">
        {hasLayout(seats) ? (
          <div className="inline-flex flex-col gap-2">
            {layoutGrid(seats).map((row, r) => (
              <div key={r} className="flex gap-2">
                {row.map((seat, c) => (
                  <React.Fragment key={`cell-${r}-${c}`}>
                    {seat ? renderSeat(seat) : <span className="w-11" aria-hidden="true" />}
                    {trip.layout && c + 1 === trip.layout.aisleAfterColumn && <span className="w-6" aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">{sortSeats(seats).map(renderSeat)}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="text-sm">
          {remaining > 0 ? (
            <span>
              اختر <strong>{remaining}</strong> {remaining === 1 ? 'مقعدًا' : 'مقاعد'} إضافية ({selected.length}/{passengers})
            </span>
          ) : (
            <span>
              الإجمالي المتوقع <strong className="tabular-nums">{formatSdg(estimate.totalMinor)}</strong>
              <span className="text-on-surface-variant"> • عمولتك {formatSdg(estimate.commissionMinor)}</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={holding}>
            رجوع
          </Button>
          <Button icon="lock_clock" onClick={onContinue} disabled={selected.length !== passengers} isLoading={holding}>
            حجز المقاعد مؤقتًا والمتابعة
          </Button>
        </div>
      </div>
    </div>
  );
};
