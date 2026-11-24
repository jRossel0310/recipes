// Rough roasting-time estimate for a whole, unstuffed turkey at 350°F:
// 13 minutes per pound. Internal temperature is what decides doneness;
// this is only for planning the oven.
export const MIN_PER_LB = 13;
export const REST_MIN_LOW = 30;
export const REST_MIN_HIGH = 45;

export interface TurkeyEstimate {
  cook: number; // minutes
  checkAt: number; // minutes in, when to start checking temperatures
  totalLow: number; // cook + rest
  totalHigh: number;
}

export function estimateTurkey(lbs: number): TurkeyEstimate | null {
  if (!Number.isFinite(lbs) || lbs <= 0) return null;
  const cook = roundTo5(lbs * MIN_PER_LB);
  return {
    cook,
    checkAt: Math.max(0, cook - 30),
    totalLow: cook + REST_MIN_LOW,
    totalHigh: cook + REST_MIN_HIGH,
  };
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function roundTo5(min: number): number {
  return Math.round(min / 5) * 5;
}
