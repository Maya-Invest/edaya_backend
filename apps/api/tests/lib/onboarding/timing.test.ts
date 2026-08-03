import { describe, expect, it } from 'bun:test';
import { logOnboardingTiming, timeOnboardingPhase } from '@/lib/onboarding/timing';

describe('onboarding timing helper', () => {
  it('times async phases and returns the result', async () => {
    const result = await timeOnboardingPhase('test', 'phase', async () => 42, { n: 1 });
    expect(result).toBe(42);
  });

  it('logOnboardingTiming accepts entries without throwing', () => {
    expect(() => {
      logOnboardingTiming({ step: 'test', phase: 'manual', ms: 1.5, meta: { ok: true } });
    }).not.toThrow();
  });
});
