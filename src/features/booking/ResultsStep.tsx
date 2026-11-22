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
import { formatPercent } from './totals';
import { routeLabel } from '../bookings/labels';
import type { BrokerTrip } from './types';

export const ResultsStep: React.FC<{
  search: TripSearch;
  onEdit: () => void;
  onPick: (trip: BrokerTrip) => void;
}> = ({ search, onEdit, onPick }) => {
  const [page, setPage] = React.useState(1);
  const query = useTripSearch(search, page);
  const trips = query.data?.data ?? [];
  const meta = query.data?.meta;
  const cities = useCities();
  const cityName = (id: string) => cities.data?.find((c) => c.id === id)?.nameAr ?? 'كل المدن';
  const route = routeLabel(search.fromCityId ? cityName(search.fromCityId) : 'كل المدن', search.toCityId ? cityName(search.toCityId) : 'كل المدن');

  return (
    <div className="space-y-space-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-on-surface">{route}</h2>
          <p className="text-xs text-on-surface-variant">
            {search.date || 'كل التواريخ القادمة'} • {search.passengers} مسافر
            {meta ? ` • ${meta.total} رحلة` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" icon="edit" onClick={onEdit}>
          تعديل البحث
        </Button>
      </div>

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
          description="لا توجد رحلات قادمة لشركات النقل المسندة لمكتبك تطابق البحث. جرّب تاريخًا آخر أو اترك المدن فارغة."
          actionText="تعديل البحث"
          onAction={onEdit}
        />
      ) : (
        <ul className={cn('space-y-space-sm', query.isPlaceholderData && 'opacity-60')}>
          {trips.map((t) => {
            const enough = t.seatsFree >= search.passengers;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-md"
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
