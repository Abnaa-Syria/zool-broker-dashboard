import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { formatPercent } from './totals';
import type { BookingQuote, PassengerInput, TripSeat } from './types';

/**
 * Review = POST /broker/bookings/quote. The wallet is debited the FULL ticket total;
 * the commission is earned now and settled later — never shown as a "net debit".
 */
export const ReviewStep: React.FC<{
  quote: BookingQuote | undefined;
  quoteLoading: boolean;
  quoteError: unknown;
  onRetryQuote: () => void;
  seats: TripSeat[];
  passengers: PassengerInput[];
  onBack: () => void;
  onConfirm: () => void;
  confirming: boolean;
  alert: React.ReactNode;
}> = ({ quote, quoteLoading, quoteError, onRetryQuote, seats, passengers, onBack, onConfirm, confirming, alert }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-md items-start">
      <Card className="lg:col-span-3 space-y-space-sm">
        <h3 className="font-bold">المسافرون والمقاعد</h3>
        <ul className="divide-y divide-outline-variant/30">
          {seats.map((seat, i) => (
            <li key={seat.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{passengers[i]?.fullName}</div>
                <div className="text-xs text-on-surface-variant" dir="ltr">
                  {passengers[i]?.phone}
                  {passengers[i]?.idNumber ? ` • ${passengers[i]?.idNumber}` : ''}
                </div>
              </div>
              <Badge variant="info">مقعد {seat.label}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-2 space-y-space-sm">
        <h3 className="font-bold">ملخص الدفع والمحفظة</h3>
        {quoteLoading ? (
          <Skeleton className="h-40" />
        ) : quoteError ? (
          <ErrorState title="تعذّر حساب السعر" message={errorMessage(quoteError)} onRetry={onRetryQuote} className="my-0" />
        ) : quote ? (
          <>
            <dl className="space-y-2 text-sm">
              <Line label={`سعر التذكرة × ${quote.seatCount}`} value={`${formatSdg(quote.unitPriceMinor)} × ${quote.seatCount}`} />
              <Line label="قيمة التذاكر الإجمالية (تُخصم من المحفظة)" value={formatSdg(quote.totalAmountMinor)} strong />
              <Line
                label={`عمولتك المكتسبة (${formatPercent(quote.commissionPercent)})`}
                value={formatSdg(quote.expectedCommissionMinor)}
                hint="تُضاف لمستحقاتك وتُسوّى لاحقًا من الإدارة؛ لا تُخصم من المبلغ."
              />
              <div className="border-t border-outline-variant/40 pt-2 space-y-2">
                <Line label="رصيد المحفظة قبل الحجز" value={formatSdg(quote.walletBalanceMinor)} />
                <Line
                  label="الرصيد المتوقع بعد الخصم"
                  value={formatSdg(quote.balanceAfterMinor)}
                  strong
                  danger={!quote.sufficientBalance}
                />
              </div>
            </dl>
            {!quote.sufficientBalance && (
              <p className="text-xs text-error">
                رصيد المحفظة لا يكفي لهذا الحجز.{' '}
                <Link to="/wallet" target="_blank" className="underline font-semibold">
                  اشحن المحفظة
                </Link>{' '}
                ثم عد إلى هذه الصفحة قبل انتهاء المهلة (يُحدَّث الملخص تلقائيًا).
              </p>
            )}
            {!quote.exposure.withinCeiling && (
              <p className="text-xs text-error">
                سقف تذاكر المكتب اليومي: {quote.exposure.ceiling} — المستخدم اليوم {quote.exposure.usedToday}. لا يمكن إصدار {quote.seatCount} تذكرة إضافية اليوم.
              </p>
            )}
          </>
        ) : null}

        {alert}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            size="lg"
            icon="verified"
            onClick={onConfirm}
            isLoading={confirming}
            disabled={!quote || quoteLoading || !quote.sufficientBalance || !quote.exposure.withinCeiling}
          >
            تأكيد الحجز والدفع من المحفظة
          </Button>
          <Button variant="outline" onClick={onBack} disabled={confirming}>
            تعديل بيانات المسافرين
          </Button>
        </div>
      </Card>
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
