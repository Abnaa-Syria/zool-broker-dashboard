import type { PassengerInput } from './types';

/** Per-seat passenger form row (strings while editing). */
export type PassengerDraft = { fullName: string; phone: string; idNumber: string };

export const emptyPassenger = (): PassengerDraft => ({ fullName: '', phone: '', idNumber: '' });

export type PassengerErrors = Partial<Record<keyof PassengerDraft, string>>;

const PHONE_CHARS = /^\+?[0-9\s-]+$/;

/** Mirrors the broker API's passenger schema: fullName 2–160, phone 7–32, optional idNumber ≤ 64. */
export function validatePassenger(p: PassengerDraft): PassengerErrors {
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
  return errors;
}

export function hasErrors(errors: PassengerErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** API payload: trimmed, idNumber omitted when empty. */
export function toPassengerInput(p: PassengerDraft): PassengerInput {
  const id = p.idNumber.trim();
  return { fullName: p.fullName.trim(), phone: p.phone.trim(), ...(id ? { idNumber: id } : {}) };
}

/** Resize the drafts to `count`, keeping what was already typed. */
export function resizeDrafts(drafts: readonly PassengerDraft[], count: number): PassengerDraft[] {
  return Array.from({ length: count }, (_, i) => drafts[i] ?? emptyPassenger());
}
