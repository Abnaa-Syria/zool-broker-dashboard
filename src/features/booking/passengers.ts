import type { Gender, PassengerInput, TripSeat } from './types';

/** Per-seat passenger form row (strings while editing; gender '' = not specified). */
export type PassengerDraft = { fullName: string; phone: string; idNumber: string; gender?: Gender | '' };

export const emptyPassenger = (): PassengerDraft => ({ fullName: '', phone: '', idNumber: '', gender: '' });

export type PassengerErrors = Partial<Record<keyof PassengerDraft, string>>;

const PHONE_CHARS = /^\+?[0-9\s-]+$/;

/**
 * Mirrors the broker API's passenger schema: fullName 2–160, phone 7–32, optional idNumber ≤ 64.
 * `womenOnly`: the passenger sits in a women-only seat (on any leg) → gender FEMALE is required.
 */
export function validatePassenger(p: PassengerDraft, opts: { womenOnly?: boolean } = {}): PassengerErrors {
  const errors: PassengerErrors = {};
  const name = p.fullName.trim();
  const phone = p.phone.trim();
  const id = p.idNumber.trim();
  if (name.length < 2) errors.fullName = 'الاسم الكامل مطلوب (حرفان على الأقل).';
  else if (name.length > 160) errors.fullName = 'الاسم طويل جدًا.';
  if (!phone) errors.phone = 'رقم الهاتف مطلوب.';
  else if (!PHONE_CHARS.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.length > 32) {
    errors.phone = 'رقم هاتف غير صحيح.';
  }
  if (id.length > 64) errors.idNumber = 'رقم الهوية طويل جدًا.';
  if (opts.womenOnly) {
    if (!p.gender) errors.gender = 'حدّد الجنس: المقعد مخصص للسيدات.';
    else if (p.gender !== 'FEMALE') errors.gender = 'المقعد مخصص للسيدات: اختر مقعدًا آخر لهذا المسافر.';
  }
  return errors;
}

export function hasErrors(errors: PassengerErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** API payload: trimmed, idNumber / gender omitted when empty. */
export function toPassengerInput(p: PassengerDraft): PassengerInput {
  const id = p.idNumber.trim();
  return { fullName: p.fullName.trim(), phone: p.phone.trim(), ...(id ? { idNumber: id } : {}), ...(p.gender ? { gender: p.gender } : {}) };
}

/**
 * Passenger i sits in seat i of every leg (outbound + return for a round trip).
 * True for passengers that have a women-only seat on at least one leg.
 */
export function womenOnlyPassengers(count: number, legs: ReadonlyArray<ReadonlyArray<Pick<TripSeat, 'isWomenOnly'>>>): boolean[] {
  return Array.from({ length: count }, (_, i) => legs.some((seats) => seats[i]?.isWomenOnly === true));
}

/** Resize the drafts to `count`, keeping what was already typed. */
export function resizeDrafts(drafts: readonly PassengerDraft[], count: number): PassengerDraft[] {
  return Array.from({ length: count }, (_, i) => drafts[i] ?? emptyPassenger());
}
