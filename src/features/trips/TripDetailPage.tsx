import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailSkeleton, Field, Row } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { useAuth } from '../auth/auth-context';
import { useTripDetail } from '../booking/api';
import { pointLabel } from '../booking/labels';
import { SeatMap } from '../booking/SeatMap';
import { formatPercent } from '../booking/totals';
import { routeLabel } from '../bookings/labels';
import { formatDuration, intermediateStops, occupancyPercent, searchForTrip, serviceClassLabel, stopKindLabel } from './logic';

const NOOP = () => undefined;

/**
 * /trips/:tripId — GET /broker/trips/:id: carrier, route with stops, amenities, seat map, price and the
 * office commission. Only bookable trips of carriers assigned to the office are returned by the API.
 */
export const TripDetailPage: React.FC = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { can, employee } = useAuth();
  const query = useTripDetail(tripId ?? null);
  const [passengers, setPassengers] = React.useState(1);
  const crumbs = [{ label: 'حجز جديد', path: '/booking/new' }, { label: 'تفاصيل الرحلة' }];

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.code.endsWith('NOT_FOUND'));
    return (
      <DetailError
        crumbs={crumbs}
        notFound={notFound}
        notFoundTitle="الرحلة غير متاحة"
        notFoundMessage="الرحلة غير موجودة أو لم تعد متاحة للحجز (انطلقت أو أُلغيت أو شركتها غير مسندة لمكتبك). تفاصيل الحجوزات السابقة تبقى في صفحة الحجز."
        title="تعذّر تحميل الرحلة"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const t = query.data;
  const stops = intermediateStops(t.stops);
  const canBook = can('broker.book') && employee?.office.status !== 'SUSPENDED' && t.seatsFree > 0;
  const route = routeLabel(pointLabel(t.origin), pointLabel(t.destination));

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[{ label: 'حجز جديد', path: '/booking/new' }, { label: t.tripNumber ? `رحلة ${t.tripNumber}` : 'تفاصيل الرحلة' }]} />
      <PageHeader
        title={route}
        subtitle={`${t.carrier.name}${t.tripNumber ? ` • ${t.tripNumber}` : ''} • ${formatDateTime(t.departureAt)}`}
        badge={
          <div className="flex gap-1">
            {t.serviceClass === 'VIP' && <Badge variant="warning">VIP</Badge>}
            <Badge variant={t.seatsFree > 0 ? 'success' : 'error'} dot>
              {t.seatsFree > 0 ? `${t.seatsFree} مقعد متاح` : 'مكتملة'}
            </Badge>
          </div>
        }
        actions={
          can('broker.book') ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs font-semibold">
                المسافرون
                <select
                  className="h-10 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2 text-sm"
                  value={passengers}
                  disabled={!canBook}
                  onChange={(e) => setPassengers(Number(e.target.value))}
                >
                  {Array.from({ length: Math.max(1, Math.min(9, t.seatsFree)) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
              icon="add_circle"
              disabled={!canBook}
              title={canBook ? undefined : 'لا توجد مقاعد متاحة أو المكتب موقوف'}
                onClick={() => navigate('/booking/new', { state: { trip: t, search: searchForTrip(t, passengers) } })}
              >
                حجز هذه الرحلة
              </Button>
            </div>
          ) : undefined
        }
        className="mb-0"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">الرحلة</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="من">{pointLabel(t.origin)}</Field>
            <Field label="إلى">{pointLabel(t.destination)}</Field>
            <Field label="موعد المغادرة">{formatDateTime(t.departureAt)}</Field>
            <Field label="موعد الوصول المتوقع">{formatDateTime(t.arrivalAt)}</Field>
            <Field label="المدة">{formatDuration(t.durationMinutes)}</Field>
            <Field label="نوع الرحلة">{t.isDirect ? 'مباشرة' : `${stops.length} توقف`}</Field>
            <Field label="درجة الخدمة">{serviceClassLabel(t.serviceClass)}</Field>
            <Field label="الحافلة">{t.vehicleModel ?? '—'}</Field>
            {t.tripNumber && <Field label="رقم الرحلة" mono>{t.tripNumber}</Field>}
          </dl>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">السعر والعمولة</h2>
          <dl className="space-y-3 text-sm">
            <Row label="سعر التذكرة للمسافر" strong>
              {formatSdg(t.basePrice)}
            </Row>
            <Row label="نسبة عمولة المكتب">{formatPercent(t.commissionPercent)}</Row>
            <Row label="عمولتك عن كل مقعد">{formatSdg(t.expectedCommissionPerSeat)}</Row>
          </dl>
          <p className="text-xs text-on-surface-variant">يُخصم سعر التذكرة كاملًا من محفظة المكتب، وتُستحق العمولة وتُسوّى لاحقًا من المنصة.</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="space-y-space-sm">
          <h2 className="font-bold">شركة النقل</h2>
          <div className="flex items-center gap-space-sm">
            {t.carrier.logoUrl ? (
              <img src={t.carrier.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain bg-surface-container" />
            ) : (
              <span className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center material-symbols-outlined text-secondary">directions_bus</span>
            )}
            <div>
              <div className="font-semibold">{t.carrier.name}</div>
              {t.carrier.legalName && t.carrier.legalName !== t.carrier.name && <div className="text-xs text-on-surface-variant">{t.carrier.legalName}</div>}
              <div className="text-xs text-on-surface-variant">
                {t.carrier.rating.average !== null ? `التقييم ${t.carrier.rating.average.toFixed(1)} من 5 (${t.carrier.rating.count})` : 'لا تقييمات بعد'}
              </div>
            </div>
          </div>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المقاعد</h2>
          <dl className="space-y-2 text-sm">
            <Row label="متاحة">{t.availability.free}</Row>
            <Row label="محجوزة مؤقتًا">{t.availability.held}</Row>
            <Row label="مباعة">{t.availability.sold}</Row>
            <Row label="الإجمالي" strong>
              {t.availability.total}
            </Row>
          </dl>
          <div className="h-2 rounded-full bg-surface-container overflow-hidden" aria-label={`نسبة الإشغال ${occupancyPercent(t.availability)}%`}>
            <div className="h-full bg-secondary" style={{ width: `${occupancyPercent(t.availability)}%` }} />
          </div>
          <p className="text-xs text-on-surface-variant">نسبة الإشغال {occupancyPercent(t.availability)}%</p>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">المزايا</h2>
          {t.amenities.length === 0 ? (
            <p className="text-sm text-on-surface-variant">لم تحدد شركة النقل مزايا لهذه الرحلة.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {t.amenities.map((a) => (
                <li key={a.code} className="inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-xs">
                  <span className="material-symbols-outlined text-[16px] text-secondary">{a.icon || 'check'}</span>
                  {a.nameAr}
                  {a.value ? `: ${a.value}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="space-y-space-sm">
        <h2 className="font-bold">مسار الرحلة</h2>
        <ol className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md space-y-3">
          {t.stops.map((s) => (
            <li key={`${s.sequence}-${s.kind}`} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1 w-3 h-3 rounded-full shrink-0 ${s.kind === 'STOP' ? 'border-2 border-secondary bg-surface-container-lowest' : 'bg-secondary'}`}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="font-semibold">{pointLabel({ station: s.station, city: s.city })}</div>
                <div className="text-xs text-on-surface-variant">
                  {stopKindLabel(s.kind)}
                  {s.scheduledAt ? ` • ${formatDateTime(s.scheduledAt)}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-space-sm">
        <h2 className="font-bold">خريطة المقاعد</h2>
        <SeatMap seats={t.seats} layout={t.layout} selected={[]} onToggle={NOOP} readOnly />
        {can('broker.book') && <p className="text-xs text-on-surface-variant">لاختيار المقاعد وحجزها اضغط «حجز هذه الرحلة».</p>}
      </section>
    </div>
  );
};
