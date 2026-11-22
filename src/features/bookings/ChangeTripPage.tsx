import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime, sudanDate } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { bookingApi, releaseHolds, useTripDetail } from '../booking/api';
import { earliestDeadline, holdDeadline, useCountdown } from '../booking/countdown';
import { pointLabel } from '../booking/labels';
import { HoldTimer, Notice } from '../booking/parts';
import { SeatMap } from '../booking/SeatMap';
import { orderedSelection, planHolds, pruneSelection, toggleSeat } from '../booking/seats';
import { formatPercent } from '../booking/totals';
import type { TripSeat } from '../booking/types';
import { changeApi, useBooking, useChangeOptions } from './api';
import { activeTickets, canChangeBooking, defaultChangeDate, pairNewSeats, walletEffect } from './change';
import { bookingReference, routeLabel } from './labels';
import type { Booking, ChangeOption } from './types';

type Step = 'options' | 'seats' | 'review';
type HoldState = { holdIds: string[]; seats: TripSeat[]; deadline: number };

/** The new seats are gone or no longer held: pick seats again. */
const BACK_TO_SEATS = new Set(['HOLD_REQUIRED', 'HOLD_EXPIRED', 'SEAT_UNAVAILABLE', 'WOMEN_ONLY_SEAT']);

function codeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

