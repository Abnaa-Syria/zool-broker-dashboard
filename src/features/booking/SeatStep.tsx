import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatSdg } from '../../lib/money';
import { SeatMap } from './SeatMap';
import { toggleSeat } from './seats';
import { estimateBooking } from './totals';
import type { BrokerTripDetail } from './types';

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
  heading?: string;
}> = ({ trip, loading, error, onRetry, passengers, selected, onSelect, onBack, onContinue, holding, heading }) => {
  if (loading) return <Skeleton className="h-72 rounded-xl" />;
  if (error || !trip) return <ErrorState title="تعذّر تحميل المقاعد" message={errorMessage(error)} onRetry={onRetry} />;

  const remaining = passengers - selected.length;
  const estimate = estimateBooking(trip.basePrice, Math.max(selected.length, 1), trip.commissionPercent);

  return (
    <div className="space-y-space-md">
      {heading && <h2 className="font-bold text-on-surface">{heading}</h2>}
      <SeatMap seats={trip.seats} layout={trip.layout} selected={selected} onToggle={(seat) => onSelect(toggleSeat(selected, seat, passengers))} />

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
