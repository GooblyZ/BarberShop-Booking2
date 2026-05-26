export interface Service {
  id: number;
  name: string;
  duration: number;
  price: number | null;
  active: number;
  sort_order: number;
}

export const SLOT_STEP = 30;

export function generateSlots(openHour = 9, closeHour = 18): string[] {
  const slots: string[] = [];
  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += SLOT_STEP) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function hasOverlap(
  aStart: number, aDuration: number,
  bStart: number, bDuration: number
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

// Israeli mobile only: 05X-XXXXXXX, exactly 10 digits
export function isValidIsraeliPhone(phone: string): boolean {
  return /^05\d{8}$/.test(phone);
}
