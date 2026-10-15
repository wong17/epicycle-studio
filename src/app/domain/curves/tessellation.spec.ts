import { it, expect } from 'vitest';
import { planTessellation } from './tessellation';
it('tubeMeetsCurveToleranceOrBlocksExport', () => {
  const M = (2 * Math.PI * 128) ** 2,
    p = planTessellation(M, 0.01);
  expect(p.segments).toBeGreaterThan(512);
  expect(p.withinBudget).toBe(false);
  expect(p.errorBound).toBeGreaterThan(0.01);
  const acceptable = planTessellation(M, 0.04);
  expect(acceptable.withinBudget).toBe(true);
  expect(acceptable.errorBound).toBeLessThanOrEqual(0.04);
});
