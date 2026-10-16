import { expect, it } from 'vitest';
import { createProject } from './project-schema';
import { needsRecovery } from './recovery';
const saved = createProject(2, {
  kind: 'curve2d',
  points: [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  closure: 'return',
});
saved.updatedAt = '2026-10-15T00:00:00.000Z';
it('offersUnsavedDocumentsAndNewerActualChanges', () => {
  expect(needsRecovery(saved, undefined)).toBe(true);
  expect(
    needsRecovery({ ...saved, name: 'Editado', updatedAt: '2026-10-16T00:00:00.000Z' }, saved),
  ).toBe(true);
});
it('doesNotOfferTimestampOnlyCopiesOrVersionsOlderThanSaved', () => {
  expect(needsRecovery({ ...saved, updatedAt: '2026-10-16T00:00:00.000Z' }, saved)).toBe(false);
  expect(
    needsRecovery({ ...saved, name: 'Antiguo', updatedAt: '2026-10-14T00:00:00.000Z' }, saved),
  ).toBe(false);
  expect(needsRecovery(saved, saved)).toBe(false);
});
