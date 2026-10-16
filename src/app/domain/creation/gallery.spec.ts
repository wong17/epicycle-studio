import { it, expect } from 'vitest';
import { GALLERY, getGalleryDrawing } from './gallery';
import { connectStrokes } from './continuous-route';

it('galleryContainsEightDistinctOriginalSubjectsAcrossCategories', () => {
  expect(GALLERY.map((item) => item.id)).toEqual([
    'profile',
    'bird',
    'landscape',
    'flower',
    'spiral',
    'butterfly',
    'skyline',
    'fish',
  ]);
  expect(new Set(GALLERY.map((item) => item.category))).toEqual(
    new Set(['portraits', 'nature', 'geometry']),
  );
  expect(GALLERY.every((item) => item.name.length > 0 && item.description.length > 0)).toBe(true);
});
it.each(GALLERY)('gallerySubjectProducesFiniteNormalizedUsableStrokes $id', (item) => {
  const draft = getGalleryDrawing(item.id);
  const points = connectStrokes(draft.strokes);
  expect(draft.name).toBe(item.name);
  expect(draft.closure).toBe('return');
  expect(points.length).toBeGreaterThan(20);
  expect(points.length).toBeLessThanOrEqual(10_000);
  expect(points.every((point) => point.every(Number.isFinite))).toBe(true);
  expect(Math.max(...points.flat().map(Math.abs))).toBeCloseTo(1, 10);
  expect(getGalleryDrawing(item.id, 1).strokes).not.toEqual(draft.strokes);
  expect(getGalleryDrawing(item.id).strokes).toEqual(draft.strokes);
});
it('galleryRejectsUnknownIdAndInvalidVariation', () => {
  expect(() => getGalleryDrawing('missing')).toThrow(/Unknown gallery/);
  for (const variation of [-1, 0.5, NaN, Infinity])
    expect(() => getGalleryDrawing('bird', variation)).toThrow(/Variation/);
});
it('galleryReturnsIndependentDrafts', () => {
  expect(getGalleryDrawing('fish').strokes[0]).not.toBe(getGalleryDrawing('fish').strokes[0]);
});
it('galleryFlowerHasEightPetalTipsAndButterflyHasMirroredWings', () => {
  const flower = getGalleryDrawing('flower').strokes[0];
  let petals = 0;
  // Ignore translation by comparing radial distance from the corolla center.
  const centerY = (Math.max(...flower.map((p) => p[1])) + Math.min(...flower.map((p) => p[1]))) / 2;
  const radius = flower.slice(0, -1).map((p) => Math.hypot(p[0], p[1] - centerY));
  for (let i = 0; i < radius.length; i++)
    if (
      radius[i] > radius[(i + radius.length - 1) % radius.length] &&
      radius[i] > radius[(i + 1) % radius.length]
    )
      petals++;
  expect(petals).toBe(8);
  const butterfly = getGalleryDrawing('butterfly').strokes;
  expect(butterfly[1].map(([x, y]) => [-x || 0, y])).toEqual(butterfly[4]);
});
