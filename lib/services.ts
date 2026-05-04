export interface Service {
  id: string;
  name: string;
  duration: number; // minutes
}

export const SERVICES: Service[] = [
  { id: 'haircut',       name: 'תספורת',        duration: 30 },
  { id: 'beard',         name: 'עיצוב זקן',      duration: 20 },
  { id: 'haircut-beard', name: 'תספורת + זקן',   duration: 50 },
];

export const OPEN_HOUR  = 9;
export const CLOSE_HOUR = 18;
export const SLOT_STEP  = 30;

export function generateSlots(openHour = OPEN_HOUR, closeHour = CLOSE_HOUR): string[] {
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

// Accepts Israeli mobile (05X/07X, 10 digits) and landline (02-09, 9-10 digits)
export function isValidIsraeliPhone(phone: string): boolean {
  return /^0[2-9]\d{7,8}$/.test(phone);
}
