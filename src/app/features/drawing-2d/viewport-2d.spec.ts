import { it, expect } from 'vitest';
import { Viewport2D } from './viewport-2d';
it('viewportRoundTrip', () => {
  const v = new Viewport2D();
  v.width = 900;
  v.height = 500;
  v.center = [0.25, -0.4];
  v.zoom = 2;
  v.scale = 120;
  for (const p of [
    [0, 0],
    [1, -2],
    [-0.3, 0.8],
  ] as const) {
    const result = v.screenToWorld(v.worldToScreen(p));
    expect(result[0]).toBeCloseTo(p[0], 12);
    expect(result[1]).toBeCloseTo(p[1], 12);
  }
});
