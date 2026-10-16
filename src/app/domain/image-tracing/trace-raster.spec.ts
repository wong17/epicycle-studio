import { describe, expect, it } from 'vitest';
import { Raster, TraceOptions, traceRaster } from './trace-raster';
const defaults: TraceOptions = { style: 'continuous', detail: 2, contrast: 1, invert: false };
function image(width: number, height: number, pixel: (x: number, y: number) => number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = pixel(x, y);
      data[i + 3] = 255;
    }
  return { width, height, data };
}
const square = () => image(64, 64, (x, y) => (x >= 16 && x < 48 && y >= 16 && y < 48 ? 0 : 255));
describe('traceRaster', () => {
  it('produces deterministic finite bounded routes at each detail', () => {
    for (const detail of [1, 3, 5]) {
      const options = { ...defaults, detail };
      const points = traceRaster(square(), options);
      expect(points).toEqual(traceRaster(square(), options));
      expect(points.length).toBeGreaterThanOrEqual(300);
      expect(points.length).toBeLessThanOrEqual(2200);
      expect(points.every((p) => p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1))).toBe(
        true,
      );
      if (detail > 1)
        expect(points.length).toBeGreaterThan(
          traceRaster(square(), { ...defaults, detail: 1 }).length,
        );
    }
  });
  it('keeps noisy contour routing deterministic and within the output budget', () => {
    const raster = image(256, 256, (x, y) => (x * 73 + y * 151 + x * y * 11) % 256);
    const options = { ...defaults, style: 'contours' as const, detail: 5 };
    const points = traceRaster(raster, options);
    expect(points.length).toBe(2200);
    expect(points).toEqual(traceRaster(raster, options));
    expect(
      points.every((point) =>
        point.every((value) => Number.isFinite(value) && Math.abs(value) <= 1),
      ),
    ).toBe(true);
  });
  it('weights continuous line density by midtone darkness', () => {
    const points = traceRaster(
      image(128, 64, (x) => (x < 64 ? 50 : 180)),
      { ...defaults, detail: 5 },
    );
    const dark = points.filter((point) => point[0] < 0).length;
    // Squared darkness should put about 88% of the ink in the darker half.
    expect(dark / points.length).toBeGreaterThan(0.82);
    expect(dark / points.length).toBeLessThan(0.94);
  });
  it('places contours on edges and continuous density inside dark shapes', () => {
    const contour = traceRaster(square(), { ...defaults, style: 'contours' });
    const tonal = traceRaster(square(), defaults);
    const inner = (p: readonly number[]) => Math.abs(p[0]) < 0.35 && Math.abs(p[1]) < 0.35;
    expect(contour.filter(inner).length / contour.length).toBeLessThan(0.1);
    expect(tonal.filter(inner).length / tonal.length).toBeGreaterThan(0.35);
  });
  it('preserves horizontal orientation and maps image top to positive y', () => {
    const points = traceRaster(
      image(64, 64, (x, y) => (x < 24 && y < 24 ? 0 : 255)),
      defaults,
    );
    expect(points.reduce((s, p) => s + p[0], 0) / points.length).toBeLessThan(-0.2);
    expect(points.reduce((s, p) => s + p[1], 0) / points.length).toBeGreaterThan(0.2);
  });
  it('uses inverted brightness to move density to the light region', () => {
    const raster = image(64, 64, (x) => (x < 32 ? 0 : 255));
    const points = traceRaster(raster, { ...defaults, invert: true });
    expect(points.reduce((s, p) => s + p[0], 0) / points.length).toBeGreaterThan(0.2);
  });
  it('rejects blank and fully transparent images', () => {
    for (const level of [0, 128, 255])
      expect(() =>
        traceRaster(
          image(16, 16, () => level),
          defaults,
        ),
      ).toThrow(/detalle|uniforme/i);
    const raster = square();
    for (let i = 3; i < raster.data.length; i += 4) raster.data[i] = 0;
    expect(() => traceRaster(raster, defaults)).toThrow(/detalle|uniforme/i);
  });
  it('rejects malformed and oversized raster dimensions', () => {
    for (const raster of [
      { width: 0, height: 1, data: new Uint8ClampedArray(0) },
      { width: 2.5, height: 2, data: new Uint8ClampedArray(20) },
      { width: 257, height: 2, data: new Uint8ClampedArray(2056) },
      { width: 2, height: 2, data: new Uint8ClampedArray(4) },
    ])
      expect(() => traceRaster(raster, defaults)).toThrow(/imagen|dimensiones/i);
  });
  it('rejects invalid detail and contrast', () => {
    for (const options of [
      { ...defaults, detail: 0 },
      { ...defaults, detail: 6 },
      { ...defaults, detail: 1.5 },
      { ...defaults, contrast: 0.49 },
      { ...defaults, contrast: 2.01 },
      { ...defaults, contrast: NaN },
    ])
      expect(() => traceRaster(square(), options)).toThrow(/opciones/i);
  });
  it('preserves aspect ratio for rectangular source images', () => {
    const points = traceRaster(
      image(128, 32, (x, y) => (x > 8 && x < 120 && y > 4 && y < 28 ? 0 : 255)),
      defaults,
    );
    expect(
      Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])),
    ).toBeLessThan(0.5);
    expect(
      Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])),
    ).toBeGreaterThan(1.5);
  });
});