/** /bookings/:id/change — D-CHG-01 move a confirmed booking to another trip (same carrier and cities). */
export const ChangeTripPage: React.FC = () => {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const { can } = useAuth();

  if (booking.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (booking.isError || !booking.data) {
    return <ErrorState title="تعذّر تحميل الحجز" message={errorMessage(booking.error)} onRetry={() => booking.refetch()} />;
  }
  if (!canChangeBooking(booking.data, can('broker.book'))) {
    return (
      <div className="space-y-space-md">
        <BackLink id={id} />
        <EmptyState icon="block" title="لا يمكن تعديل هذا الحجز" description="التعديل متاح للحجوزات المؤكدة قبل موعد المغادرة ولمن يملك صلاحية الحجز." />
      </div>
    );
  }
  return <ChangeTripFlow booking={booking.data} />;
};

const BackLink: React.FC<{ id: string }> = ({ id }) => (
  <Link to={`/bookings/${id}`} className="inline-flex items-center gap-1 text-sm text-secondary hover:underline self-start">
    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    تفاصيل الحجز
  </Link>
);

const ChangeTripFlow: React.FC<{ booking: Booking }> = ({ booking }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const count = activeTickets(booking).length;

  const [step, setStep] = React.useState<Step>('options');
  const [date, setDate] = React.useState(() => defaultChangeDate(booking.trip.departureAt));
  const [option, setOption] = React.useState<ChangeOption | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [hold, setHold] = React.useState<HoldState | null>(null);
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Release a hold still owned when leaving the page (best effort; holds also expire server-side).
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

  const options = useChangeOptions(booking.id, date);
  const tripDetail = useTripDetail(step === 'seats' && option ? option.id : null);
  const liveSelection = React.useMemo(
    () => (tripDetail.data ? pruneSelection(selected, tripDetail.data.seats) : selected),
    [selected, tripDetail.data],
  );
  const seconds = useCountdown(hold?.deadline ?? null);
  const seatIds = React.useMemo(() => hold?.seats.map((s) => s.id) ?? [], [hold]);

  const quote = useQuery({
    queryKey: ['broker-change-quote', booking.id, option?.id, seatIds],
    enabled: step === 'review' && option !== null && seatIds.length > 0,
    retry: false,
    gcTime: 0,
    queryFn: () => changeApi.quote(booking.id, { tripId: option!.id, seatIds }),
  });

  function backToSeats(message: string | null) {
    const ids = hold?.holdIds ?? [];
    setHold(null);
    setAttemptKey(null);
    setNotice(message);
    setStep('seats');
    void releaseHolds(ids).then(() => qc.invalidateQueries({ queryKey: ['broker-trip', option?.id] }));
  }

  const holdSeats = useMutation({
    mutationFn: async () => {
      const seats = tripDetail.data?.seats ?? [];
      const plan = planHolds(liveSelection, seats);
      if (plan.release.length) await releaseHolds(plan.release);
      const created = plan.toHold.length ? await bookingApi.hold(option!.id, plan.toHold) : null;
      const receivedAt = Date.now();
      const reused = plan.reuse.map((r) => holdDeadline(r.remainingSeconds ?? 0, tripDetail.dataUpdatedAt || receivedAt));
      const deadline = earliestDeadline([...(created ? [holdDeadline(created.remainingSeconds, receivedAt)] : []), ...reused]);
      return {
        holdIds: [...plan.reuse.map((r) => r.holdId), ...(created?.holds.map((h) => h.id) ?? [])],
        seats: orderedSelection(liveSelection, seats),
        deadline: deadline ?? receivedAt,
      } satisfies HoldState;
    },
    onSuccess: (h) => {
      setHold(h);
      setNotice(null);
      setAttemptKey(crypto.randomUUID());
      setStep('review');
    },
    onError: (error) => {
      setNotice(errorMessage(error));
      void tripDetail.refetch();
    },
  });

  const confirming = React.useRef(false);
  const change = useMutation({
    mutationFn: (key: string) => changeApi.change(booking.id, { tripId: option!.id, seatIds, idempotencyKey: key }),
    onSuccess: (res) => {
      // consumed by the new booking: nothing to release when the page unmounts
      holdRef.current = null;
      setHold(null);
      qc.setQueryData(['broker-booking', res.booking.id], res.booking);
      void qc.invalidateQueries({ queryKey: ['broker-booking', booking.id] });
      void qc.invalidateQueries({ queryKey: ['broker-bookings'] });
      void qc.invalidateQueries({ queryKey: ['broker-wallet'] });
      void qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
      navigate(`/bookings/${res.booking.id}`, { replace: true, state: { changedFrom: bookingReference(booking) } });
    },
    onError: (error) => {
      const code = codeOf(error);
      if (code && BACK_TO_SEATS.has(code)) backToSeats(errorMessage(error));
    },
    onSettled: () => {
      confirming.current = false;
    },
  });

  // Hold ran out on the review: back to seats (the server already freed them).
  if (seconds === 0 && hold && step === 'review' && !change.isPending) {
    setHold(null);
    setAttemptKey(null);
    setNotice(errorMessage(new ApiError({ status: 409, code: 'HOLD_EXPIRED', message: 'Hold expired' })));
    setStep('seats');
  }

  const doConfirm = () => {
    if (confirming.current || !attemptKey) return;
    confirming.current = true;
    change.mutate(attemptKey);
  };

  const changeCode = codeOf(change.error);
  const q = quote.data;
  const effect = q ? walletEffect(q) : null;

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      <BackLink id={booking.id} />
      <PageHeader
        title={`تعديل رحلة الحجز ${bookingReference(booking)}`}
        subtitle={`${booking.trip.company.name} • ${routeLabel(booking.trip.origin, booking.trip.destination)} • ${formatDateTime(booking.trip.departureAt)}`}
        className="mb-0"
      />
      <p className="text-sm text-on-surface-variant">
        نقل {count} {count === 1 ? 'مسافر' : 'مسافرين'} إلى رحلة أخرى لنفس الشركة وبين نفس المدينتين. يُلغى الحجز الحالي (حالة «مُعدّل») ويصدر حجز جديد بتذاكر جديدة؛
        يُخصم الفرق والرسوم من المحفظة أو يُعاد إليها.
      </p>

      {hold && step === 'review' && <HoldTimer seconds={seconds} seatLabels={hold.seats.map((s) => s.label)} />}
      {notice && <Notice>{notice}</Notice>}

      {step === 'options' && (
        <div className="space-y-space-md">
          <div className="max-w-xs">
            <Input type="date" label="تاريخ الرحلة الجديدة (توقيت السودان)" min={sudanDate()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {options.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : options.isError ? (
            <ErrorState
              title="لا يمكن عرض رحلات بديلة"
              message={errorMessage(options.error)}
              onRetry={codeOf(options.error) === 'CHANGE_NOT_ALLOWED' ? undefined : () => options.refetch()}
            />
          ) : (options.data ?? []).length === 0 ? (
            <EmptyState icon="directions_bus" title="لا توجد رحلات بديلة" description={`لا توجد رحلات أخرى لنفس الشركة بها ${count} مقعد متاح في هذا التاريخ. جرّب تاريخًا آخر.`} />
          ) : (
            <ul className="space-y-space-sm">
              {options.data!.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    'rounded-xl border bg-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-md',
                    t.id === option?.id ? 'border-secondary ring-2 ring-secondary/20' : 'border-outline-variant/40',
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{t.carrier.name}</span>
                      {t.tripNumber && <span className="text-xs text-on-surface-variant">{t.tripNumber}</span>}
                      {t.serviceClass === 'VIP' && <Badge size="sm" variant="warning">VIP</Badge>}
                    </div>
                    <div className="text-sm">
                      {routeLabel(pointLabel(t.origin), pointLabel(t.destination))}
                      <span className="text-xs text-on-surface-variant"> • {t.isDirect ? 'مباشرة' : `${t.stopsCount} توقف`}</span>
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      المغادرة {formatDateTime(t.departureAt)}
                      {t.arrivalAt ? ` • الوصول ${formatDateTime(t.arrivalAt)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-space-md">
                    <div className="text-left">
                      <div className="font-bold tabular-nums">{formatSdg(t.priceMinor)} <span className="text-[11px] font-normal text-on-surface-variant">للمسافر</span></div>
                      <div className={cn('text-xs font-semibold tabular-nums', t.priceDifferenceMinor > 0 ? 'text-error' : 'text-[#15803D]')}>
                        {t.priceDifferenceMinor === 0
                          ? 'بدون فرق سعر'
                          : t.priceDifferenceMinor > 0
                            ? `فرق +${formatSdg(t.priceDifferenceMinor)}`
                            : `فرق −${formatSdg(-t.priceDifferenceMinor)}`}
                      </div>
                      <div className="text-[11px] text-on-surface-variant">{t.seatsAvailable} مقعد متاح • قبل رسوم التعديل</div>
                    </div>
                    <Button
                      onClick={() => {
                        if (t.id !== option?.id) setSelected([]);
                        setOption(t);
                        setNotice(null);
                        setStep('seats');
                      }}
                    >
                      اختيار المقاعد
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 'seats' && option && (
        <div className="space-y-space-md">
          <h2 className="font-bold">
            مقاعد الرحلة الجديدة — {formatDateTime(option.departureAt)}
          </h2>
          {tripDetail.isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : tripDetail.isError || !tripDetail.data ? (
            <ErrorState title="تعذّر تحميل المقاعد" message={errorMessage(tripDetail.error)} onRetry={() => tripDetail.refetch()} />
          ) : (
            <SeatMap
              seats={tripDetail.data.seats}
              layout={tripDetail.data.layout}
              selected={liveSelection}
              onToggle={(seat) => setSelected(toggleSeat(liveSelection, seat, count))}
            />
          )}
          <p className="text-xs text-on-surface-variant">
            يُربط المسافرون بالمقاعد الجديدة بترتيب أرقام المقاعد. المقاعد المخصصة للسيدات تُقبل فقط لمسافرات مسجّل جنسهن «أنثى».
          </p>
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <span className="text-sm">
              اختر {count} {count === 1 ? 'مقعدًا' : 'مقاعد'} ({liveSelection.length}/{count})
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('options')} disabled={holdSeats.isPending}>
                رجوع
              </Button>
              <Button icon="lock_clock" onClick={() => holdSeats.mutate()} disabled={liveSelection.length !== count} isLoading={holdSeats.isPending}>
                حجز المقاعد مؤقتًا ومراجعة التكلفة
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && option && hold && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-md items-start">
          <Card className="lg:col-span-3 space-y-space-sm">
            <h3 className="font-bold">المسافرون والمقاعد الجديدة</h3>
            <p className="text-xs text-on-surface-variant">
              الرحلة الجديدة: {routeLabel(pointLabel(option.origin), pointLabel(option.destination))} • {formatDateTime(option.departureAt)}
            </p>
            <ul className="divide-y divide-outline-variant/30">
              {pairNewSeats(booking, q?.seats ?? hold.seats.map((s) => s.label)).map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-semibold truncate">{p.passengerName}</span>
                  <span className="text-sm whitespace-nowrap">
                    <span className="font-mono text-on-surface-variant line-through">{p.oldSeat ?? '—'}</span> ←{' '}
                    <Badge variant="info">مقعد {p.newSeat ?? '—'}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-2 space-y-space-sm">
            <h3 className="font-bold">التكلفة والمحفظة</h3>
            {quote.isLoading ? (
              <Skeleton className="h-40" />
            ) : quote.isError ? (
              <ErrorState title="تعذّر حساب التكلفة" message={errorMessage(quote.error)} onRetry={() => quote.refetch()} className="my-0" />
            ) : q && effect ? (
              <dl className="space-y-2 text-sm">
                <Line label="إجمالي الحجز الحالي" value={formatSdg(q.oldTotalMinor)} />
                <Line label="إجمالي الرحلة الجديدة" value={formatSdg(q.newTotalMinor)} />
                <Line label="فرق السعر" value={formatSdg(q.priceDifferenceMinor)} />
                <Line label="رسوم التعديل" value={formatSdg(q.changeFeeMinor)} />
                <div className="border-t border-outline-variant/40 pt-2">
                  {effect.kind === 'pay' && <Line label="يُخصم من المحفظة الآن" value={formatSdg(effect.amountMinor)} strong danger />}
                  {effect.kind === 'refund' && <Line label="يُعاد إلى المحفظة الآن" value={formatSdg(effect.amountMinor)} strong />}
                  {effect.kind === 'none' && <Line label="حركة المحفظة" value="لا شيء" strong />}
                </div>
                {q.commission && (
                  <Line
                    label={`عمولتك على الحجز الجديد (${formatPercent(q.commission.percent)})`}
                    value={formatSdg(q.commission.newCommissionMinor)}
                    hint="تُسترد عمولة الحجز الحالي وتُستحق عمولة الحجز الجديد بدلًا منها."
                  />
                )}
              </dl>
            ) : null}

            {change.isError && !(changeCode && BACK_TO_SEATS.has(changeCode)) && (
              <Notice>
                {errorMessage(change.error)}
                {changeCode === 'INSUFFICIENT_BALANCE' && (
                  <>
                    {' '}
                    <Link to="/wallet" target="_blank" className="underline font-semibold">
                      اشحن المحفظة
                    </Link>{' '}
                    ثم أعد المحاولة قبل انتهاء المهلة.
                  </>
                )}
                {(changeCode === 'NETWORK_ERROR' || changeCode === 'HTTP_ERROR' || (change.error instanceof ApiError && change.error.status >= 500)) &&
                  ' إعادة المحاولة آمنة: لن يُكرَّر التعديل.'}
              </Notice>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button size="lg" icon="published_with_changes" onClick={doConfirm} isLoading={change.isPending} disabled={!q || quote.isLoading}>
                تأكيد تعديل الرحلة
              </Button>
              <Button variant="outline" onClick={() => backToSeats(null)} disabled={change.isPending}>
                تغيير المقاعد
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

function Line({ label, value, strong, danger, hint }: { label: string; value: string; strong?: boolean; danger?: boolean; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-on-surface-variant">{label}</dt>
        <dd className={cn('tabular-nums whitespace-nowrap', strong && 'font-bold', danger && 'text-error')}>{value}</dd>
      </div>
      {hint && <p className="text-[11px] text-outline mt-0.5">{hint}</p>}
    </div>
  );
}
