export const MAX_KOBO = 2_000_000_000;
export function wholeNairaToKobo(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_KOBO / 100) throw new Error('Invalid whole-naira amount');
  return value * 100;
}
export function assertKobo(value: number): void {
  if (!Number.isSafeInteger(value) || value === 0 || Math.abs(value) > MAX_KOBO) throw new Error('Invalid kobo amount');
}
