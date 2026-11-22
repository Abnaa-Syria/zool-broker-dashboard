import * as React from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { sudanDate } from '../../lib/dates';
import { useCities, type TripSearch } from './api';

export const MAX_PASSENGERS = 10;

const SELECT_CLASS =
  'h-10 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/60 px-3 focus:outline-none focus:ring-2 focus:ring-secondary/30';

export const SearchStep: React.FC<{ initial: TripSearch; onSearch: (s: TripSearch) => void }> = ({ initial, onSearch }) => {
  const [form, setForm] = React.useState<TripSearch>(initial);
  const cities = useCities();
  const today = sudanDate();
  const sameCity = form.fromCityId !== '' && form.fromCityId === form.toCityId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sameCity) onSearch(form);
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
      <form onSubmit={submit} className="space-y-space-md">
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
        {sameCity && <p className="text-xs text-error">اختر مدينتين مختلفتين.</p>}
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <Input
            type="date"
            label="تاريخ السفر (توقيت السودان)"
            min={today}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            hint="اتركه فارغًا لعرض كل الرحلات القادمة"
          />
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
          البحث عن رحلات للعميل
        </Button>
      </form>
    </Card>
  );
};
