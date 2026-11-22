import * as React from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { sudanDate } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { useCities } from './api';
import { searchError, type BookingSearch, type TripType } from './roundTrip';

export const MAX_PASSENGERS = 10;

const SELECT_CLASS =
  'h-10 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/60 px-3 focus:outline-none focus:ring-2 focus:ring-secondary/30';

const TRIP_TYPES: Array<{ id: TripType; label: string; icon: string }> = [
  { id: 'ONE_WAY', label: 'ذهاب فقط', icon: 'arrow_back' },
  { id: 'ROUND_TRIP', label: 'ذهاب وعودة', icon: 'sync_alt' },
];

export const SearchStep: React.FC<{ initial: BookingSearch; onSearch: (s: BookingSearch) => void }> = ({ initial, onSearch }) => {
  const [form, setForm] = React.useState<BookingSearch>(initial);
  const [touched, setTouched] = React.useState(false);
  const cities = useCities();
  const today = sudanDate();
  const roundTrip = form.tripType === 'ROUND_TRIP';
  const error = searchError(form);
  const sameCity = form.fromCityId !== '' && form.fromCityId === form.toCityId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!error) onSearch(roundTrip ? form : { ...form, returnDate: '' });
  };

  const citySelect = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1 w-full text-xs font-semibold">
      {label}
      <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} disabled={cities.isLoading}>
        <option value="">كل المدن</option>
        {cities.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nameAr}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card className="max-w-3xl">
      <form onSubmit={submit} className="space-y-space-md" noValidate>
        <div role="radiogroup" aria-label="نوع الرحلة" className="inline-flex rounded-lg bg-surface-container-low border border-outline-variant/40 p-1 gap-1">
          {TRIP_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={form.tripType === t.id}
              onClick={() => setForm({ ...form, tripType: t.id })}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold',
                form.tripType === t.id ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container',
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-end gap-space-sm">
          {citySelect('من', form.fromCityId, (v) => setForm({ ...form, fromCityId: v }))}
          <IconButton
            type="button"
            icon="swap_horiz"
            label="تبديل الاتجاه"
            className="self-center md:self-end shrink-0"
            onClick={() => setForm({ ...form, fromCityId: form.toCityId, toCityId: form.fromCityId })}
          />
          {citySelect('إلى', form.toCityId, (v) => setForm({ ...form, toCityId: v }))}
        </div>
        {cities.isError && <p className="text-xs text-error">تعذّر تحميل المدن؛ يمكنك البحث بدون تحديد المدن.</p>}
        {(sameCity || (touched && error)) && <p role="alert" className="text-xs text-error">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <Input
            type="date"
            label={roundTrip ? 'تاريخ الذهاب (توقيت السودان)' : 'تاريخ السفر (توقيت السودان)'}
            min={today}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            hint={roundTrip ? undefined : 'اتركه فارغًا لعرض كل الرحلات القادمة'}
          />
          {roundTrip && (
            <Input
              type="date"
              label="تاريخ العودة"
              min={form.date || today}
              value={form.returnDate}
              onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
              hint="رحلة العودة تغادر بعد وصول رحلة الذهاب"
            />
          )}
          <label className="flex flex-col gap-1 w-full text-xs font-semibold">
            عدد المسافرين
            <select className={SELECT_CLASS} value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) })}>
              {Array.from({ length: MAX_PASSENGERS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'مسافر' : 'مسافرين'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" size="lg" icon="search" className="w-full sm:w-auto" disabled={sameCity}>
          {roundTrip ? 'البحث عن رحلات الذهاب' : 'البحث عن رحلات للعميل'}
        </Button>
      </form>
    </Card>
  );
};
