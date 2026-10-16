import { it, expect } from 'vitest';
import { createTextDrawing } from './text-drawing';
import { createProject } from '../projects/project-schema';
import { connectStrokes } from './continuous-route';

it('textRendersEveryCapitalLetterAndDigitAsFiniteStrokes', () => {
  const draft = createTextDrawing('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789');
  const points = connectStrokes(draft.strokes, 'original');
  expect(draft.strokes.length).toBeGreaterThan(36);
  expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
  expect(Math.max(...points.flat().map(Math.abs))).toBeCloseTo(1, 10);
  expect(draft.closure).toBe('return');
});
it('textNormalizesAccentsAndLowercaseWhilePreservingName', () => {
  const draft = createTextDrawing('José Muñoz');
  expect(draft.name).toBe('Texto: José Muñoz');
  expect(draft.strokes).toEqual(createTextDrawing('JOSE MUNOZ').strokes);
});
it('textSupportsCommonPunctuationAndSpanishInvertedMarks', () => {
  const draft = createTextDrawing('.,:;!?¿¡\'"-_+=/\\()[]<>&#%@*');
  expect(draft.strokes.length).toBeGreaterThan(25);
  expect(() => connectStrokes(draft.strokes)).not.toThrow();
});
it('textSeparatesLinesAndPreservesSpacesBetweenGlyphs', () => {
  const draft = createTextDrawing('L\nL');
  const first = draft.strokes[0],
    second = draft.strokes[1];
  expect(first[0][0]).toBe(second[0][0]);
  expect(first[0][1]).toBeGreaterThan(second[0][1]);
  expect(createTextDrawing('L\r\nL').strokes).toEqual(draft.strokes);
  const adjacent = createTextDrawing('LL').strokes;
  const spaced = createTextDrawing('L L').strokes;
  // Normalizing a wider line reduces the width of each individual glyph.
  expect(spaced[0][2][0] - spaced[0][0][0]).toBeLessThan(adjacent[0][2][0] - adjacent[0][0][0]);
});
it('textAcceptsEightyCharactersAndRejectsEightyOne', () => {
  expect(createTextDrawing('A'.repeat(80)).strokes).toHaveLength(160);
  expect(() => createTextDrawing('A'.repeat(81))).toThrow(/80 characters/);
});
it('textRejectsEmptyWhitespaceAndUnsupportedCharactersClearly', () => {
  expect(() => createTextDrawing('')).toThrow(/Enter text/);
  expect(() => createTextDrawing(' \n ')).toThrow(/Enter text/);
  expect(() => createTextDrawing('Hello ♥')).toThrow('Unsupported character: ♥');
  expect(() => createTextDrawing('你好')).toThrow('Unsupported character: 你');
});
it('textRendersSinglePunctuationAndDoesNotReturnMutableSharedGlyphs', () => {
  const period = connectStrokes(createTextDrawing('.').strokes);
  expect(period).toHaveLength(3);
  expect(period[0][0]).toBeCloseTo(-1, 10);
  expect(period[1][0]).toBeCloseTo(0, 10);
  expect(period[2][0]).toBeCloseTo(1, 10);
  expect(period.map((point) => point[1])).toEqual([0, 0, 0]);
  expect(createTextDrawing('A').strokes[0]).not.toBe(createTextDrawing('A').strokes[0]);
});
it('textCapitalLHasOneVerticalAndOneBaselineStroke', () => {
  const draft = createTextDrawing('L');
  expect(draft.strokes).toHaveLength(1);
  const [top, corner, right] = draft.strokes[0];
  expect(top[0]).toBeCloseTo(-2 / 3, 10);
  expect(top[1]).toBeCloseTo(1, 10);
  expect(corner[0]).toBeCloseTo(top[0], 10);
  expect(corner[1]).toBeCloseTo(-1, 10);
  expect(right[0]).toBeCloseTo(2 / 3, 10);
  expect(right[1]).toBeCloseTo(corner[1], 10);
});
it('textDraftNameCollapsesWhitespaceAndFitsProjectNameLimit', () => {
  const draft = createTextDrawing('  Josué\n\t  Wong  '.replace('\t', ' '));
  expect(draft.name).toBe('Texto: Josué Wong');
  expect(createTextDrawing('A'.repeat(80)).name).toHaveLength(80);
  expect(createTextDrawing('L\nL').strokes).not.toEqual(createTextDrawing('L L').strokes);
});

it.each(['-', '/'])('singleSegmentPunctuationCreatesThreeDistinctEditablePoints %s', (text) => {
  const draft = createTextDrawing(text);
  const points = connectStrokes(draft.strokes);
  expect(points).toHaveLength(3);
  expect(new Set(points.map((point) => point.join(','))).size).toBe(3);
  expect(points[1][0]).toBeCloseTo((points[0][0] + points[2][0]) / 2, 10);
  expect(points[1][1]).toBeCloseTo((points[0][1] + points[2][1]) / 2, 10);
  expect(Math.max(...points.flat().map(Math.abs))).toBeCloseTo(1, 10);
  expect(() =>
    createProject(
      2,
      {
        kind: 'curve2d',
        points: points.map(([x, y]): [number, number] => [x, y]),
        closure: draft.closure,
      },
      draft.name,
    ),
  ).not.toThrow();
});
