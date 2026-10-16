import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StudioStore } from './studio-store';
import { WorkerClient } from '../../infrastructure/compute/worker-client';
import { createCaptureScene, defaultCapture } from './capture-scene';
import { parseProject, migrateProject, createProject } from '../../domain/projects/project-schema';
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
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

it('presetSelectionSurvivesImportAndClearsAfterGeometryEdit', async () => {
  const store = new StudioStore();
  vi.spyOn(store, 'analyze').mockResolvedValue();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  expect(store.selectedPreset()).toBe('heart');
  store.setPreset('star');
  const saved = parseProject(JSON.stringify(store.snapshot()));
  await store.load(saved);
  expect(store.selectedPreset()).toBe('star');
  store.edit((p) => {
    if (p.source.kind === 'curve2d') p.source.points[0][0] += 0.1;
  }, false);
  expect(store.selectedPreset()).toBe('');
  store.undo();
  expect(store.selectedPreset()).toBe('star');
  for (const dimension of [2, 3] as const) {
    await store.init(dimension);
    const ids =
      dimension === 2 ? ['rose', 'ellipse', 'lissajous'] : ['coplanar', 'perpendicular', 'five'];
    for (const id of ids) {
      store.manualPreset(id);
      await store.load(parseProject(JSON.stringify(store.snapshot())));
      expect(store.selectedManualPreset()).toBe(id);
      expect(store.selectedPreset()).toBe('');
    }
  }
  store.dispose();
});

it('changingTermCountDoesNotSetGlobalBusyOrPausePlayback', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  await store.init(2);
  store.togglePlay();
  const selecting = store.select();
  expect(store.busy()).toBe(false);
  expect(store.selecting()).toBe(true);
  expect(store.playing()).toBe(true);
  await selecting;
  expect(store.selecting()).toBe(false);
  store.dispose();
});

it('doesNotSampleAnOldSpectrumWhileSourceAnalysisIsBusy', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  await store.init(2);
  store.busy.set(true);
  const operation = store.select();
  expect(store.selecting()).toBe(false);
  await operation;
  expect(store.busy()).toBe(true);
  store.dispose();
});

it('failedCreatedCurveRestoresPreviousDocumentGeometryAndDirtyState', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  vi.spyOn(store.repository, 'draft').mockResolvedValue();
  await store.init(2);
  store.edit((project) => {
    project.name = 'Mi creación anterior';
  }, false);
  const previous = store.snapshot();
  const reconstruction = store.reconstruction;
  const reference = store.reference;
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        throw new Error('Worker no disponible');
      }
    },
  );
  const next = createProject(
    2,
    {
      kind: 'curve2d',
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      closure: 'return',
    },
    'Nuevo',
  );
  expect(await store.load(next, { recommend: true })).toBe(false);
  expect(store.project()).toEqual(previous);
  expect(store.reconstruction).toBe(reconstruction);
  expect(store.reference).toBe(reference);
  expect(store.dirty()).toBe(true);
  expect(store.playing()).toBe(false);
  expect(store.notice()).toContain('Worker no disponible');
  store.dispose();
});

it('createdCurveUsesRecommendedDetailAndIsUnsavedAfterSuccessfulLoad', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'draft').mockResolvedValue();
  const next = createProject(
    2,
    {
      kind: 'curve2d',
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      closure: 'return',
    },
    'Texto',
  );
  expect(await store.load(next, { recommend: true })).toBe(true);
  expect(store.project().id).toBe(next.id);
  expect(store.reconstruction).not.toBeNull();
  expect(store.project().analysis.count).toBe(store.recommendedCount());
  expect(store.dirty()).toBe(true);
  store.dispose();
});

it('supersededLoadCannotReportSuccessOrRestoreOverTheLatestLoadOfSameId', async () => {
  const store = new StudioStore();
  let release!: () => void;
  vi.spyOn(store, 'analyze')
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockImplementationOnce(async () => {
      store.reconstruction = {
        dimension: 2,
        count: 3,
        coordinates: new Float64Array([0, 0, 1, 0, 1, 1]),
      };
    });
  const project = createProject(2, {
    kind: 'curve2d',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    closure: 'return',
  });
  const first = store.load(project);
  expect(await store.load(project)).toBe(true);
  const reconstruction = store.reconstruction;
  release();
  expect(await first).toBe(false);
  expect(store.project().id).toBe(project.id);
  expect(store.reconstruction).toBe(reconstruction);
  store.dispose();
});

