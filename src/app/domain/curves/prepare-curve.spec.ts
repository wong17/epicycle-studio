import { describe, expect, it } from 'vitest';
import { prepareCurve, resampleClosedPolyline } from './prepare-curve';
describe('curve preparation', () => {
  it('resamplesSquareByDistance', () => {
    expect(
      Array.from(
        resampleClosedPolyline(
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ],
          2,
          8,
        ).coordinates,
      ),
    ).toEqual([-1, -1, 0, -1, 1, -1, 1, 0, 1, 1, 0, 1, -1, 1, -1, 0]);
  });
  it('rejectsInvalidCurve', () => {
    const cases: [readonly (readonly [number, number])[], string][] = [
      [[], 'EMPTY'],
      [[[0, 0]], 'DEGENERATE'],
      [
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        'DEGENERATE',
      ],
      [
        [
          [0, 0],
          [1, 1],
          [NaN, 0],
        ],
        'NON_FINITE',
      ],
    ];
    for (const [points, code] of cases)
      expect(() => prepareCurve(points, 2, 'segment', 256)).toThrow(code);
    expect(() =>
      prepareCurve(
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        2,
        'segment',
        256,
      ),
    ).toThrow('DIMENSION');
    expect(() =>
      prepareCurve(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        2,
        'segment',
        255,
      ),
    ).toThrow('COUNT');
  });
  it('normalizationIsInvertible', () => {
    const result = prepareCurve(
      [
        [10, 20],
        [14, 20],
        [14, 24],
        [10, 24],
      ],
      2,
      'segment',
      256,
    );
    expect(result.sourceCenter).toEqual([12, 22]);
    expect(result.sourceScale).toBe(0.5);
    expect(result.samples.coordinates[0] / result.sourceScale + result.sourceCenter[0]).toBe(10);
  });
  it('preservesOrientationAndClosureChoice', () => {
    const a = prepareCurve(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      2,
      'return',
      256,
    );
    const b = prepareCurve(
      [
        [0, 0],
        [0.5, 0],
        [1, 0],
        [1, 0.5],
        [1, 1],
      ],
      2,
      'return',
      256,
    );
    expect(Array.from(a.samples.coordinates)).toEqual(Array.from(b.samples.coordinates));
    expect(a.samples.coordinates[128]).toBe(1);
    expect(() =>
      prepareCurve(
        [
          [-1, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
        ],
        2,
        'segment',
        256,
      ),
    ).not.toThrow();
  });
});

it('rejectsBoundsAndPointLimitWithoutMutatingInput', () => {
  const original = [
    [0, 0],
    [1, 0],
    [0, 1],
  ] as const;
  expect(() =>
    prepareCurve(
      [
        [0, 0],
        [Infinity, 0],
        [0, 1],
      ],
      2,
      'segment',
      256,
    ),
  ).toThrow('NON_FINITE');
  expect(() =>
    prepareCurve(
      [
        [0, 0],
        [1e6 + 1, 0],
        [0, 1],
      ],
      2,
      'segment',
      256,
    ),
  ).toThrow('BOUNDS');
  expect(() =>
    prepareCurve(
      Array.from({ length: 10001 }, () => [0, 0] as const),
      2,
      'segment',
      256,
    ),
  ).toThrow('LIMIT');
  const copy = JSON.stringify(original);
  prepareCurve(original, 2, 'segment', 256);
  expect(JSON.stringify(original)).toBe(copy);
});
