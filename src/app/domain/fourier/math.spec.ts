import { describe, expect, it } from 'vitest';
import {
  analyze2D,
  analyze3D,
  evaluate2D,
  evaluate3D,
  harmonicToCircles,
  evaluateManual3D,
  sampleCurve,
  select2DTerms,
  measureError,
  restoreSourceFrame,
} from './math';
import { prepareCurve } from '../curves/prepare-curve';
import { Vec3 } from '../model';
const tau = Math.PI * 2;
describe('Fourier', () => {
  it('positiveAndNegativeCircle', () => {
    for (const f of [1, -2]) {
      const a = analyze2D(
        sampleCurve(2, 32, (t) => [Math.cos(tau * f * t), Math.sin(tau * f * t)]),
      );
      const term = select2DTerms(a, 1)[0];
      expect(term.frequency).toBe(f);
      expect(term.radius).toBeCloseTo(1, 10);
    }
  });
  it('keepsTranslationInDc', () => {
    const a = analyze2D(
      sampleCurve(2, 16, (t) => [0.25 + Math.cos(tau * t), -0.4 + Math.sin(tau * t)]),
    );
    expect(a.offset[0]).toBeCloseTo(0.25, 10);
    expect(a.offset[1]).toBeCloseTo(-0.4, 10);
    expect(a.terms.length).toBe(15);
  });
  it('ellipseHasCounterRotatingTerms', () => {
    const a = analyze2D(sampleCurve(2, 16, (t) => [Math.cos(tau * t), 0.5 * Math.sin(tau * t)]));
    expect(select2DTerms(a, 2).map((t) => t.radius)).toEqual([0.75, 0.25]);
  });
  it('matchesIndependentDft', () => {
    const points = sampleCurve(2, 16, (t) => [Math.sin(19 * t) + t, Math.cos(13 * t) - t]);
    const a = analyze2D(points);
    for (let k = 0; k < 16; k++) {
      let re = 0,
        im = 0;
      for (let j = 0; j < 16; j++) {
        const x = points.coordinates[j * 2],
          y = points.coordinates[j * 2 + 1],
          angle = (-tau * k * j) / 16;
        re += x * Math.cos(angle) - y * Math.sin(angle);
        im += x * Math.sin(angle) + y * Math.cos(angle);
      }
      if (k === 0) {
        expect(a.offset[0]).toBeCloseTo(re / 16, 10);
        expect(a.offset[1]).toBeCloseTo(im / 16, 10);
      } else {
        const term = a.terms.find((t) => t.frequency === (k < 8 ? k : k - 16))!;
        expect(term.radius * Math.cos(term.phase)).toBeCloseTo(re / 16, 10);
        expect(term.radius * Math.sin(term.phase)).toBeCloseTo(im / 16, 10);
      }
    }
  });
  it('reconstructionAndTruncation', () => {
    const s = sampleCurve(2, 32, (t) => [Math.sin(13 * t), Math.cos(7 * t)]),
      a = analyze2D(s);
    let previous = Infinity;
    for (let k = 1; k < 32; k++) {
      const error = measureError(
        s,
        sampleCurve(2, 32, (t) => evaluate2D(a.offset, select2DTerms(a, k), t)),
      ).rms;
      expect(error).toBeLessThanOrEqual(previous + 1e-10);
      previous = error;
    }
    expect(previous).toBeLessThan(1e-10);
    expect(() => select2DTerms(a, 32)).toThrow();
  });
  it('preservesSourceScaleAndOffset', () => {
    const p = prepareCurve(
      Array.from(
        { length: 512 },
        (_, j) =>
          [0.25 + 0.5 * Math.cos((tau * j) / 512), 0.5 * Math.sin((tau * j) / 512)] as const,
      ),
      2,
      'segment',
      512,
    );
    const a = restoreSourceFrame(analyze2D(p.samples), p);
    expect(a.offset[0]).toBeCloseTo(0.25, 10);
    if (a.kind === 'fourier2d') expect(select2DTerms(a, 1)[0].radius).toBeCloseTo(0.5, 5);
  });
  it('reconstructsSpatialSamples', () => {
    const s = sampleCurve(3, 32, (t) => [
        Math.cos(tau * 2 * t),
        Math.sin(tau * 3 * t),
        0.5 + Math.cos(tau * 5 * t),
      ]),
      a = analyze3D(s);
    expect(
      measureError(
        s,
        sampleCurve(3, 32, (t) => evaluate3D(a.offset, a.harmonics, t)),
      ).max,
    ).toBeLessThan(1e-10);
  });
  it('realSpectrumNyquist', () => {
    const a = analyze3D(sampleCurve(3, 16, (t) => [Math.cos(tau * 8 * t), 0, 0]));
    const n = a.harmonics.find((h) => h.frequency === 8)!;
    expect(n.a[0]).toBeCloseTo(1, 10);
    expect(n.b).toEqual([0, 0, 0]);
  });
  it('circlePairEqualsEllipse', () => {
    const pairs: [Vec3, Vec3][] = [
      [
        [1, 0, 0],
        [0.4, 1, 0.2],
      ],
      [
        [0, 0, 0],
        [1, 2, 3],
      ],
      [
        [1, 0, 0],
        [0, 0, 0],
      ],
      [
        [1, 0, 0],
        [2, 0, 0],
      ],
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [1e-14, 0, 0],
        [0, 1, 0],
      ],
    ];
    for (const [a, b] of pairs) {
      const h = { frequency: 3, a, b },
        circles = harmonicToCircles(h);
      for (let j = 0; j < 257; j++) {
        const expected = evaluate3D([0, 0, 0], [h], j / 257),
          actual = evaluateManual3D([0, 0, 0], circles, j / 257);
        for (let d = 0; d < 3; d++) expect(actual[d]).toBeCloseTo(expected[d], 10);
      }
    }
  });
});

