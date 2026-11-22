import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { useAuth } from '../auth/auth-context';
import type { ConfirmResult } from '../bookings/types';
import { bookingApi, releaseHolds, useTripDetail } from './api';
import { earliestDeadline, holdDeadline, useCountdown } from './countdown';
import { HoldTimer, Notice, StepIndicator, TripSummary, type FlowStep } from './parts';
import { emptyPassenger, resizeDrafts, toPassengerInput, type PassengerDraft } from './passengers';
import { PassengersStep } from './PassengersStep';
import { ResultsStep } from './ResultsStep';
import { ReviewStep } from './ReviewStep';
import { failedLeg, INITIAL_SEARCH, outboundSearch, returnSearch, type BookingSearch } from './roundTrip';
import { SearchStep } from './SearchStep';
import { SeatStep } from './SeatStep';
import { orderedSelection, planHolds, pruneSelection } from './seats';
import { SuccessStep } from './SuccessStep';
import type { BrokerTrip, TripSeat } from './types';

type HoldState = { holdIds: string[]; seats: TripSeat[]; deadline: number };
type Leg = 'outbound' | 'return';

/** Codes that mean the seats are gone or no longer held: the user must pick seats again. */
const BACK_TO_SEATS = new Set(['HOLD_REQUIRED', 'HOLD_EXPIRED', 'SEAT_UNAVAILABLE', 'NOT_FOUND']);
/** Steps during which the outbound hold must still be alive. */
const OUTBOUND_HELD_STEPS: readonly FlowStep[] = ['returnResults', 'returnSeats', 'passengers', 'review'];

function codeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

const HOLD_EXPIRED_MESSAGE = errorMessage(new ApiError({ status: 409, code: 'HOLD_EXPIRED', message: 'Hold expired' }));

/**
 * /booking/new — search → trip → seats (hold) → passengers → review (quote) → confirm → tickets.
 * Round trip (D-RT-01): search → outbound trip → seats (hold) → return trip → return seats (hold) →
 * passengers (one list for both legs) → review → confirm (one call, two bookings).
 * Holds are released on back / cancel / leaving the page; confirm uses one idempotency key per attempt.
 */
