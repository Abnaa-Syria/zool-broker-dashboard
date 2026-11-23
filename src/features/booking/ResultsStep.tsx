import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useCities, useTripSearch, type TripSearch } from './api';
import { pointLabel } from './labels';
import { filterReturnTrips, returnNotBefore } from './roundTrip';
import { formatPercent } from './totals';
import { routeLabel } from '../bookings/labels';
import type { BrokerTrip } from './types';

export const ResultsStep: React.FC<{
  search: TripSearch;
  onEdit: () => void;
  onPick: (trip: BrokerTrip) => void;
  /** Round trip, return leg: only trips leaving after this (outbound) trip arrives can be picked. */
  outbound?: BrokerTrip;
  /** Trip picked earlier on this leg (highlighted). */
  pickedId?: string;
}> = ({ search, onEdit, onPick, outbound, pickedId }) => {
  const [page, setPage] = React.useState(1);
  const query = useTripSearch(search, page);
  const loaded = query.data?.data ?? [];
  const { trips, hidden } = outbound ? filterReturnTrips(outbound, loaded) : { trips: loaded, hidden: 0 };
  const meta = query.data?.meta;
  const cities = useCities();
  const cityName = (id: string) => cities.data?.find((c) => c.id === id)?.nameAr ?? 'كل المدن';
  const route = routeLabel(search.fromCityId ? cityName(search.fromCityId) : 'كل المدن', search.toCityId ? cityName(search.toCityId) : 'كل المدن');

  return (
    <div className="space-y-space-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-on-surface">
            {outbound ? 'رحلة العودة: ' : ''}
            {route}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {search.date || 'كل التواريخ القادمة'} • {search.passengers} مسافر
            {meta ? ` • ${meta.total} رحلة` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" icon={outbound ? 'arrow_forward' : 'edit'} onClick={onEdit}>
          {outbound ? 'تغيير مقاعد الذهاب' : 'تعديل البحث'}
        </Button>
      </div>
      {outbound && (
        <p className="text-xs text-on-surface-variant">
          تُعرض فقط الرحلات التي تغادر بعد وصول رحلة الذهاب ({formatDateTime(returnNotBefore(outbound))})
          {hidden > 0 ? ` — أُخفيت ${hidden} رحلة تغادر قبل ذلك.` : '.'}
        </p>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState title="تعذّر البحث عن الرحلات" message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="directions_bus"
          title="لا توجد رحلات"
          description={
            outbound
              ? 'لا توجد رحلات عودة في هذا التاريخ تغادر بعد وصول رحلة الذهاب. ارجع وغيّر تاريخ العودة.'
              : 'لا توجد رحلات قادمة لشركات النقل المسندة لمكتبك تطابق البحث. جرّب تاريخًا آخر أو اترك المدن فارغة.'
          }
          actionText={outbound ? 'رجوع' : 'تعديل البحث'}
          onAction={onEdit}
        />
      ) : (
        <ul className={cn('space-y-space-sm', query.isPlaceholderData && 'opacity-60')}>
          {trips.map((t) => {
            const enough = t.seatsFree >= search.passengers;
            return (
              <li
                key={t.id}
                className={cn(
                  'rounded-xl border bg-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-md',
                  t.id === pickedId ? 'border-secondary ring-2 ring-secondary/20' : 'border-outline-variant/40',
                )}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{t.carrier.name}</span>
                    {t.serviceClass === 'VIP' && <Badge size="sm" variant="warning">VIP</Badge>}
                    <Badge size="sm" variant="info">
                      عمولة {formatPercent(t.commissionPercent)}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {routeLabel(pointLabel(t.origin), pointLabel(t.destination))}
                    <span className="text-xs text-on-surface-variant"> • {t.isDirect ? 'مباشرة' : `${t.stops.length - 2} توقف`}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    المغادرة {formatDateTime(t.departureAt)}
                    {t.arrivalAt ? ` • الوصول ${formatDateTime(t.arrivalAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-space-md">
                  <div className="text-left">
                    <div className="font-bold tabular-nums">{formatSdg(t.basePrice)}</div>
                    <div className="text-[11px] text-on-surface-variant">للمسافر • عمولتك {formatSdg(t.expectedCommissionPerSeat)}</div>
                    <div className={cn('text-xs font-semibold', enough ? 'text-[#15803D]' : 'text-error')}>
                      {t.seatsFree > 0 ? `${t.seatsFree} مقعد متاح` : 'مكتملة'}
                    </div>
                  </div>
                  <a
                    href={`/trips/${t.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-secondary hover:underline inline-flex items-center gap-0.5"
                    title="يفتح صفحة الرحلة في تبويب جديد دون فقدان البحث"
                  >
                    التفاصيل
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                  <Button onClick={() => onPick(t)} disabled={!enough} title={enough ? undefined : 'المقاعد المتاحة أقل من عدد المسافرين'}>
                    اختيار المقاعد
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              السابق
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
