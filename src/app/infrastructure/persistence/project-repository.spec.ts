import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { ProjectRepository } from './project-repository';
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
