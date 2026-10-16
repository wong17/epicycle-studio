import { it, expect } from 'vitest';
import { recommendTermCount } from './recommendation';
import { Fourier2D } from '../model';
it('choosesFewTermsForCircleAndMoreThan64ForDetailedSpectrum', () => {
  const circle: Fourier2D = {
    kind: 'fourier2d',
    offset: [0, 0],
    sampleCount: 256,
    terms: [{ radius: 0.5, phase: 0, frequency: 1 }],
  };
  expect(recommendTermCount(circle)).toBe(1);
  const detailed: Fourier2D = {
    ...circle,
    terms: Array.from({ length: 120 }, (_, i) => ({ radius: 0.005, phase: 0, frequency: i + 1 })),
  };
  const count = recommendTermCount(detailed);
  expect(count).toBeGreaterThan(64);
  const omitted = detailed.terms.slice(count);
  expect(Math.sqrt(omitted.reduce((sum, term) => sum + term.radius ** 2, 0))).toBeLessThanOrEqual(
    0.0015,
  );
  expect(omitted.reduce((sum, term) => sum + term.radius, 0)).toBeLessThanOrEqual(0.02);
});

it('recommendationIsIndependentOfDrawingScale', () => {
  const analysis: Fourier2D = {
    kind: 'fourier2d',
    offset: [0, 0],
    sampleCount: 256,
    terms: Array.from({ length: 120 }, (_, i) => ({
      radius: 0.01 / (i + 1),
      phase: 0,
      frequency: i + 1,
    })),
  };
  const enlarged = {
    ...analysis,
    terms: analysis.terms.map((term) => ({ ...term, radius: term.radius * 100 })),
  };
  expect(recommendTermCount(enlarged, 0.01)).toBe(recommendTermCount(analysis));
});
