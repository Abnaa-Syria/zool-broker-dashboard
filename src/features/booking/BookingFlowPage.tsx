import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { useAuth } from '../auth/auth-context';
import type { ConfirmResult } from '../bookings/types';
import { bookingApi, releaseHolds, useTripDetail, type TripSearch } from './api';
import { earliestDeadline, holdDeadline, useCountdown } from './countdown';
import { HoldTimer, Notice, StepIndicator, TripSummary, type FlowStep } from './parts';
import { emptyPassenger, resizeDrafts, toPassengerInput, type PassengerDraft } from './passengers';
import { PassengersStep } from './PassengersStep';
import { ResultsStep } from './ResultsStep';
import { ReviewStep } from './ReviewStep';
import { SearchStep } from './SearchStep';
import { SeatStep } from './SeatStep';
import { orderedSelection, planHolds, pruneSelection } from './seats';
import { SuccessStep } from './SuccessStep';
import type { BrokerTrip, TripSeat } from './types';

type HoldState = { holdIds: string[]; seats: TripSeat[]; deadline: number };

const INITIAL_SEARCH: TripSearch = { origin: '', destination: '', date: '', passengers: 1 };

/** Codes that mean the seats are gone or no longer held: the user must pick seats again. */
const BACK_TO_SEATS = new Set(['HOLD_REQUIRED', 'HOLD_EXPIRED', 'SEAT_UNAVAILABLE', 'NOT_FOUND']);

function codeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

/**
 * /booking/new — search → trip → seats (hold) → passengers → review (quote) → confirm → tickets.
 * Holds are released on back / cancel / leaving the page; confirm uses one idempotency key per attempt.
 */
