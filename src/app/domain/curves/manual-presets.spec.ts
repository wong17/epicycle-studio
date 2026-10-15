import { it, expect } from 'vitest';
import { getManualPreset } from './manual-presets';
import { evaluate2D, evaluateManual3D } from '../fourier/math';
import { createProject } from '../projects/project-schema';
it('manualPresetsArePeriodicAndValidated', () => {
  for (const dimension of [2, 3] as const)
    for (const id of dimension === 2
      ? ['rose', 'ellipse', 'lissajous']
      : ['coplanar', 'perpendicular', 'five']) {
      const s = getManualPreset(dimension, id);
      expect(() => createProject(dimension, s)).not.toThrow();
      if (s.kind === 'manual2d') {
        const a = evaluate2D(s.offset, s.circles, 0),
          b = evaluate2D(s.offset, s.circles, 1);
        for (let d = 0; d < 2; d++) expect(a[d]).toBeCloseTo(b[d], 10);
      }
      if (s.kind === 'manual3d') {
        const a = evaluateManual3D(s.offset, s.circles, 0),
          b = evaluateManual3D(s.offset, s.circles, 1);
        for (let d = 0; d < 3; d++) expect(a[d]).toBeCloseTo(b[d], 10);
      }
    }
});
