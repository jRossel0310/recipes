import { describe, it, expect } from 'vitest';
import { estimateTurkey, formatMinutes } from './turkey';

describe('estimateTurkey', () => {
  it('uses 13 minutes per pound', () => {
    expect(estimateTurkey(12)!.cook).toBe(155); // 156, rounded to 5
    expect(estimateTurkey(20)!.cook).toBe(260);
  });

  it('starts temperature checks 30 minutes before the estimate', () => {
    expect(estimateTurkey(12)!.checkAt).toBe(125);
  });

  it('adds 30-45 minutes of resting to the total', () => {
    const e = estimateTurkey(12)!;
    expect(e.totalLow).toBe(e.cook + 30);
    expect(e.totalHigh).toBe(e.cook + 45);
  });

  it('rounds to 5 minutes', () => {
    expect(estimateTurkey(13.3)!.cook % 5).toBe(0);
  });

  it('rejects empty or non-positive weights', () => {
    expect(estimateTurkey(0)).toBeNull();
    expect(estimateTurkey(-3)).toBeNull();
    expect(estimateTurkey(NaN)).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(180)).toBe('3 hr');
    expect(formatMinutes(205)).toBe('3 hr 25 min');
  });
});
