import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../model';
import { connectStrokes, normalizeDrawing } from './continuous-route';

describe('continuous route', () => {
  it('nearestRouteReordersAndReversesStrokesWithExplicitBridges', () => {
    const strokes: readonly (readonly Vec2[])[] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [10, 0],
        [9, 0],
      ],
      [
        [4, 0],
        [2, 0],
      ],
    ];
    expect(connectStrokes(strokes)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [4, 0],
      [9, 0],
      [10, 0],
    ]);
    expect(strokes[2]).toEqual([
      [4, 0],
      [2, 0],
    ]);
  });
  it('originalRoutePreservesInputOrderingAndDirection', () => {
    expect(
      connectStrokes(
        [
          [
            [0, 0],
            [1, 0],
          ],
          [
            [5, 2],
            [3, 2],
          ],
        ],
        'original',
      ),
    ).toEqual([
      [0, 0],
      [1, 0],
      [5, 2],
      [3, 2],
    ]);
  });
  it('normalizationCentersBoundsAndPreservesAspectRatio', () => {
    expect(
      normalizeDrawing([
        [10, 20],
        [18, 24],
        [14, 22],
      ]),
    ).toEqual([
      [-1, -0.5],
      [1, 0.5],
      [0, 0],
    ]);
    expect(
      normalizeDrawing([
        [2, 4],
        [2, 8],
      ]),
    ).toEqual([
      [0, -1],
      [0, 1],
    ]);
  });
  it('normalizationHandlesLargeFiniteCoordinates', () => {
    expect(
      normalizeDrawing([
        [-1e308, 0],
        [1e308, 1e308],
      ]),
    ).toEqual([
      [-1, -0.5],
      [1, 0.5],
    ]);
  });
  it('rejectsInvalidOrDegenerateGeometry', () => {
    const invalid: readonly (readonly Vec2[])[] = [
      [],
      [[0, 0]],
      [
        [1, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [Infinity, 0],
      ],
      [
        [NaN, 0],
        [1, 1],
      ],
    ];
    for (const points of invalid) {
      expect(() => normalizeDrawing(points)).toThrow();
      expect(() => connectStrokes([points])).toThrow();
    }
  });
  it('rejectsEmptyAndDegenerateIndividualStrokes', () => {
    expect(() =>
      connectStrokes([
        [
          [0, 0],
          [1, 1],
        ],
        [],
      ]),
    ).toThrow(/Each stroke/);
    expect(() =>
      connectStrokes([
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [2, 2],
        ],
      ]),
    ).toThrow(/Each stroke/);
  });
  it('acceptsExactlyTenThousandPointsAndRejectsTheNext', () => {
    const points: Vec2[] = Array.from({ length: 10_000 }, (_, i) => [i, 0]);
    expect(normalizeDrawing(points)).toHaveLength(10_000);
    expect(connectStrokes([points])).toHaveLength(10_000);
    points.push([10_000, 0]);
    expect(() => normalizeDrawing(points)).toThrow(/10000/);
    expect(() => connectStrokes([points])).toThrow(/10000/);
  });
  it('returnsIndependentCoordinateArrays', () => {
    const input: Vec2[] = [
      [0, 0],
      [1, 1],
    ];
    const result = connectStrokes([input]);
    expect(result).not.toBe(input);
    expect(result[0]).not.toBe(input[0]);
  });
});
it('nearestRouteRotatesClosedStrokeEntryWithoutChangingItsEdges', () => {
  const first: Vec2[] = [
    [0, 0],
    [1, 0],
  ];
  const ring: Vec2[] = [
    [4, 0],
    [4, 3],
    [2, 3],
    [2, 0],
    [4, 0],
  ];
  expect(connectStrokes([first, ring])).toEqual([
    [0, 0],
    [1, 0],
    [2, 0],
    [4, 0],
    [4, 3],
    [2, 3],
    [2, 0],
  ]);
  expect(connectStrokes([first, ring], 'original')).toEqual([...first, ...ring]);
  expect(ring[0]).toEqual([4, 0]);
});