export const BookingFlowPage: React.FC = () => {
  const { can, employee } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = React.useState<FlowStep>('search');
  const [search, setSearch] = React.useState<BookingSearch>(INITIAL_SEARCH);
  const [trip, setTrip] = React.useState<BrokerTrip | null>(null);
  const [returnTrip, setReturnTrip] = React.useState<BrokerTrip | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [returnSelected, setReturnSelected] = React.useState<string[]>([]);
  const [hold, setHold] = React.useState<HoldState | null>(null);
  const [returnHold, setReturnHold] = React.useState<HoldState | null>(null);
  const [drafts, setDrafts] = React.useState<PassengerDraft[]>([emptyPassenger()]);
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ConfirmResult | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const roundTrip = search.tripType === 'ROUND_TRIP';

  // Holds still owned when the page unmounts are released (best effort; they also expire server-side).
  const holdRef = React.useRef<HoldState[]>([]);
  React.useEffect(() => {
    holdRef.current = [hold, returnHold].filter((h): h is HoldState => h !== null);
  }, [hold, returnHold]);
  React.useEffect(
    () => () => {
      const ids = holdRef.current.flatMap((h) => h.holdIds);
      if (ids.length) void releaseHolds(ids);
    },
    [],
  );

  const seatLeg: Leg | null = step === 'seats' ? 'outbound' : step === 'returnSeats' ? 'return' : null;
  const seatTrip = seatLeg === 'return' ? returnTrip : seatLeg === 'outbound' ? trip : null;
  const tripDetail = useTripDetail(seatTrip?.id ?? null);
  const legSelected = seatLeg === 'return' ? returnSelected : selected;
  const setLegSelected = seatLeg === 'return' ? setReturnSelected : setSelected;
  // Seats taken by someone else since they were clicked drop out of the selection.
  const liveSelection = React.useMemo(
    () => (tripDetail.data ? pruneSelection(legSelected, tripDetail.data.seats) : legSelected),
    [legSelected, tripDetail.data],
  );

  const outSeconds = useCountdown(hold?.deadline ?? null);
  const retSeconds = useCountdown(returnHold?.deadline ?? null);
  const timerSeconds = outSeconds === null ? retSeconds : retSeconds === null ? outSeconds : Math.min(outSeconds, retSeconds);

  const passengerInputs = React.useMemo(() => drafts.map(toPassengerInput), [drafts]);
  const seatIds = React.useMemo(() => hold?.seats.map((s) => s.id) ?? [], [hold]);
  const returnSeatIds = React.useMemo(() => returnHold?.seats.map((s) => s.id) ?? [], [returnHold]);
  const returnInput = roundTrip && returnTrip && returnSeatIds.length > 0 ? { tripId: returnTrip.id, seatIds: returnSeatIds } : undefined;

  const quote = useQuery({
    queryKey: ['broker-quote', trip?.id, seatIds, returnInput, passengerInputs],
    enabled: step === 'review' && trip !== null && seatIds.length > 0 && (!roundTrip || returnInput !== undefined),
    retry: false,
    gcTime: 0,
    queryFn: () => bookingApi.quote({ tripId: trip!.id, seatIds, passengers: passengerInputs, ...(returnInput ? { returnTrip: returnInput } : {}) }),
  });

  /** Release this leg's hold (and the return leg's when going back to the outbound seats). */
  function dropHolds(leg: Leg) {
    const ids = [...(leg === 'outbound' ? (hold?.holdIds ?? []) : []), ...(returnHold?.holdIds ?? [])];
    if (leg === 'outbound') setHold(null);
    setReturnHold(null);
    setAttemptKey(null);
    const trips = [leg === 'outbound' ? trip?.id : undefined, returnTrip?.id].filter(Boolean);
    void releaseHolds(ids).then(() => Promise.all(trips.map((id) => qc.invalidateQueries({ queryKey: ['broker-trip', id] }))));
  }

  /**
   * Back to seat selection of a leg: release the hold(s) (a no-op when already expired), then reload
   * the seat map so freed seats show as available again. The selection is kept and pruned.
   */
  function backToSeats(message: string | null, leg: Leg = 'outbound') {
    dropHolds(leg);
    setNotice(message);
    setStep(leg === 'outbound' ? 'seats' : 'returnSeats');
  }

  const confirming = React.useRef(false);
  const confirm = useMutation({
    mutationFn: (key: string) =>
      bookingApi.confirm({ tripId: trip!.id, seatIds, passengers: passengerInputs, ...(returnInput ? { returnTrip: returnInput } : {}), idempotencyKey: key }),
    onSuccess: (res) => {
      // consumed by the booking(s)
      setHold(null);
      setReturnHold(null);
      setResult(res);
      setStep('success');
      void qc.invalidateQueries({ queryKey: ['broker-wallet'] });
      void qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['broker-bookings'] });
    },
    onError: (error) => {
      const code = codeOf(error);
      if (code && BACK_TO_SEATS.has(code)) {
        const leg = roundTrip && error instanceof ApiError ? failedLeg(error.details, seatIds, returnSeatIds) : 'outbound';
        backToSeats(errorMessage(error), leg);
      } else if (code === 'ROUND_TRIP_INVALID') {
        dropHolds('return');
        setNotice(errorMessage(error));
        setStep('returnResults');
      }
    },
    onSettled: () => {
      confirming.current = false;
    },
  });

  const holdSeats = useMutation({
    mutationFn: async (leg: Leg) => {
      const legTrip = leg === 'return' ? returnTrip : trip;
      const seats = tripDetail.data?.seats ?? [];
      const plan = planHolds(liveSelection, seats);
      if (plan.release.length) await releaseHolds(plan.release);
      const created = plan.toHold.length ? await bookingApi.hold(legTrip!.id, plan.toHold) : null;
      const receivedAt = Date.now();
      const reusedDeadlines = plan.reuse.map((r) => holdDeadline(r.remainingSeconds ?? 0, tripDetail.dataUpdatedAt || receivedAt));
      const deadline = earliestDeadline([...(created ? [holdDeadline(created.remainingSeconds, receivedAt)] : []), ...reusedDeadlines]);
      return {
        holdIds: [...plan.reuse.map((r) => r.holdId), ...(created?.holds.map((h) => h.id) ?? [])],
        seats: orderedSelection(liveSelection, seats),
        deadline: deadline ?? receivedAt,
      } satisfies HoldState;
    },
    onSuccess: (h, leg) => {
      setNotice(null);
      if (leg === 'outbound') {
        setHold(h);
        if (roundTrip) {
          setStep('returnResults');
          return;
        }
      } else {
        setReturnHold(h);
      }
      setDrafts((d) => resizeDrafts(d, h.seats.length));
      setStep('passengers');
    },
    onError: (error) => {
      setNotice(errorMessage(error));
      void tripDetail.refetch();
    },
  });

  // A hold ran out: back to that leg's seats (the server already freed them).
  if (!confirm.isPending) {
    if (outSeconds === 0 && hold && OUTBOUND_HELD_STEPS.includes(step)) {
      if (returnHold) void releaseHolds(returnHold.holdIds);
      setHold(null);
      setReturnHold(null);
      setAttemptKey(null);
      setNotice(HOLD_EXPIRED_MESSAGE);
      setStep('seats');
    } else if (retSeconds === 0 && returnHold && (step === 'passengers' || step === 'review')) {
      setReturnHold(null);
      setAttemptKey(null);
      setNotice(HOLD_EXPIRED_MESSAGE);
      setStep('returnSeats');
    }
  }

  const reset = () => {
    const ids = [...(hold?.holdIds ?? []), ...(returnHold?.holdIds ?? [])];
    if (ids.length) void releaseHolds(ids);
    setHold(null);
    setReturnHold(null);
    setTrip(null);
    setReturnTrip(null);
    setSelected([]);
    setReturnSelected([]);
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
  const confirmAlert = confirm.isError && !(confirmCode && (BACK_TO_SEATS.has(confirmCode) || confirmCode === 'ROUND_TRIP_INVALID')) && (
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
      {confirmCode === 'WOMEN_ONLY_SEAT' && (
        <>
          {' '}
          <button type="button" className="underline font-semibold" onClick={() => setStep('passengers')}>
            تعديل بيانات المسافرين
          </button>
        </>
      )}
      {(confirmCode === 'NETWORK_ERROR' || confirmCode === 'HTTP_ERROR' || confirmCode === 'CONFLICT' || (confirm.error instanceof ApiError && confirm.error.status >= 500)) &&
        ' إعادة المحاولة آمنة: لن يُكرَّر الحجز.'}
    </Notice>
  );

  const showTrips = step !== 'search' && step !== 'results' && step !== 'success';
  const heldSeats = [...(hold?.seats ?? []), ...(returnHold?.seats ?? [])].map((s) => s.label);
  const label = (leg: Leg) => (roundTrip ? (leg === 'outbound' ? 'الذهاب' : 'العودة') : undefined);

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      <PageHeader title={roundTrip ? 'حجز جديد — ذهاب وعودة' : 'حجز جديد'} subtitle={employee?.office.name} className="mb-0" />
      {employee?.office.status === 'SUSPENDED' && <Notice>المكتب موقوف حاليًا: لا يمكن إتمام الحجز.</Notice>}
      <StepIndicator step={step} roundTrip={roundTrip} />

      {trip && showTrips && <TripSummary trip={trip} passengers={search.passengers} label={label('outbound')} />}
      {roundTrip && returnTrip && showTrips && step !== 'returnResults' && (
        <TripSummary trip={returnTrip} passengers={search.passengers} label={label('return')} />
      )}
      {(hold || returnHold) && OUTBOUND_HELD_STEPS.includes(step) && <HoldTimer seconds={timerSeconds} seatLabels={heldSeats} />}
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
          search={outboundSearch(search)}
          pickedId={trip?.id}
          onEdit={() => setStep('search')}
          onPick={(t) => {
            if (t.id !== trip?.id) setSelected([]);
            setTrip(t);
            setNotice(null);
            setStep('seats');
          }}
        />
      )}

      {step === 'returnResults' && trip && (
        <ResultsStep
          search={returnSearch(search)}
          outbound={trip}
          pickedId={returnTrip?.id}
          onEdit={() => backToSeats(null, 'outbound')}
          onPick={(t) => {
            if (t.id !== returnTrip?.id) setReturnSelected([]);
            setReturnTrip(t);
            setNotice(null);
            setStep('returnSeats');
          }}
        />
      )}

      {seatLeg && (
        <SeatStep
          heading={roundTrip ? (seatLeg === 'outbound' ? 'مقاعد رحلة الذهاب' : 'مقاعد رحلة العودة') : undefined}
          trip={tripDetail.data}
          loading={tripDetail.isLoading}
          error={tripDetail.error}
          onRetry={() => tripDetail.refetch()}
          passengers={search.passengers}
          selected={liveSelection}
          onSelect={setLegSelected}
          onBack={() => {
            setNotice(null);
            setStep(seatLeg === 'outbound' ? 'results' : 'returnResults');
          }}
          onContinue={() => holdSeats.mutate(seatLeg)}
          holding={holdSeats.isPending}
        />
      )}

      {step === 'passengers' && hold && trip && (
        <PassengersStep
          seats={hold.seats}
          returnSeats={roundTrip ? returnHold?.seats : undefined}
          carrierName={roundTrip && returnTrip && returnTrip.company.id !== trip.company.id ? `${trip.company.name} و${returnTrip.company.name}` : trip.company.name}
          drafts={drafts}
          onChange={setDrafts}
          onBack={() => backToSeats(null, roundTrip ? 'return' : 'outbound')}
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
          returnSeats={roundTrip ? returnHold?.seats : undefined}
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
          إلغاء الحجز والبدء من جديد{hold || returnHold ? ' (تحرير المقاعد المحجوزة مؤقتًا)' : ''}
        </button>
      )}
    </div>
  );
};
