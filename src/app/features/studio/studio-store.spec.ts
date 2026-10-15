import { it, expect, vi } from 'vitest';
import { StudioStore } from './studio-store';
import { parseProject, migrateProject, createProject } from '../../domain/projects/project-schema';
it('rejectsDegenerateImportBeforeReplacement', () => {
  const store = new StudioStore(),
    p = store.snapshot();
  expect(() =>
    parseProject(
      JSON.stringify({
        ...p,
        source: {
          kind: 'curve2d',
          points: [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          closure: 'segment',
        },
      }),
    ),
  ).toThrow();
  expect(store.project()).toEqual(p);
  store.dispose();
});
it('saveCannotOverwriteConcurrentEdit', async () => {
  const store = new StudioStore();
  let release!: () => void;
  vi.spyOn(store.repository, 'save').mockImplementation(
    () => new Promise<void>((r) => (release = r)),
  );
  vi.spyOn(store.repository, 'draft').mockResolvedValue();
  const saving = store.save();
  store.edit((p) => (p.name = 'Nueva edición'), false);
  release();
  await saving;
  expect(store.project().name).toBe('Nueva edición');
  expect(store.dirty()).toBe(true);
  store.dispose();
});
it('dimensionRoundTripRetainsDocument', async () => {
  const store = new StudioStore();
  vi.spyOn(store, 'analyze').mockResolvedValue();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  store.edit((p) => (p.name = 'Mi curva'), false);
  await store.init(3);
  await store.init(2);
  expect(store.project().name).toBe('Mi curva');
  expect(store.dirty()).toBe(true);
  store.dispose();
});
it('migratesRealV1WithMissingSpatialFields', () => {
  const p = createProject(2, {
    kind: 'manual2d',
    offset: [0.25, 0],
    circles: [{ id: crypto.randomUUID(), frequency: 1, radius: 0.5, phase: 0.25 }],
  });
  const { sculpture, tubeRadius, representation, ...appearance } = p.appearance;
  void sculpture;
  void tubeRadius;
  void representation;
  const old = { ...p, schemaVersion: 1, appearance, view: { zoom: 2, center: [0.25, -0.4] } };
  const migrated = migrateProject(old);
  expect(migrated.source).toEqual(p.source);
  expect(migrated.view.center).toEqual([0.25, -0.4, 0]);
  expect(migrated.appearance.sculpture).toBe(false);
});

it('failedSaveKeepsSourceAndExportableSnapshot', async () => {
  const store = new StudioStore();
  vi.spyOn(store.repository, 'save').mockRejectedValue(new Error('QuotaExceededError'));
  store.edit((p) => (p.name = 'Sin cuota'), false);
  const before = store.snapshot();
  await store.save();
  expect(store.project().source).toEqual(before.source);
  expect(store.project().name).toBe('Sin cuota');
  expect(store.dirty()).toBe(true);
  expect(store.notice()).toContain('Descarga JSON');
  store.dispose();
});
it('workerFallbackIsVisibleAndBounded', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  await store.init(2);
  expect(store.project().analysis.sampleCount).toBe(256);
  expect(store.notice()).toContain('256 muestras');
  expect(store.analysis?.sampleCount).toBe(256);
  store.dispose();
  vi.unstubAllGlobals();
});

it('cameraAndPlaybackDoNotReplaceGeometryUndo', () => {
  const store = new StudioStore();
  vi.spyOn(store, 'analyze').mockResolvedValue();
  vi.spyOn(store.repository, 'draft').mockResolvedValue();
  store.manual();
  store.editCircle(0, 'radius', 0.8);
  store.edit((p) => (p.view.camera = 'xy'), false);
  store.clock.setSpeed(2);
  store.edit((p) => (p.playback.speed = 2), false);
  store.undo();
  const source = store.project().source;
  expect(source.kind).toBe('manual2d');
  if (source.kind === 'manual2d') expect(source.circles[0].radius).toBe(0.7);
  expect(store.project().view.camera).toBe('xy');
  expect(store.clock.speed).toBe(2);
  store.dispose();
});
