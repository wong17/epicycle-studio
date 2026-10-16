import { it, expect } from 'vitest';
import { createProject, parseProject, migrateProject, exportProjectV1 } from './project-schema';
import {
  encodeShare,
  decodeShare,
  exportSvg,
  inspectSvg,
} from '../../infrastructure/transfer/transfer';
import { sampleCurve } from '../fourier/math';
const project = () =>
  createProject(
    2,
    {
      kind: 'manual2d',
      offset: [0.25, -0.4],
      circles: [{ id: crypto.randomUUID(), frequency: -2, radius: 0.5, phase: 0.3 }],
    },
    'Órbita ☄',
  );
it('projectRoundTripAndMigrationPreserveGeometry', () => {
  const p = project();
  expect(parseProject(JSON.stringify(p))).toEqual(p);
  const v1 = { ...p, schemaVersion: 1 };
  expect(migrateProject(v1)).toEqual(p);
  expect(migrateProject(migrateProject(v1))).toEqual(p);
});
it('rejectsFutureVersionsExtraKeysAndInvalidBases', () => {
  const p = project();
  expect(() => parseProject(JSON.stringify({ ...p, schemaVersion: 3 }))).toThrow();
  expect(() => parseProject(JSON.stringify({ ...p, unexpected: true }))).toThrow();
  expect(() =>
    createProject(3, {
      kind: 'manual3d',
      offset: [0, 0, 0],
      circles: [
        {
          id: crypto.randomUUID(),
          frequency: 1,
          radius: 1,
          phase: 0,
          axisU: [2, 0, 0],
          axisV: [0, 1, 0],
        },
      ],
    }),
  ).toThrow();
});
it('shareRoundTripUnicodeAndSizeLimits', () => {
  const p = project(),
    decoded = decodeShare(encodeShare(p)!);
  expect(decoded.source).toEqual(p.source);
  expect(decoded.name).toBe(p.name);
  expect(decoded.id).not.toBe(p.id);
  expect(() => decodeShare('!invalid')).toThrow();
  expect(() => decodeShare('a'.repeat(8001))).toThrow();
  const large = createProject(2, {
    kind: 'curve2d',
    points: Array.from({ length: 2048 }, (_, i) => [Math.cos(i), Math.sin(i)]),
    closure: 'segment',
  });
  expect(encodeShare(large)).toBeNull();
});
it('exportsSvgWithOneVerticalInversion', () => {
  const s = sampleCurve(2, 8, (t) => [Math.cos(t * Math.PI * 2), Math.sin(t * Math.PI * 2)]),
    svg = exportSvg(s, '#d4f477', 2);
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('0.7071067811865476,-0.7071067811865475');
  expect(() => exportSvg(s, 'red', 2)).toThrow();
});
it('rejectsUnsafeSvgWithoutExecutingMarkup', () => {
  for (const body of [
    '<script>alert(1)</script><path d="M0 0L1 1Z"/>',
    '<path transform="scale(2)" d="M0 0L1 1Z"/>',
    '<use href="https://example.com"/>',
    '<path d="M0 0L1 1M2 2L3 3"/>',
  ])
    expect(() => inspectSvg(`<svg viewBox="0 0 10 10">${body}</svg>`)).toThrow();
  expect(inspectSvg('<svg viewBox="0 0 10 10"><path d="M0 0L1 1Z"/></svg>')).toHaveLength(1);
});

it('roundTripsEditableStrokeBoundariesAndRgbWithoutChangingLegacyExports', () => {
  const p = createProject(2, {
    kind: 'curve2d',
    closure: 'return',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ],
    strokeStarts: [0, 3],
  });
  p.appearance.colorMode = 'spectrum';
  const restored = parseProject(JSON.stringify(p));
  expect(restored.source).toEqual(p.source);
  expect(restored.appearance.colorMode).toBe('spectrum');
  const legacy = migrateProject(exportProjectV1(p));
  expect(legacy.appearance.colorMode).toBeUndefined();
  expect(legacy.source).not.toHaveProperty('strokeStarts');
  for (const starts of [[1], [0, 0], [0, 100]]) {
    expect(() =>
      parseProject(JSON.stringify({ ...p, source: { ...p.source, strokeStarts: starts } })),
    ).toThrow();
  }
});
