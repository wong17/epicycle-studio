import { Injectable, computed, signal } from '@angular/core';
import {
  Project,
  Source,
  createProject,
  projectSchema,
} from '../../domain/projects/project-schema';
import {
  Circle2,
  Circle3,
  CurveSamples,
  FourierAnalysis,
  Point,
  Vec2,
  Vec3,
} from '../../domain/model';
import { prepareCurve } from '../../domain/curves/prepare-curve';
import { getPreset } from '../../domain/curves/presets';
import { getManualPreset } from '../../domain/curves/manual-presets';
import { explainError } from '../../domain/errors';
import {
  evaluate2D,
  evaluate3D,
  evaluateManual3D,
  select2DTerms,
  select3DHarmonics,
  sampleCurve,
  measureError,
  restoreSampleFrame,
  planeBasis,
} from '../../domain/fourier/math';
import { WorkerClient } from '../../infrastructure/compute/worker-client';
import { ProjectRepository } from '../../infrastructure/persistence/project-repository';
import { PlaybackClock } from './playback-clock';
import { History } from './history';
@Injectable({ providedIn: 'root' })
export class StudioStore {
  // Workspace preferences belong to the session, not to either curve document.
  readonly inspectorOpen = signal(
    typeof window === 'undefined' || !window.matchMedia('(max-width: 700px)').matches,
  );
  readonly mathOpen = signal(false);
  setInspectorOpen(open: boolean): void {
    if (open && typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches)
      this.mathOpen.set(false);
    this.inspectorOpen.set(open);
  }
  setMathOpen(open: boolean): void {
    if (open && typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches)
      this.inspectorOpen.set(false);
    this.mathOpen.set(open);
  }
  readonly project = signal<Project>(
    createProject(
      2,
      {
        kind: 'curve2d',
        points: getPreset('heart', 2).map((p) => [p[0], p[1]]),
        closure: 'segment',
      },
      'Corazón armónico',
    ),
  );
  readonly selectedPreset = computed(() => {
    const { dimension, source } = this.project();
    if (source.kind !== 'curve2d' && source.kind !== 'curve3d') return '';
    const ids =
      dimension === 2
        ? ['circle', 'ellipse', 'star', 'heart', 'flower']
        : ['cinquefoil', 'trefoil', 'lissajous', 'tilted'];
    return (
      ids.find((id) => {
        let points = getPreset(id, dimension);
        if (dimension === 3) points = points.filter((_, i) => i % 2 === 0);
        return (
          source.closure === 'segment' &&
          (source.kind !== 'curve3d' || source.interpolation === 'centripetal') &&
          JSON.stringify(source.points) ===
            JSON.stringify(
              points.map((p) => (dimension === 2 ? [p[0], p[1]] : [p[0], p[1], p[2] ?? 0])),
            )
        );
      }) ?? ''
    );
  });
  readonly selectedManualPreset = computed(() => {
    const { dimension, source } = this.project();
    if (source.kind !== 'manual2d' && source.kind !== 'manual3d') return '';
    const serialize = (value: Source) =>
      JSON.stringify(value, (key, item) => (key === 'id' ? undefined : item));
    return (
      (dimension === 2
        ? ['rose', 'ellipse', 'lissajous']
        : ['coplanar', 'perpendicular', 'five']
      ).find((id) => serialize(source) === serialize(getManualPreset(dimension, id))) ?? ''
    );
  });
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly revision = signal(0);
  readonly phase = signal(0);
  readonly playing = signal(false);
  readonly library = signal<Project[]>([]);
  readonly recovery = signal<Project | null>(null);
  readonly clock = new PlaybackClock();
  readonly repository = new ProjectRepository();
  readonly history = new History<Project>();
  analysis: FourierAnalysis | null = null;
  reference: CurveSamples | null = null;
  reconstruction: CurveSamples | null = null;
  terms: Circle2[] = [];
  circles3: Circle3[] = [];
  harmonics: import('../../domain/model').Harmonic3[] = [];
  offset: Point = [0, 0];
  error = { rms: 0, max: 0 };
  sourceScale = 1;
  private client = new WorkerClient();
  private generation = 0;
  private selectionGeneration = 0;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private grouping = false;
  private groupPushed = false;
  beginEditGroup(): void {
    this.grouping = true;
    this.groupPushed = false;
  }
  endEditGroup(): void {
    this.grouping = false;
    this.groupPushed = false;
  }
  updateView(view: Project['view']): void {
    this.project.update((p) => ({ ...p, view }));
  }
  private sessions = new Map<2 | 3, { project: Project; dirty: boolean }>();
  async init(dimension: 2 | 3): Promise<void> {
    if (this.project().dimension !== dimension) {
      const current = this.snapshot();
      this.sessions.set(current.dimension, {
        project: structuredClone(current),
        dirty: this.dirty(),
      });
      const session = this.sessions.get(dimension);
      const points = getPreset(dimension === 3 ? 'cinquefoil' : 'heart', dimension);
      this.project.set(
        session?.project ??
          createProject(
            dimension,
            dimension === 3
              ? {
                  kind: 'curve3d',
                  points: points.filter((_, i) => i % 2 === 0).map((p) => [p[0], p[1], p[2] ?? 0]),
                  closure: 'segment',
                  interpolation: 'centripetal',
                }
              : { kind: 'curve2d', points: points.map((p) => [p[0], p[1]]), closure: 'segment' },
            dimension === 3 ? 'Nudo de cinco lóbulos' : 'Corazón armónico',
          ),
      );
      if (!session && dimension === 3)
        this.project.update((p) => ({
          ...p,
          appearance: { ...p.appearance, sculpture: true, circles: true, vectors: true },
        }));
      this.history.clear();
      this.dirty.set(session?.dirty ?? false);
      this.clock.setSpeed(this.project().playback.speed);
      this.seek(this.project().playback.phase);
    }
    if (typeof Worker === 'undefined') {
      this.project.update((p) => ({
        ...p,
        analysis: {
          ...p.analysis,
          sampleCount: 256,
          count: Math.min(p.analysis.count, dimension === 2 ? 255 : 128),
        },
      }));
      this.notice.set('Modo limitado: este navegador no admite Worker. Se usan 256 muestras.');
    }
    await this.analyze();
    if (!this.started) {
      this.started = true;
      try {
        const drafts = await this.repository.drafts();
        for (const draft of drafts) {
          const saved = await this.repository.get(draft.id);
          if (!saved || draft.updatedAt > saved.updatedAt) {
            this.recovery.set(draft);
            break;
          }
        }
      } catch {
        this.notice.set('Guardado local no disponible. Puedes descargar tu proyecto.');
      }
    }
  }
  pause(): void {
    this.clock.pause();
    this.playing.set(false);
  }
  togglePlay(): void {
    if (this.playing()) this.pause();
    else {
      this.clock.play();
      this.playing.set(true);
    }
  }
  seek(value: number): void {
    this.clock.seek(value);
    this.phase.set(this.clock.phase);
  }
  snapshot(): Project {
    return { ...this.project(), playback: { phase: this.clock.phase, speed: this.clock.speed } };
  }
  async analyze(): Promise<void> {
    const generation = ++this.generation;
    this.selectionGeneration++;
    this.pause();
    this.busy.set(true);
    const p = this.project(),
      source = p.source;
    try {
      if (source.kind === 'manual2d' || source.kind === 'manual3d') {
        this.client.cancel();
        this.analysis = null;
        this.reference = null;
        this.offset = source.offset;
        this.terms = source.kind === 'manual2d' ? source.circles : [];
        this.circles3 = source.kind === 'manual3d' ? source.circles : [];
        this.harmonics = [];
        this.error = { rms: 0, max: 0 };
        this.reconstruction = sampleCurve(p.dimension, 4096, (t) => this.evaluate(t));
        this.revision.update((x) => x + 1);
        return;
      }
      let points: readonly Point[] = source.points;
      if (source.kind === 'curve3d' && source.interpolation === 'centripetal') {
        const { buildSpatialPolyline } = await import('../spatial/curve-controls');
        points = buildSpatialPolyline(source.points, 'centripetal', source.closed ?? true);
      }
      if (generation !== this.generation) return;
      const prepared = prepareCurve(
          points,
          p.dimension,
          source.closure,
          typeof Worker === 'undefined' ? 256 : p.analysis.sampleCount,
        ),
        result = await this.client.analyze(prepared);
      if (result.status === 'cancelled' || generation !== this.generation) return;
      this.analysis = result.value;
      this.reference = restoreSampleFrame(prepared);
      this.sourceScale = prepared.sourceScale;
      await this.select();
    } catch (error) {
      if (generation === this.generation) this.notice.set(explainError(error));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async select(): Promise<void> {
    const p = this.project(),
      a = this.analysis;
    if (!a) return;
    const selection = ++this.selectionGeneration,
      sourceGeneration = this.generation;
    this.pause();
    this.busy.set(true);
    try {
      const count = Math.min(
          p.analysis.count,
          a.kind === 'fourier2d' ? a.terms.length : a.harmonics.length,
        ),
        outputCount = Math.max(1024, a.sampleCount * 2),
        result =
          a.kind === 'fourier2d'
            ? await this.client.sample2D(a, count, p.analysis.order, outputCount)
            : await this.client.sample3D(a, count, outputCount);
      if (
        result.status === 'cancelled' ||
        selection !== this.selectionGeneration ||
        sourceGeneration !== this.generation
      )
        return;
      this.offset = a.offset;
      this.terms = a.kind === 'fourier2d' ? select2DTerms(a, count, p.analysis.order) : [];
      this.harmonics = a.kind === 'fourier3d' ? select3DHarmonics(a, count) : [];
      this.circles3 = [];
      this.reconstruction = result.value;
      if (this.reference) {
        const reference = this.reference,
          coordinates = new Float64Array(reference.coordinates.length),
          stride = outputCount / reference.count;
        for (let j = 0; j < reference.count; j++)
          for (let d = 0; d < reference.dimension; d++)
            coordinates[j * reference.dimension + d] =
              result.value.coordinates[j * stride * reference.dimension + d];
        const e = measureError(reference, { ...reference, coordinates });
        this.error = { rms: e.rms * this.sourceScale, max: e.max * this.sourceScale };
      }
      this.revision.update((x) => x + 1);
    } catch (error) {
      if (selection === this.selectionGeneration) this.notice.set(explainError(error));
    } finally {
      if (selection === this.selectionGeneration) this.busy.set(false);
    }
  }
  evaluate(t: number): Point {
    const p = this.project();
    return p.dimension === 2
      ? evaluate2D(this.offset as Vec2, this.terms, t)
      : p.source.kind === 'manual3d'
        ? evaluateManual3D(this.offset as Vec3, this.circles3, t)
        : evaluate3D(this.offset as Vec3, this.harmonics, t);
  }
  edit(mutator: (p: Project) => void, calculate = true): void {
    const previous = this.snapshot(),
      next = structuredClone(previous);
    try {
      mutator(next);
      next.updatedAt = new Date().toISOString();
      projectSchema.parse(next);
      const geometryChanged =
        JSON.stringify(previous.source) !== JSON.stringify(next.source) ||
        JSON.stringify(previous.analysis) !== JSON.stringify(next.analysis);
      if (geometryChanged && (!this.grouping || !this.groupPushed)) {
        this.history.push(previous);
        this.groupPushed = true;
      }
      this.project.set(next);
      this.dirty.set(true);
      this.queueDraft();
      if (calculate) void this.analyze();
      else {
        if (
          previous.analysis.count !== next.analysis.count ||
          previous.analysis.order !== next.analysis.order
        )
          void this.select();
        this.revision.update((x) => x + 1);
      }
    } catch (error) {
      this.notice.set(explainError(error));
    }
  }
  private queueDraft(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    const snapshot = this.snapshot();
    this.draftTimer = setTimeout(() => {
      void this.repository
        .draft(snapshot)
        .catch(() => this.notice.set('Cambios sin guardar. Descarga JSON para conservarlos.'));
    }, 1000);
  }
  async load(p: Project, asCopy = false): Promise<void> {
    projectSchema.parse(p);
    if (this.project().dimension !== p.dimension)
      this.sessions.set(this.project().dimension, {
        project: structuredClone(this.snapshot()),
        dirty: this.dirty(),
      });
    this.pause();
    this.client.cancel();
    this.history.clear();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.project.set(
      asCopy ? { ...p, id: crypto.randomUUID(), name: `${p.name.slice(0, 72)} · copia` } : p,
    );
    this.clock.setSpeed(p.playback.speed);
    this.seek(p.playback.phase);
    this.dirty.set(asCopy);
    this.notice.set('');
    await this.analyze();
  }
  async save(): Promise<void> {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    const original = this.project();
    const p = { ...this.snapshot(), updatedAt: new Date().toISOString() };
    try {
      await this.repository.save(p);
      if (this.project() === original) {
        this.project.set(p);
        this.dirty.set(false);
        this.notice.set('Proyecto guardado en este navegador');
      } else {
        this.queueDraft();
        this.notice.set('Se guardó la versión anterior. Los cambios nuevos siguen sin guardar.');
      }
    } catch {
      this.notice.set('No se pudo guardar. Descarga JSON para conservar tu trabajo.');
    }
  }
  async refreshLibrary(): Promise<void> {
    try {
      this.library.set(await this.repository.list());
    } catch {
      this.notice.set('No se pudo abrir la biblioteca local.');
    }
  }
  undo(): void {
    const current = this.snapshot(),
      p = this.history.undo(current);
    if (p) {
      this.project.set({
        ...current,
        source: p.source,
        analysis: p.analysis,
        updatedAt: new Date().toISOString(),
      });
      this.dirty.set(true);
      this.queueDraft();
      void this.analyze();
    }
  }
  redo(): void {
    const current = this.snapshot(),
      p = this.history.redo(current);
    if (p) {
      this.project.set({
        ...current,
        source: p.source,
        analysis: p.analysis,
        updatedAt: new Date().toISOString(),
      });
      this.dirty.set(true);
      this.queueDraft();
      void this.analyze();
    }
  }
  setPreset(id: string): void {
    const dimension = this.project().dimension,
      points = getPreset(id, dimension);
    this.edit((p) => {
      p.name =
        (
          {
            circle: 'Círculo',
            ellipse: 'Elipse',
            star: 'Estrella',
            heart: 'Corazón armónico',
            flower: 'Flor de cinco pétalos',
            trefoil: 'Nudo trébol',
            cinquefoil: 'Nudo de cinco lóbulos',
            lissajous: 'Lissajous espacial',
            tilted: 'Círculo inclinado',
          } as Record<string, string>
        )[id] ?? id;
      p.source =
        dimension === 2
          ? { kind: 'curve2d', points: points.map((p) => [p[0], p[1]]), closure: 'segment' }
          : {
              kind: 'curve3d',
              points: points.filter((_, i) => i % 2 === 0).map((p) => [p[0], p[1], p[2] ?? 0]),
              interpolation: 'centripetal',
              closure: 'segment',
            };
    });
  }
  setSource(source: Source): void {
    this.edit((p) => {
      p.source = source;
    });
  }
  manualPreset(id: string): void {
    this.edit((p) => {
      p.source = getManualPreset(p.dimension, id);
      p.name = 'Composición · ' + id;
    });
  }
  setCount(count: number): void {
    this.edit((p) => (p.analysis.count = count), false);
  }
  manual(): void {
    const id = () => crypto.randomUUID();
    this.edit((p) => {
      p.name = 'Máquina de dibujar';
      p.source =
        p.dimension === 2
          ? {
              kind: 'manual2d',
              offset: [0, 0],
              circles: [
                { id: id(), frequency: 1, radius: 0.7, phase: 0 },
                { id: id(), frequency: -3, radius: 0.25, phase: 0 },
              ],
            }
          : {
              kind: 'manual3d',
              offset: [0, 0, 0],
              circles: [
                {
                  id: id(),
                  frequency: 1,
                  radius: 0.7,
                  phase: 0,
                  axisU: [1, 0, 0],
                  axisV: [0, 1, 0],
                },
                {
                  id: id(),
                  frequency: 3,
                  radius: 0.3,
                  phase: 0,
                  axisU: [1, 0, 0],
                  axisV: [0, 0, 1],
                },
              ],
            };
    });
  }
  editCircle(index: number, key: 'radius' | 'frequency' | 'phase', value: number): void {
    this.edit((p) => {
      if (p.source.kind === 'manual2d' || p.source.kind === 'manual3d')
        p.source.circles[index][key] = value;
    });
  }
  offsetField(axis: number, value: number): void {
    this.edit((p) => {
      if (p.source.kind === 'manual2d' || p.source.kind === 'manual3d')
        p.source.offset[axis] = value;
    });
  }
  orientCircle(index: number, normal: Vec3): void {
    this.edit((p) => {
      if (p.source.kind === 'manual3d') {
        const basis = planeBasis(normal);
        p.source.circles[index].axisU = [...basis.axisU];
        p.source.circles[index].axisV = [...basis.axisV];
      }
    });
  }
  circleAction(index: number, action: 'add' | 'duplicate' | 'remove' | 'up' | 'down'): void {
    this.edit((p) => {
      if (p.source.kind !== 'manual2d' && p.source.kind !== 'manual3d') return;
      const circles = p.source.circles;
      if (action === 'remove') {
        circles.splice(index, 1);
        return;
      }
      if (action === 'up' || action === 'down') {
        const target = index + (action === 'up' ? -1 : 1);
        if (target >= 0 && target < circles.length)
          [circles[index], circles[target]] = [circles[target], circles[index]];
        return;
      }
      const base =
        action === 'duplicate'
          ? circles[index]
          : { frequency: 2, radius: 0.15, phase: 0, ...planeBasis([0, 1, 0]) };
      if (p.source.kind === 'manual3d') {
        p.source.circles.push({
          ...base,
          id: crypto.randomUUID(),
        } as (typeof p.source.circles)[number]);
      } else {
        const { frequency, radius, phase } = base;
        p.source.circles.push({ id: crypto.randomUUID(), frequency, radius, phase });
      }
    });
  }
  setCirclePlane(index: number, plane: string): void {
    this.edit((p) => {
      if (p.source.kind === 'manual3d') {
        const c = p.source.circles[index];
        if (plane === 'xy') {
          c.axisU = [1, 0, 0];
          c.axisV = [0, 1, 0];
        } else if (plane === 'xz') {
          c.axisU = [1, 0, 0];
          c.axisV = [0, 0, 1];
        } else {
          c.axisU = [0, 1, 0];
          c.axisV = [0, 0, 1];
        }
      }
    });
  }
  dispose(): void {
    this.client.dispose();
    this.clock.dispose();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    void this.repository.close();
  }
}