it('recoveredDraftRemainsUnsavedUntilExplicitSave', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'save').mockResolvedValue();
  const draft = store.snapshot();
  draft.name = 'Recuperado';
  store.recovery.set(draft);
  expect(await store.load(draft, { unsaved: true })).toBe(true);
  expect(store.dirty()).toBe(true);
  expect(store.project().name).toBe('Recuperado');
  await store.save();
  expect(store.dirty()).toBe(false);
  expect(store.recovery()).toBeNull();
  store.dispose();
});

it('failedSourceCalculationClearsStaleGeometryAndRetryRestoresIt', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  vi.spyOn(store.repository, 'draft').mockResolvedValue();
  await store.init(2);
  expect(store.reconstruction).not.toBeNull();
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        throw new Error('Worker offline');
      }
    },
  );
  store.edit((project) => {
    if (project.source.kind === 'curve2d') project.source.points[0] = [0.1, 0.2];
  });
  await vi.waitFor(() => expect(store.busy()).toBe(false));
  expect(store.reconstruction).toBeNull();
  expect(store.reference).toBeNull();
  expect(store.analysis).toBeNull();
  expect(store.terms).toEqual([]);
  expect(store.harmonics).toEqual([]);
  expect(store.notice()).toContain('Worker offline');
  store.togglePlay();
  expect(store.playing()).toBe(false);
  vi.stubGlobal('Worker', undefined);
  await store.analyze();
  expect(store.reconstruction).not.toBeNull();
  store.dispose();
});

it('importedCopyQueuesRecoveryOnlyAfterSuccessfulCalculation', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  const draft = vi.spyOn(store.repository, 'draft').mockResolvedValue();
  const source = createProject(2, {
    kind: 'manual2d',
    offset: [0, 0],
    circles: [{ id: crypto.randomUUID(), frequency: 1, radius: 1, phase: 0 }],
  });
  expect(await store.load(source, { asCopy: true })).toBe(true);
  expect(draft).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(draft).toHaveBeenCalledExactlyOnceWith(store.snapshot());
  expect(store.project().id).not.toBe(source.id);
  store.dispose();
  vi.useRealTimers();
});

it('failedSelectionClearsStaleGeometryAndCanRecalculate', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  await store.init(2);
  const sampling = vi
    .spyOn(WorkerClient.prototype, 'sample2D')
    .mockRejectedValueOnce(new Error('Sampling offline'));
  await store.select();
  expect(store.reconstruction).toBeNull();
  expect(store.reference).toBeNull();
  expect(store.analysis).toBeNull();
  expect(store.terms).toEqual([]);
  expect(store.selecting()).toBe(false);
  expect(store.notice()).toContain('Sampling offline');
  sampling.mockRestore();
  await store.analyze();
  expect(store.reconstruction).not.toBeNull();
  store.dispose();
});

it('failedImportedSamplingRestoresPreviousDocumentAndGeometry', async () => {
  vi.stubGlobal('Worker', undefined);
  const store = new StudioStore();
  vi.spyOn(store.repository, 'drafts').mockResolvedValue([]);
  await store.init(2);
  const previous = store.snapshot();
  const geometry = store.reconstruction;
  const analysis = store.analysis;
  const sampling = vi
    .spyOn(WorkerClient.prototype, 'sample2D')
    .mockRejectedValueOnce(new Error('Sampling offline'));
  const next = createProject(2, {
    kind: 'curve2d',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    closure: 'return',
  });
  expect(await store.load(next, { asCopy: true })).toBe(false);
  expect(store.project()).toEqual(previous);
  expect(store.reconstruction).toBe(geometry);
  expect(store.analysis).toBe(analysis);
  expect(store.dirty()).toBe(false);
  expect(store.notice()).toContain('Sampling offline');
  sampling.mockRestore();
  store.dispose();
});

it('captureWithoutCalculatedGeometryRejectsInsteadOfExportingStaleContent', async () => {
  const store = new StudioStore();
  await expect(createCaptureScene(store, null, null, defaultCapture())).rejects.toThrow(
    'No hay una curva calculada',
  );
  expect(store.reconstruction).toBeNull();
  store.dispose();
});
