import * as React from 'react';
import { cn } from '../../lib/utils';
import { hasLayout, layoutGrid, seatView, sortSeats, type SeatView } from './seats';
import type { SeatLayout, TripSeat } from './types';

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

/**
 * Seat map of a trip (GET /broker/trips/:id): legend + vehicle grid with the aisle, or a plain
 * label-ordered list for legacy trips without a layout. Women-only seats carry a pink ring.
 * `highlight`: seat ids to mark (e.g. the booking's current seats) while they are not selectable.
 */
export const SeatMap: React.FC<{
  seats: TripSeat[];
  layout: SeatLayout | null;
  selected: readonly string[];
  onToggle: (seat: TripSeat) => void;
  highlight?: readonly string[];
  highlightLabel?: string;
  /** View only (trip detail page): seats are not clickable. */
  readOnly?: boolean;
}> = ({ seats, layout, selected, onToggle, highlight = [], highlightLabel, readOnly = false }) => {
  const anyWomen = seats.some((s) => s.isWomenOnly);

  const renderSeat = (seat: TripSeat) => {
    const view = seatView(seat, selected);
    const current = highlight.includes(seat.id);
    return (
      <button
        key={seat.id}
        type="button"
        disabled={readOnly || view === 'taken'}
        aria-pressed={readOnly ? undefined : view === 'selected'}
        aria-label={`مقعد ${seat.label}: ${current && highlightLabel ? highlightLabel : VIEW_LABEL[view]}${seat.isWomenOnly ? '، مخصص للسيدات' : ''}`}
        onClick={() => onToggle(seat)}
        className={cn(
          'relative h-11 min-w-11 px-2 rounded-lg border text-sm font-mono font-bold transition-colors',
          VIEW_CLASS[view],
          readOnly && view !== 'taken' && 'cursor-default hover:border-outline-variant hover:bg-surface-container-lowest',
          current && 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD] no-underline',
          seat.isWomenOnly && view !== 'selected' && 'ring-2 ring-pink-300',
        )}
      >
        {seat.label}
        {seat.isWomenOnly && <span className="material-symbols-outlined absolute -top-2 -left-2 text-[14px] text-pink-500 bg-white rounded-full">woman</span>}
      </button>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        {(readOnly ? (['free', 'mine', 'taken'] as SeatView[]) : (['free', 'selected', 'mine', 'taken'] as SeatView[])).map((v) => (
          <span key={v} className="flex items-center gap-1">
            <span className={cn('inline-block w-4 h-4 rounded border', VIEW_CLASS[v])} /> {VIEW_LABEL[v]}
          </span>
        ))}
        {highlight.length > 0 && highlightLabel && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded border bg-[#DBEAFE] border-[#93C5FD]" /> {highlightLabel}
          </span>
        )}
        {anyWomen && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded border ring-2 ring-pink-300" /> مخصص للسيدات
          </span>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md overflow-x-auto">
        {hasLayout(seats) ? (
          <div className="inline-flex flex-col gap-2">
            {layoutGrid(seats).map((row, r) => (
              <div key={r} className="flex gap-2">
                {row.map((seat, c) => (
                  <React.Fragment key={`cell-${r}-${c}`}>
                    {seat ? renderSeat(seat) : <span className="w-11" aria-hidden="true" />}
                    {layout && c + 1 === layout.aisleAfterColumn && <span className="w-6" aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">{sortSeats(seats).map(renderSeat)}</div>
        )}
      </div>
    </>
  );
};