export const BookingFlowPage: React.FC = () => {
  const { can, employee } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = React.useState<FlowStep>('search');
  const [search, setSearch] = React.useState<TripSearch>(INITIAL_SEARCH);
  const [trip, setTrip] = React.useState<BrokerTrip | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [hold, setHold] = React.useState<HoldState | null>(null);
  const [drafts, setDrafts] = React.useState<PassengerDraft[]>([emptyPassenger()]);
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ConfirmResult | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Holds still owned when the page unmounts are released (best effort; they also expire server-side).
  const holdRef = React.useRef<HoldState | null>(null);
  React.useEffect(() => {
    holdRef.current = hold;
  }, [hold]);
  React.useEffect(
    () => () => {
      if (holdRef.current) void releaseHolds(holdRef.current.holdIds);
    },
    [],
  );

  const tripDetail = useTripDetail(step === 'seats' && trip ? trip.id : null);
  const seconds = useCountdown(hold?.deadline ?? null);
  // Seats taken by someone else since they were clicked drop out of the selection.
  const liveSelection = React.useMemo(
    () => (tripDetail.data ? pruneSelection(selected, tripDetail.data.seats) : selected),
    [selected, tripDetail.data],
  );

  const passengerInputs = React.useMemo(() => drafts.map(toPassengerInput), [drafts]);
  const seatIds = React.useMemo(() => hold?.seats.map((s) => s.id) ?? [], [hold]);

  const quote = useQuery({
    queryKey: ['broker-quote', trip?.id, seatIds, passengerInputs],
    enabled: step === 'review' && trip !== null && seatIds.length > 0,
    retry: false,
    gcTime: 0,
    queryFn: () => bookingApi.quote({ tripId: trip!.id, seatIds, passengers: passengerInputs }),
  });

  const confirming = React.useRef(false);
  const confirm = useMutation({
    mutationFn: (key: string) => bookingApi.confirm({ tripId: trip!.id, seatIds, passengers: passengerInputs, idempotencyKey: key }),
    onSuccess: (res) => {
      setHold(null); // consumed by the booking
      setResult(res);
      setStep('success');
      void qc.invalidateQueries({ queryKey: ['broker-wallet'] });
      void qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['broker-bookings'] });
    },
    onError: (error) => {
      const code = codeOf(error);
      if (code && BACK_TO_SEATS.has(code)) backToSeats(errorMessage(error));
    },
    onSettled: () => {
      confirming.current = false;
    },
  });

  const holdSeats = useMutation({
    mutationFn: async () => {
      const seats = tripDetail.data?.seats ?? [];
      const plan = planHolds(liveSelection, seats);
      if (plan.release.length) await releaseHolds(plan.release);
      const created = plan.toHold.length ? await bookingApi.hold(trip!.id, plan.toHold) : null;
      const receivedAt = Date.now();
      const reusedDeadlines = plan.reuse.map((r) => holdDeadline(r.remainingSeconds ?? 0, tripDetail.dataUpdatedAt || receivedAt));
      const deadline = earliestDeadline([...(created ? [holdDeadline(created.remainingSeconds, receivedAt)] : []), ...reusedDeadlines]);
      return {
        holdIds: [...plan.reuse.map((r) => r.holdId), ...(created?.holds.map((h) => h.id) ?? [])],
        seats: orderedSelection(liveSelection, seats),
        deadline: deadline ?? receivedAt,
      } satisfies HoldState;
    },
    onSuccess: (h) => {
      setHold(h);
      setDrafts((d) => resizeDrafts(d, h.seats.length));
      setNotice(null);
      setStep('passengers');
    },
    onError: (error) => {
      setNotice(errorMessage(error));
      void tripDetail.refetch();
    },
  });

  /**
   * Back to seat selection: release the hold (a no-op when it already expired), then reload the
   * seat map so freed seats show as available again. The selection is kept and pruned.
   */
  function backToSeats(message: string | null) {
    const ids = hold?.holdIds ?? [];
    setHold(null);
    setAttemptKey(null);
    setNotice(message);
    setStep('seats');
    void releaseHolds(ids).then(() => qc.invalidateQueries({ queryKey: ['broker-trip', trip?.id] }));
  }

  // Hold ran out while entering passengers / reviewing: back to seats (the server already freed them).
  if (seconds === 0 && hold && (step === 'passengers' || step === 'review') && !confirm.isPending) {
    setHold(null);
    setAttemptKey(null);
    setNotice(errorMessage(new ApiError({ status: 409, code: 'HOLD_EXPIRED', message: 'Hold expired' })));
    setStep('seats');
  }

  const reset = () => {
    if (hold) void releaseHolds(hold.holdIds);
    setHold(null);
    setTrip(null);
    setSelected([]);
    setDrafts([emptyPassenger()]);
    setAttemptKey(null);
    setResult(null);
    setNotice(null);
    confirm.reset();
    setStep('search');
  };

  const doConfirm = () => {
    if (confirming.current || !attemptKey) return; // double click: the same key is never sent twice concurrently
    confirming.current = true;
    confirm.mutate(attemptKey);
  };

  if (!can('broker.book')) {
    return <EmptyState icon="lock" title="لا تملك صلاحية الحجز" description="اطلب من مدير المكتب تفعيل صلاحية الحجز لحسابك." />;
  }

  const confirmCode = codeOf(confirm.error);
  const confirmAlert = confirm.isError && !(confirmCode && BACK_TO_SEATS.has(confirmCode)) && (
    <Notice>
      {errorMessage(confirm.error)}
      {confirmCode === 'INSUFFICIENT_BALANCE' && (
        <>
          {' '}
          <Link to="/wallet" className="underline font-semibold">
            اشحن المحفظة
          </Link>{' '}
          ثم أعد المحاولة قبل انتهاء المهلة.
        </>
      )}
      {confirmCode === 'EXPOSURE_CEILING_EXCEEDED' && ' تواصل مع إدارة المنصة لرفع السقف أو حاول غدًا.'}
      {(confirmCode === 'NETWORK_ERROR' || confirmCode === 'HTTP_ERROR' || confirmCode === 'CONFLICT' || (confirm.error instanceof ApiError && confirm.error.status >= 500)) &&
        ' إعادة المحاولة آمنة: لن يُكرَّر الحجز.'}
    </Notice>
  );

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      <PageHeader title="حجز جديد" subtitle={employee?.office.name} className="mb-0" />
      {employee?.office.status === 'SUSPENDED' && <Notice>المكتب موقوف حاليًا: لا يمكن إتمام الحجز.</Notice>}
      <StepIndicator step={step} />

      {trip && step !== 'search' && step !== 'results' && step !== 'success' && <TripSummary trip={trip} passengers={search.passengers} />}
      {hold && (step === 'passengers' || step === 'review') && <HoldTimer seconds={seconds} seatLabels={hold.seats.map((s) => s.label)} />}
      {notice && step !== 'success' && <Notice>{notice}</Notice>}

      {step === 'search' && (
        <SearchStep
          initial={search}
          onSearch={(s) => {
            setSearch(s);
            setNotice(null);
            setStep('results');
          }}
        />
      )}

      {step === 'results' && (
        <ResultsStep
          search={search}
          onEdit={() => setStep('search')}
          onPick={(t) => {
            setTrip(t);
            setSelected([]);
            setNotice(null);
            setStep('seats');
          }}
        />
      )}

      {step === 'seats' && (
        <SeatStep
          trip={tripDetail.data}
          loading={tripDetail.isLoading}
          error={tripDetail.error}
          onRetry={() => tripDetail.refetch()}
          passengers={search.passengers}
          selected={liveSelection}
          onSelect={setSelected}
          onBack={() => {
            setNotice(null);
            setStep('results');
          }}
          onContinue={() => holdSeats.mutate()}
          holding={holdSeats.isPending}
        />
      )}

      {step === 'passengers' && hold && trip && (
        <PassengersStep
          seats={hold.seats}
          carrierName={trip.company.name}
          drafts={drafts}
          onChange={setDrafts}
          onBack={() => backToSeats(null)}
          onContinue={() => {
            setAttemptKey(crypto.randomUUID());
            confirm.reset();
            setStep('review');
          }}
        />
      )}

      {step === 'review' && hold && (
        <ReviewStep
          quote={quote.data}
          quoteLoading={quote.isLoading}
          quoteError={quote.error}
          onRetryQuote={() => quote.refetch()}
          seats={hold.seats}
          passengers={passengerInputs}
          onBack={() => setStep('passengers')}
          onConfirm={doConfirm}
          confirming={confirm.isPending}
          alert={confirmAlert}
        />
      )}

      {step === 'success' && result && <SuccessStep result={result} onNew={reset} />}

      {step !== 'search' && step !== 'success' && (
        <button type="button" onClick={reset} className="self-start text-xs text-on-surface-variant hover:text-error underline">
          إلغاء الحجز والبدء من جديد{hold ? ' (تحرير المقاعد المحجوزة مؤقتًا)' : ''}
        </button>
      )}
    </div>
  );
};
