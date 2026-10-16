import 'fake-indexeddb/auto';
import { it, expect, vi, afterEach } from 'vitest';
import { openDB } from 'idb';
afterEach(() => vi.restoreAllMocks());
import { ProjectRepository } from './project-repository';
type OpenDatabase = NonNullable<ConstructorParameters<typeof ProjectRepository>[0]>;
import { createProject } from '../../domain/projects/project-schema';
it('saveClearsDraftAndReloadKeepsGeometry', async () => {
  const repo = new ProjectRepository(),
    p = createProject(2, {
      kind: 'curve2d',
      points: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      closure: 'return',
    });
  await repo.draft(p);
  expect((await repo.drafts()).some((x) => x.id === p.id)).toBe(true);
  await repo.save(p);
  expect((await repo.drafts()).some((x) => x.id === p.id)).toBe(false);
  await repo.close();
  expect(await repo.get(p.id)).toEqual(p);
  await repo.remove(p.id);
  expect(await repo.get(p.id)).toBeUndefined();
  await repo.close();
});

it('failedDatabaseOpenCanRetryWithoutPoisoningTheRepository', async () => {
  const opening = vi
    .fn<OpenDatabase>(openDB)
    .mockRejectedValueOnce(new Error('Storage temporarily unavailable'));
  const repo = new ProjectRepository(opening);
  await expect(repo.list()).rejects.toThrow('Storage temporarily unavailable');
  await expect(repo.list()).resolves.toEqual([]);
  expect(opening).toHaveBeenCalledTimes(2);
  await repo.close();
});

it('closeDuringFailedOpenReleasesOnlyItsOwnPendingConnection', async () => {
  let rejectOpening!: (reason: Error) => void;
  const opening = vi.fn<OpenDatabase>(openDB).mockImplementationOnce(
    () =>
      new Promise<Awaited<ReturnType<OpenDatabase>>>((_, reject) => {
        rejectOpening = reject;
      }),
  );
  const repo = new ProjectRepository(opening);
  const listing = repo.list();
  const failure = expect(listing).rejects.toThrow('Opening failed');
  const closing = repo.close();
  await expect(repo.list()).resolves.toEqual([]);
  rejectOpening(new Error('Opening failed'));
  await failure;
  await expect(closing).resolves.toBeUndefined();
  await expect(repo.list()).resolves.toEqual([]);
  expect(opening).toHaveBeenCalledTimes(2);
  await repo.close();
});