it('nyquistAppearsOnceAndTermOrderKeepsEndpoint', () => {
  const s = sampleCurve(2, 16, (t) => [Math.cos(tau * 8 * t), 0]),
    a = analyze2D(s);
  expect(a.terms.filter((t) => t.frequency === -8)).toHaveLength(1);
  expect(a.terms.some((t) => t.frequency === 8)).toBe(false);
  const selected = select2DTerms(a, 15),
    ordered = [...selected].reverse();
  for (const phase of [0.1, 0.27, 0.73]) {
    const x = evaluate2D(a.offset, selected, phase),
      y = evaluate2D(a.offset, ordered, phase);
    expect(x[0]).toBeCloseTo(y[0], 10);
    expect(x[1]).toBeCloseTo(y[1], 10);
  }
});

it('seededCoefficientsMatchIndependentDftAtSmallSizes', () => {
  for (const n of [8, 32]) {
    let state = 12345;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296 - 0.5;
    };
    const s = sampleCurve(2, n, () => [random(), random()]),
      a = analyze2D(s);
    for (let k = 0; k < n; k++) {
      let re = 0,
        im = 0;
      for (let j = 0; j < n; j++) {
        const angle = (-2 * Math.PI * k * j) / n,
          x = s.coordinates[2 * j],
          y = s.coordinates[2 * j + 1];
        re += x * Math.cos(angle) - y * Math.sin(angle);
        im += x * Math.sin(angle) + y * Math.cos(angle);
      }
      const c =
        k === 0
          ? a.offset
          : [
              a.terms[k - 1].radius * Math.cos(a.terms[k - 1].phase),
              a.terms[k - 1].radius * Math.sin(a.terms[k - 1].phase),
            ];
      expect(c[0]).toBeCloseTo(re / n, 10);
      expect(c[1]).toBeCloseTo(im / n, 10);
    }
  }
});
