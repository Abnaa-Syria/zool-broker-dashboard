import * as React from 'react';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { formatCountdown } from './countdown';
import { formatPercent } from './totals';
import { routeLabel } from '../bookings/labels';
import { pointLabel } from './labels';
import type { BrokerTrip } from './types';

export type FlowStep = 'search' | 'results' | 'seats' | 'returnResults' | 'returnSeats' | 'passengers' | 'review' | 'success';

const ONE_WAY_STEPS: Array<{ id: FlowStep; label: string }> = [
  { id: 'search', label: 'البحث' },
  { id: 'results', label: 'الرحلات' },
  { id: 'seats', label: 'المقاعد' },
  { id: 'passengers', label: 'المسافرون' },
  { id: 'review', label: 'المراجعة' },
  { id: 'success', label: 'التذاكر' },
];

const ROUND_TRIP_STEPS: Array<{ id: FlowStep; label: string }> = [
  { id: 'search', label: 'البحث' },
  { id: 'results', label: 'رحلة الذهاب' },
  { id: 'seats', label: 'مقاعد الذهاب' },
  { id: 'returnResults', label: 'رحلة العودة' },
  { id: 'returnSeats', label: 'مقاعد العودة' },
  { id: 'passengers', label: 'المسافرون' },
  { id: 'review', label: 'المراجعة' },
  { id: 'success', label: 'التذاكر' },
];

export const StepIndicator: React.FC<{ step: FlowStep; roundTrip?: boolean }> = ({ step, roundTrip = false }) => {
  const STEPS = roundTrip ? ROUND_TRIP_STEPS : ONE_WAY_STEPS;
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="مراحل الحجز">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1">
          <span
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold',
              i === current && 'bg-secondary text-on-secondary',
              i < current && 'bg-surface-container-high text-secondary',
              i > current && 'text-on-surface-variant',
            )}
          >
            <span className="tabular-nums">{i + 1}</span> {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="text-outline">‹</span>}
        </li>
      ))}
    </ol>
  );
};

/** Hold countdown banner; turns red under one minute. */
export const HoldTimer: React.FC<{ seconds: number | null; seatLabels: string[] }> = ({ seconds, seatLabels }) => {
  if (seconds === null) return null;
  const urgent = seconds < 60;
  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-space-md py-2 text-sm',
        urgent ? 'border-error/40 bg-error-container/40 text-on-error-container' : 'border-secondary/30 bg-surface-container-low',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">timer</span>
        المقاعد {seatLabels.join('، ')} محجوزة مؤقتًا لك
      </span>
      <span className="font-mono font-bold tabular-nums text-base" dir="ltr">
        {formatCountdown(seconds)}
      </span>
    </div>
  );
};

export const TripSummary: React.FC<{ trip: BrokerTrip; passengers: number; label?: string; className?: string }> = ({ trip, passengers, label, className }) => (
  <div className={cn('rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-md', className)}>
    <div>
      <div className="text-xs text-on-surface-variant">
        {label && <span className="font-bold text-secondary">{label} • </span>}
        {trip.carrier.name}
        {trip.tripNumber ? ` • ${trip.tripNumber}` : ''}
      </div>
      <div className="font-bold text-on-surface">
        {routeLabel(pointLabel(trip.origin), pointLabel(trip.destination))}
      </div>
      <div className="text-xs text-on-surface-variant">
        {formatDateTime(trip.departureAt)}
        {trip.arrivalAt ? ` — الوصول ${formatDateTime(trip.arrivalAt)}` : ''}
      </div>
    </div>
    <div className="text-left">
      <div className="font-bold tabular-nums">{formatSdg(trip.basePrice)} <span className="text-xs font-normal text-on-surface-variant">للمسافر</span></div>
      <div className="text-xs text-on-surface-variant">
        {passengers} مسافر • عمولتك {formatPercent(trip.commissionPercent)}
      </div>
    </div>
  </div>
);

export const Notice: React.FC<{ tone?: 'error' | 'info'; children: React.ReactNode }> = ({ tone = 'error', children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={cn(
      'rounded-lg border px-space-md py-2 text-sm',
      tone === 'error' ? 'border-error/40 bg-error-container/40 text-on-error-container' : 'border-secondary/30 bg-surface-container-low',
    )}
  >
    {children}
  </div>
);
