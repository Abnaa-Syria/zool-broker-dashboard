import * as React from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { sudanDate } from '../../lib/dates';
import { useCitySuggestions, type TripSearch } from './api';

export const MAX_PASSENGERS = 10;

export const SearchStep: React.FC<{ initial: TripSearch; onSearch: (s: TripSearch) => void }> = ({ initial, onSearch }) => {
  const [form, setForm] = React.useState<TripSearch>(initial);
  const cities = useCitySuggestions();
  const today = sudanDate();
  const listId = React.useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ ...form, origin: form.origin.trim(), destination: form.destination.trim() });
  };

  return (
    <Card className="max-w-3xl">
      <form onSubmit={submit} className="space-y-space-md">
        <div className="flex flex-col md:flex-row md:items-end gap-space-sm">
          <Input
            label="من"
            placeholder="مدينة المغادرة"
            list={listId}
            value={form.origin}
            onChange={(e) => setForm({ ...form, origin: e.target.value })}
            startIcon="trip_origin"
            autoComplete="off"
          />
          <IconButton
            type="button"
            icon="swap_horiz"
            label="تبديل الاتجاه"
            className="self-center md:self-end shrink-0"
            onClick={() => setForm({ ...form, origin: form.destination, destination: form.origin })}
          />
          <Input
            label="إلى"
            placeholder="مدينة الوصول"
            list={listId}
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            startIcon="location_on"
            autoComplete="off"
          />
          <datalist id={listId}>
            {cities.data?.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
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
            <select
              className="h-10 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/60 px-3 focus:outline-none focus:ring-2 focus:ring-secondary/30"
              value={form.passengers}
              onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) })}
            >
              {Array.from({ length: MAX_PASSENGERS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'مسافر' : 'مسافرين'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" size="lg" icon="search" className="w-full sm:w-auto">
          البحث عن رحلات للعميل
        </Button>
      </form>
    </Card>
  );
};
