import { it, expect } from 'vitest';
import { createManualCurve3, createFourierCurve3 } from './curve-evaluator';
it('analyticDerivativeAndBoundPreserveHighFrequency', () => {
  const c = createManualCurve3(
    [0.25, 0, 0],
    [{ frequency: 128, radius: 1, phase: 0, axisU: [1, 0, 0], axisV: [0, 1, 0] }],
  );
  expect(c.tangentAt(0)).toEqual([0, Math.PI * 256, 0]);
  expect(c.secondDerivativeBound).toBe((Math.PI * 256) ** 2);
  const h = createFourierCurve3([0, 0, 0], [{ frequency: 2, a: [1, 0, 0], b: [0, 0, 1] }]);
  expect(h.tangentAt(0)).toEqual([0, 0, Math.PI * 4]);
  expect(h.pointAt(0.25)[0]).toBeCloseTo(-1, 12);
});
