import { StudioTooltip } from './studio-tooltip';
import { CreateDrawing } from '../creation/create-drawing';
import type { DrawingDraft } from '../../domain/creation/types';
import { CaptureOptions } from './capture-options';
import { CaptureSettings, captureSize, createCaptureScene, defaultCapture } from './capture-scene';
import { OptionStrip } from './option-strip';
import { StudioIcon } from './studio-icon';
import { MathPanel } from './math-panel';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StudioStore, ProjectLoadOptions } from './studio-store';
import { CanvasRenderer } from '../drawing-2d/canvas-renderer';
import {
  Project,
  parseProject,
  createProject,
  exportProjectV1,
} from '../../domain/projects/project-schema';
import { Vec2, Vec3 } from '../../domain/model';
import { recordCycle, videoMime } from '../../infrastructure/transfer/video-export';
import { explainError } from '../../domain/errors';
import { prepareCurve, resampleClosedPolyline } from '../../domain/curves/prepare-curve';
import { measureError, evaluate2D, evaluateManual3D } from '../../domain/fourier/math';
import {
  download,
  exportSvg,
  encodeShare,
  decodeShare,
  capturePng,
} from '../../infrastructure/transfer/transfer';
@Component({
  selector: 'app-studio-shell',
  host: { '(document:keydown.escape)': 'closeExport()' },
  imports: [
    FormsModule,
    DecimalPipe,
    RouterLink,
    StudioIcon,
    StudioTooltip,
    MathPanel,
    OptionStrip,
    CaptureOptions,
    CreateDrawing,
  ],
  templateUrl: './studio-shell.html',
  styleUrls: ['./studio-shell.scss', './studio-responsive.scss'],
})
export class StudioShell implements AfterViewInit, OnDestroy {
  readonly store = inject(StudioStore);
  readonly inspectorOpen = this.store.inspectorOpen;
  readonly exportOpen = signal(false);
  readonly creationOpen = signal(false);
  readonly creationError = signal('');
  readonly creationSubmitting = signal(false);
  readonly creationMode = signal<'gallery' | 'svg'>('gallery');
  readonly creationSvg = signal('');
  readonly creationName = signal('Ilustración SVG');
  openCreator(): void {
    this.creationError.set('');
    this.creationMode.set('gallery');
    this.creationSvg.set('');
    this.creationOpen.set(true);
  }
  readonly transportOpen = signal(true);
  readonly toolsOpen = signal(true);
  private nameTimer: ReturnType<typeof setTimeout> | null = null;
  private sectionPolicy = '';
  toggleInspector(): void {
    this.store.setInspectorOpen(!this.inspectorOpen());
    if (this.inspectorOpen()) this.configureSections(true);
  }
  private configureSections(force = false): void {
    const spacious = window.innerWidth >= 1200 && window.innerHeight >= 850;
    const policy = spacious ? 'all' : 'first';
    if (!force && policy === this.sectionPolicy) return;
    this.sectionPolicy = policy;
    document.querySelectorAll<HTMLDetailsElement>('.inspector-section').forEach((section, i) => {
      section.open = i === 0 || spacious;
    });
  }
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('projection', { static: true }) projection!: ElementRef<HTMLCanvasElement>;
  readonly contextLost = signal(false);
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('exportTrigger') exportTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('inspectorTrigger') inspectorTrigger?: ElementRef<HTMLButtonElement>;
  collapseInspector(): void {
    this.inspectorOpen.set(false);
    this.inspectorTrigger?.nativeElement.focus();
  }
  closeExport() {
    if (this.modal()) return;
    if (this.exportOpen()) {
      this.exportOpen.set(false);
      this.exportTrigger?.nativeElement.focus();
    }
  }
  @ViewChild('file', { static: true }) file!: ElementRef<HTMLInputElement>;
  readonly dimension = this.route.snapshot.data['dimension'] as 2 | 3;
  readonly tool = signal<'explore' | 'draw' | 'edit' | 'points' | 'pan'>('explore');
  readonly ready = signal(false);
  readonly modal = signal('');
  readonly preview = signal<Project | null>(null);
  readonly pending = signal<readonly Vec2[] | null>(null);
  readonly drawing = signal(false);
  readonly strokeCount = signal(0);
  private strokes: Vec2[][] = [];
  private drawingGeneration = 0;
  private drawingClosure: 'return' | 'segment' = 'return';
  private editDrag: { start: Vec2; original: Vec2[][]; stroke: number; point: number } | null =
    null;
  readonly share = signal('');
  depth = 0;
  pngScale = 1;
  imageCapture = defaultCapture();
  videoCapture = defaultCapture();
  captureMode: 'image' | 'video' = 'image';
  readonly captureBusy = signal(false);
  private captureGeneration = 0;
  @ViewChild('capturePreview', { static: true }) capturePreview!: ElementRef<HTMLCanvasElement>;
  get captureSettings(): CaptureSettings {
    return this.captureMode === 'image' ? this.imageCapture : this.videoCapture;
  }
  get captureDimensions(): string {
    const [w, h] = captureSize(this.captureSettings);
    const scale = this.captureMode === 'image' ? this.pngScale : 1;
    return `${w * scale} × ${h * scale}`;
  }
  toggleExport(): void {
    this.exportOpen.set(!this.exportOpen());
    if (this.exportOpen()) void this.refreshCapture();
  }
  configureCapture(kind: 'image' | 'video', settings?: CaptureSettings): void {
    this.captureMode = kind;
    if (settings) {
      if (kind === 'image') this.imageCapture = settings;
      else this.videoCapture = settings;
    }
    void this.refreshCapture();
  }
  async refreshCapture(): Promise<void> {
    const generation = ++this.captureGeneration;
    this.captureBusy.set(true);
    let scene: Awaited<ReturnType<typeof createCaptureScene>> | null = null;
    try {
      scene = await createCaptureScene(
        this.store,
        this.flat,
        this.contextLost() ? null : this.spatial,
        {
          ...this.captureSettings,
        },
      );
      if (generation !== this.captureGeneration || !this.exportOpen() || this.destroyed) return;
      scene.render(this.store.clock.phase);
      const preview = this.capturePreview.nativeElement;
      preview.width = 640;
      preview.height = Math.round((640 * scene.canvas.height) / scene.canvas.width);
      const ctx = preview.getContext('2d')!;
      ctx.clearRect(0, 0, preview.width, preview.height);
      ctx.drawImage(scene.canvas, 0, 0, preview.width, preview.height);
    } catch (error) {
      if (generation === this.captureGeneration) this.error(error);
    } finally {
      scene?.dispose();
      if (generation === this.captureGeneration) this.captureBusy.set(false);
    }
  }
  liftAmplitude = 0.25;
  liftFrequency = 3;
  liftPhase = 0;
  liftError = { rms: 0, max: 0 };
  private flat: CanvasRenderer | null = null;
  private spatial: import('../spatial/three-renderer').ThreeRenderer | null = null;
  private observer: ResizeObserver | null = null;
  private raf = 0;
  private destroyed = false;
  private pointer: number | null = null;
  private points: Vec2[] = [];
  private lastUi = 0;
  private fitted = false;
  private lastRevision = -1;
  private trigger: HTMLElement | null = null;
  readonly recording = signal(false);
  private recordingAbort: AbortController | null = null;
  get videoAvailable(): boolean {
    return videoMime() !== null && this.ready() && !this.contextLost();
  }
  get visibleOrbits(): number {
    return Math.min(
      this.dimension === 2
        ? this.store.terms.length
        : this.project.source.kind === 'manual3d'
          ? this.store.circles3.length
          : this.store.harmonics.length,
      this.canvas?.nativeElement.clientWidth < 600 ? 48 : this.dimension === 2 ? 128 : 64,
    );
  }
  get project(): Project {
    return this.store.project();
  }
  get manual(): boolean {
    return this.project.source.kind === 'manual2d' || this.project.source.kind === 'manual3d';
  }
  get circles() {
    const s = this.project.source;
    return s.kind === 'manual2d' || s.kind === 'manual3d' ? s.circles : [];
  }
  get manualOffset(): readonly number[] {
    const s = this.project.source;
    return s.kind === 'manual2d' || s.kind === 'manual3d' ? s.offset : [];
  }
  circleNormal(index: number): Vec3 {
    const s = this.project.source;
    if (s.kind !== 'manual3d') return [0, 0, 1];
    const c = s.circles[index],
      u = c.axisU,
      v = c.axisV;
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  }
  orientCircle(index: number, axis: number, value: number): void {
    const normal = [...this.circleNormal(index)] as [number, number, number];
    normal[axis] = value;
    this.store.orientCircle(index, normal);
  }
  selectedPlane(index: number): string {
    const n = this.circleNormal(index);
    return Math.abs(n[2]) > 0.999
      ? 'xy'
      : Math.abs(n[1]) > 0.999
        ? 'xz'
        : Math.abs(n[0]) > 0.999
          ? 'yz'
          : 'custom';
  }
  patchTolerance = (value: number) => (p: Project) => {
    p.appearance.tolerance = value as 0.005 | 0.01 | 0.02;
  };
  patchRadius = (value: number) => (p: Project) => {
    p.appearance.tubeRadius = value;
  };
  get controlPoints() {
    const s = this.project.source;
    return s.kind === 'curve3d' ? s.points : [];
  }
  get interpolation(): string {
    const s = this.project.source;
    return s.kind === 'curve3d' ? s.interpolation : 'polyline';
  }
  get cyclic(): boolean {
    const s = this.project.source;
    return s.kind === 'curve3d' ? (s.closed ?? true) : true;
  }
  get closure(): string {
    const s = this.project.source;
    return s.kind === 'curve3d' || s.kind === 'curve2d' ? s.closure : 'segment';
  }
  patchCyclic = (value: boolean) => (p: Project) => {
    if (p.source.kind === 'curve3d') p.source.closed = value;
  };
  patchClosure = (value: string) => (p: Project) => {
    if (p.source.kind === 'curve3d' || p.source.kind === 'curve2d')
      p.source.closure = value as 'segment' | 'return';
  };
  patchSamples = (value: number) => (p: Project) => {
    p.analysis.sampleCount = value as Project['analysis']['sampleCount'];
    p.analysis.count = Math.min(p.analysis.count, p.dimension === 2 ? value - 1 : value / 2);
  };
  patchOrder = (value: string) => (p: Project) => {
    p.analysis.order = value as Project['analysis']['order'];
  };
  patchRepresentation = (value: string) => (p: Project) => {
    p.appearance.representation = value as Project['appearance']['representation'];
  };
  patchColor = (value: string) => (p: Project) => {
    p.appearance.color = value as Project['appearance']['color'];
  };
  patchPlane = (value: string) => (p: Project) => {
    p.view.plane = value as Project['view']['plane'];
  };
  patchInterpolation = (value: string) => (p: Project) => {
    if (p.source.kind === 'curve3d') p.source.interpolation = value as 'polyline' | 'centripetal';
  };
  async ngAfterViewInit(): Promise<void> {
    await this.store.init(this.dimension);
    if (this.destroyed) return;
    try {
      if (this.dimension === 3) {
        const { ThreeRenderer } = await import('../spatial/three-renderer');
        if (this.destroyed) return;
        this.spatial = new ThreeRenderer(this.canvas.nativeElement, this.store, (index, p) =>
          this.changePoint(index, p),
        );
      } else this.flat = new CanvasRenderer(this.canvas.nativeElement, this.store);
    } catch {
      this.flat = new CanvasRenderer(this.canvas.nativeElement, this.store);
      this.store.notice.set(
        'WebGL no disponible. Proyección XY activa; puedes editar puntos y descargar JSON.',
      );
    }
    const resize = () => {
      this.configureSections();
      if (window.matchMedia('(max-width: 700px)').matches && this.store.mathOpen())
        this.inspectorOpen.set(false);
      const rect = this.canvas.nativeElement.parentElement!.getBoundingClientRect();
      this.flat?.resize(rect.width, rect.height, devicePixelRatio);
      this.spatial?.resize(rect.width, rect.height, devicePixelRatio);
      if (!this.fitted) {
        this.fit();
        this.fitted = true;
      }
    };
    this.observer = new ResizeObserver(resize);
    this.observer.observe(this.canvas.nativeElement.parentElement!);
    resize();
    this.restoreView();
    document.addEventListener('visibilitychange', this.visibility);
    this.canvas.nativeElement.addEventListener('webglcontextlost', this.lost);
    this.canvas.nativeElement.addEventListener('webglcontextrestored', this.restored);
    this.ready.set(true);
    this.animate(0);
    if (location.hash.startsWith('#p=')) {
      try {
        this.preview.set(decodeShare(location.hash.slice(3)));
        this.open('import');
      } catch (error) {
        this.error(error);
      }
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  private animate = (now: number): void => {
    if (this.destroyed) return;
    const phase = this.store.clock.tick(now);
    if (this.store.revision() !== this.lastRevision) {
      this.lastRevision = this.store.revision();
      if (!this.fitted) {
        this.fit();
        this.fitted = true;
      }
    }
    this.flat?.render(phase);
    if (!this.contextLost()) this.spatial?.render(phase);
    if (this.spatial) {
      const stats = this.spatial.stats;
      this.canvas.nativeElement.dataset['geometries'] = String(stats.geometries);
      this.canvas.nativeElement.dataset['drawCalls'] = String(stats.drawCalls);
      this.canvas.nativeElement.dataset['rebuilds'] = String(stats.rebuilds);
      this.canvas.nativeElement.dataset['liveRenderers'] = String(stats.live);
    }
    if (now - this.lastUi >= 100) {
      this.store.phase.set(phase);
      this.lastUi = now;
    }
    this.raf = requestAnimationFrame(this.animate);
  };
  private visibility = (): void => {
    if (document.hidden) {
      this.store.pause();
      this.recordingAbort?.abort();
    }
  };
  private lost = (event: Event): void => {
    event.preventDefault();
    this.store.pause();
    cancelAnimationFrame(this.raf);
    this.contextLost.set(true);
    this.flat = new CanvasRenderer(this.projection.nativeElement, this.store);
    const rect = this.canvas.nativeElement.parentElement!.getBoundingClientRect();
    this.flat.resize(rect.width, rect.height, devicePixelRatio);
    this.flat.fit();
    this.animate(performance.now());
    this.store.notice.set(
      'Se perdió el contexto gráfico. Proyección plana activa; tu proyecto sigue editable y puedes descargar JSON.',
    );
  };
  private restored = (): void => {
    cancelAnimationFrame(this.raf);
    this.contextLost.set(false);
    this.flat?.dispose();
    this.flat = null;
    this.spatial?.rebuild();
    this.animate(performance.now());
    this.store.notice.set('Contexto gráfico recuperado. Reproducción pausada.');
  };
  fit(): void {
    this.flat?.fit();
    this.spatial?.fit();
  }
  captureView(): void {
    if (this.project.dimension !== this.dimension || this.store.busy()) return;
    const view = structuredClone(this.project.view);
    if (this.flat) {
      view.zoom = this.flat.viewport.zoom;
      view.center = [...this.flat.viewport.center, 0];
      view.scale = this.flat.viewport.scale;
    }
    if (this.spatial) {
      const p = this.spatial.camera.position,
        t = this.spatial.controls.target;
      view.position = [p.x, p.y, p.z];
      view.target = [t.x, t.y, t.z];
      view.zoom = this.spatial.camera.zoom;
    }
    this.store.updateView(view);
  }
  private restoreView(): void {
    this.fitted = true;
    const v = this.project.view;
    if (this.flat && v.scale) {
      this.flat.viewport.scale = v.scale;
      this.flat.viewport.zoom = v.zoom;
      this.flat.viewport.center = [v.center[0], v.center[1]];
      this.flat.invalidate();
    }
    if (this.spatial && v.position && v.target) {
      this.spatial.camera.position.set(...v.position);
      this.spatial.camera.zoom = v.zoom;
      this.spatial.camera.updateProjectionMatrix();
      this.spatial.controls.target.set(...v.target);
      this.spatial.controls.update();
    }
  }
  async save(): Promise<void> {
    if (this.drawing() && !this.pending()) this.cancelDrawing();
    if (this.drawing() && !(await this.finishDrawing())) return;
    this.captureView();
    await this.store.save();
  }
  zoom(factor: number): void {
    if (this.flat) {
      this.flat.viewport.zoom = Math.min(10, Math.max(0.1, this.flat.viewport.zoom / factor));
      this.flat.invalidate();
    }
    this.spatial?.zoom(factor);
  }
  rotate(): void {
    this.spatial?.rotate();
  }
  camera(value: string): void {
    this.store.edit((p) => (p.view.camera = value as Project['view']['camera']), false);
    this.spatial?.setCamera(value);
    this.flat?.fit();
  }
  chooseTool(value: 'explore' | 'draw' | 'edit' | 'points' | 'pan'): void {
    if (value === 'draw' && !this.drawing()) this.clearDrawing();
    this.tool.set(value);
    if (this.flat) this.flat.editHandles = value === 'edit';
    if (value === 'draw' || value === 'points') this.store.pause();
    if (this.spatial) {
      this.spatial.edit = value === 'points';
      this.spatial.depth = this.depth;
      this.spatial.rebuild();
    }
  }
  pointerDown(event: PointerEvent): void {
    if (
      !this.flat ||
      event.button !== 0 ||
      this.dimension !== 2 ||
      this.store.busy() ||
      this.pointer !== null ||
      !(this.tool() === 'draw' || this.tool() === 'pan' || this.tool() === 'edit')
    )
      return;
    if (this.tool() === 'edit') {
      const rect = this.canvas.nativeElement.getBoundingClientRect();
      const screen: Vec2 = [event.clientX - rect.left, event.clientY - rect.top];
      let nearest = 16,
        target: { stroke: number; point: number } | null = null;
      this.strokes.forEach((stroke, si) =>
        stroke.forEach((point, pi) => {
          const xy = this.flat!.viewport.worldToScreen(point);
          const distance = Math.hypot(xy[0] - screen[0], xy[1] - screen[1]);
          if (distance < nearest) {
            nearest = distance;
            target = { stroke: si, point: pi };
          }
        }),
      );
      if (!target) return;
      this.editDrag = {
        start: this.flat.viewport.screenToWorld(screen),
        original: structuredClone(this.strokes),
        ...(target as { stroke: number; point: number }),
      };
    }
    this.pointer = event.pointerId;
    this.points = [];
    this.canvas.nativeElement.setPointerCapture(event.pointerId);
    if (this.tool() === 'draw') this.addPoint(event);
  }
  pointerMove(event: PointerEvent): void {
    if (this.pointer !== event.pointerId) return;
    if (this.tool() === 'edit' && this.flat && this.editDrag) {
      const rect = this.canvas.nativeElement.getBoundingClientRect();
      const next = this.flat.viewport.screenToWorld([
        event.clientX - rect.left,
        event.clientY - rect.top,
      ]);
      const drag = this.editDrag;
      this.strokes[drag.stroke] = drag.original[drag.stroke].map((p, index) => {
        const weight = Math.exp(-Math.pow((index - drag.point) / 8, 2));
        return [
          p[0] + (next[0] - drag.start[0]) * weight,
          p[1] + (next[1] - drag.start[1]) * weight,
        ];
      });
      this.flat.previewStrokes = this.strokes;
    } else if (this.tool() === 'pan' && this.flat) {
      const center = this.flat.viewport.center,
        scale = this.flat.viewport.scale * this.flat.viewport.zoom;
      this.flat.viewport.center = [
        center[0] - event.movementX / scale,
        center[1] + event.movementY / scale,
      ];
      this.flat.invalidate();
    } else this.addPoint(event);
  }
  private addPoint(event: PointerEvent): void {
    if (!this.flat) return;
    const rect = this.canvas.nativeElement.getBoundingClientRect(),
      screen: Vec2 = [event.clientX - rect.left, event.clientY - rect.top],
      point = this.flat.viewport.screenToWorld(screen),
      last = this.points.at(-1);
    if (last) {
      const previous = this.flat.viewport.worldToScreen(last);
      if (Math.hypot(previous[0] - screen[0], previous[1] - screen[1]) < 1.5) return;
    }
    if ((this.pending()?.length ?? 0) + this.points.length >= 10000) {
      this.store.notice.set('Límite de 10 000 puntos alcanzado. Confirma el trazo.');
      this.pointerUp(event);
      return;
    }
    this.points.push(point);
    this.flat.previewStrokes = [...this.strokes, this.points];
  }
  pointerUp(event: PointerEvent): void {
    if (this.pointer !== event.pointerId) return;
    this.pointer = null;
    this.canvas.nativeElement.releasePointerCapture(event.pointerId);
    if (this.tool() === 'edit') {
      this.editDrag = null;
      this.updateDrawing();
    } else if (this.tool() === 'draw') {
      if (this.points.length >= 3) this.strokes.push(this.points);
      else this.store.notice.set('Haz un trazo un poco más largo. Puedes seguir dibujando.');
      this.points = [];
      this.updateDrawing();
    }
  }
  private updateDrawing(): void {
    this.strokeCount.set(this.strokes.length);
    this.pending.set(this.strokes.length ? this.strokes.flat() : null);
    if (this.flat) this.flat.previewStrokes = this.strokes;
  }
  interruptStroke(): void {
    if (this.editDrag) {
      this.strokes = this.editDrag.original;
      this.editDrag = null;
    }
    if (this.pointer !== null && this.canvas.nativeElement.hasPointerCapture(this.pointer))
      this.canvas.nativeElement.releasePointerCapture(this.pointer);
    this.pointer = null;
    this.points = [];
    this.updateDrawing();
  }
  clearDrawing(): void {
    this.drawingGeneration++;
    this.interruptStroke();
    this.drawingClosure = 'return';
    this.store.pause();
    this.exportOpen.set(false);
    this.strokes = [];
    this.points = [];
    this.pending.set(null);
    this.strokeCount.set(0);
    this.drawing.set(true);
    this.tool.set('draw');
    if (this.dimension === 2 && window.innerWidth <= 700) this.store.setInspectorOpen(false);
    if (this.flat) {
      this.flat.drawing = true;
      this.flat.editHandles = false;
      this.flat.previewStrokes = [];
      this.flat.invalidate();
    }
  }
  cancelDrawing(): void {
    this.drawingGeneration++;
    this.interruptStroke();
    this.strokes = [];
    this.pending.set(null);
    this.strokeCount.set(0);
    this.drawing.set(false);
    if (this.flat) {
      this.flat.drawing = false;
      this.flat.editHandles = false;
      this.flat.previewStrokes = [];
      this.flat.invalidate();
    }
    this.tool.set('explore');
  }
  editDrawing(): void {
    if (this.drawing() && this.pending() && !this.store.busy()) {
      this.interruptStroke();
      this.tool.set('edit');
      if (this.flat) this.flat.editHandles = true;
      return;
    }
    const source = this.project.source;
    if (source.kind !== 'curve2d' || this.store.busy()) return;
    const points = structuredClone(source.points);
    const starts = source.strokeStarts ?? [0];
    this.clearDrawing();
    this.drawingClosure = source.closure;
    this.strokes = starts.map((start, i) => points.slice(start, starts[i + 1] ?? points.length));
    this.updateDrawing();
    this.tool.set('edit');
    if (this.flat) this.flat.editHandles = true;
  }
  async finishDrawing(closure: 'segment' | 'return' = this.drawingClosure): Promise<boolean> {
    const points = this.pending();
    if (!points || this.store.busy() || this.pointer !== null) return false;
    const generation = this.drawingGeneration;
    const source = {
      kind: 'curve2d' as const,
      strokeStarts: this.strokes.reduce<number[]>((starts, stroke, index) => {
        starts.push(index ? starts[index - 1] + this.strokes[index - 1].length : 0);
        return starts;
      }, []),
      points: points.map((p) => [...p] as [number, number]),
      closure,
    };
    try {
      prepareCurve(source.points, 2, closure, this.project.analysis.sampleCount);
    } catch (error) {
      this.error(error);
      return false;
    }
    const previous = this.store.reference;
    this.store.edit((p) => {
      p.name = 'Dibujo libre';
      p.source = source;
      p.analysis.sampleCount = typeof Worker === 'undefined' ? 256 : 2048;
    }, false);
    await this.store.analyze(true);
    if (
      generation !== this.drawingGeneration ||
      JSON.stringify(this.project.source) !== JSON.stringify(source) ||
      this.store.reference === previous
    )
      return false;
    this.cancelDrawing();
    this.store.seek(0);
    return true;
  }
  async confirmDrawing(closure: 'segment' | 'return'): Promise<void> {
    if (await this.finishDrawing(closure)) this.store.togglePlay();
  }
  async togglePlay(): Promise<void> {
    if (this.drawing()) {
      if (!(await this.finishDrawing())) return;
    }
    this.store.togglePlay();
  }
  selectManual(id?: string): void {
    this.cancelDrawing();
    if (id) this.store.manualPreset(id);
    else this.store.manual();
  }
  changePoint(index: number, point: Vec3): void {
    this.store.edit((p) => {
      if (p.source.kind !== 'curve3d') return;
      if (index < 0) p.source.points.push([...point]);
      else p.source.points[index] = [...point];
    });
  }
  pointField(index: number, axis: number, value: number): void {
    const point = [...this.controlPoints[index]] as [number, number, number];
    point[axis] = value;
    this.changePoint(index, point);
  }
  removePoint(index: number): void {
    this.store.edit((p) => {
      if (p.source.kind === 'curve3d') p.source.points.splice(index, 1);
    });
  }
  newSpatial(): void {
    this.store.setSource({
      kind: 'curve3d',
      points: [
        [-0.5, -0.5, 0],
        [0.5, -0.5, 0],
        [0.5, 0.5, 0.4],
        [-0.5, 0.5, 0],
      ],
      closure: 'segment',
      interpolation: 'polyline',
    });
    this.chooseTool('points');
  }
  setDepth(): void {
    if (this.spatial) this.spatial.depth = this.depth;
  }
  rename(value: string): void {
    if (this.nameTimer) clearTimeout(this.nameTimer);
    const name = value.trim().slice(0, 80) || 'Sin nombre';
    if (name !== this.project.name) this.store.edit((p) => (p.name = name), false);
  }
  queueRename(value: string): void {
    if (this.nameTimer) clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => this.rename(value), 700);
  }
  setSpeed(value: number): void {
    try {
      this.store.clock.setSpeed(value);
      this.store.edit((p) => (p.playback.speed = value), false);
    } catch (error) {
      this.error(error);
    }
  }
  setColorMode(value: string): void {
    this.store.edit((p) => {
      p.appearance.colorMode = value === 'spectrum' ? 'spectrum' : 'solid';
    }, false);
  }
  setLayer(
    key: 'original' | 'reconstruction' | 'trace' | 'circles' | 'vectors' | 'grid' | 'sculpture',
    value: boolean,
  ): void {
    this.store.edit((p) => {
      p.appearance[key] = value;
    }, false);
  }
  setPreset(id: string): void {
    this.cancelDrawing();
    this.store.setPreset(id);
    this.fitted = false;
  }
  switchMode(dimension: 2 | 3): void {
    if (dimension === this.dimension) return;
    this.captureView();
    const navigate = async () => {
      if (this.drawing() && !this.pending()) this.cancelDrawing();
      if (this.drawing() && !(await this.finishDrawing())) return;
      if (this.store.dirty()) await this.store.repository.draft(this.store.snapshot());
      await this.router.navigate(['/studio', dimension === 2 ? '2d' : '3d']);
    };
    void navigate().catch(() =>
      this.store.notice.set(
        'No se pudo conservar el borrador. Guarda o descarga antes de cambiar de modo.',
      ),
    );
  }
  open(kind: string): void {
    this.modal.set(kind);
    this.trigger = document.activeElement as HTMLElement;
    this.dialog.nativeElement.showModal();
    if (kind === 'library') void this.store.refreshLibrary();
  }
  close(): void {
    this.dialog.nativeElement.close();
    this.modal.set('');
    this.trigger?.focus();
  }
  async openProject(p: Project, options: ProjectLoadOptions = {}): Promise<boolean> {
    this.cancelDrawing();
    this.captureView();
    this.close();
    if (this.store.dirty())
      try {
        await this.store.repository.draft(this.store.snapshot());
      } catch {
        this.store.notice.set(
          'Descarga el proyecto actual antes de abrir otro: no se pudo conservar el borrador.',
        );
        return false;
      }
    if (!(await this.store.load(p, options))) return false;
    if (p.dimension !== this.dimension)
      await this.router.navigate(['/studio', p.dimension === 2 ? '2d' : '3d']);
    else {
      this.fitted = false;
      this.fit();
      this.restoreView();
    }
    return true;
  }
  async createFrom(draft: DrawingDraft): Promise<void> {
    if (this.creationSubmitting()) return;
    this.creationSubmitting.set(true);
    this.creationError.set('');
    try {
      if (this.drawing() && this.pending() && !(await this.finishDrawing())) {
        this.creationError.set(
          this.store.notice() || 'Termina o cancela el trazo antes de abrir otra creación.',
        );
        return;
      }
      const project = createProject(
        2,
        {
          kind: 'curve2d',
          points: draft.strokes.flatMap((stroke) =>
            stroke.map(([x, y]): [number, number] => [x, y]),
          ),
          closure: draft.closure,
        },
        draft.name.slice(0, 80),
      );
      project.analysis.sampleCount = typeof Worker === 'undefined' ? 256 : 2048;
      if (!(await this.openProject(project, { recommend: true, unsaved: true }))) {
        this.creationError.set(
          this.store.notice() || 'No se pudo abrir la curva. Tu creación anterior se conserva.',
        );
        return;
      }
      this.creationOpen.set(false);
      this.store.seek(0);
      if (!this.store.playing()) this.store.togglePlay();
    } catch (error) {
      this.creationError.set(explainError(error));
    } finally {
      this.creationSubmitting.set(false);
    }
  }
  removeProject(p: Project): void {
    this.preview.set(p);
    this.open('delete');
  }
  async confirmDelete(): Promise<void> {
    const p = this.preview();
    if (!p) return;
    try {
      await this.store.repository.remove(p.id);
      this.close();
      await this.store.refreshLibrary();
    } catch (error) {
      this.error(error);
    }
  }
  exportJson(): void {
    this.captureView();
    download(
      new Blob([JSON.stringify(this.store.snapshot(), null, 2)], { type: 'application/json' }),
      `${this.project.name}.json`,
    );
  }
  exportV1(): void {
    this.captureView();
    download(
      new Blob([JSON.stringify(exportProjectV1(this.store.snapshot()), null, 2)], {
        type: 'application/json',
      }),
      `${this.project.name}-v1.json`,
    );
  }
  async exportSvg(): Promise<void> {
    let scene: Awaited<ReturnType<typeof createCaptureScene>> | null = null;
    try {
      const s = this.store.reconstruction;
      if (!s || this.dimension !== 2) return;
      scene = await createCaptureScene(this.store, this.flat, null, { ...this.imageCapture });
      const renderer = scene.renderer as CanvasRenderer;
      const [w, h] = captureSize(this.imageCapture);
      const start = renderer.viewport.screenToWorld([0, 0]);
      const end = renderer.viewport.screenToWorld([w, h]);
      download(
        new Blob(
          [
            exportSvg(
              s,
              this.project.appearance.color,
              Math.min(6, this.project.appearance.width * this.imageCapture.lineWeight),
              {
                background: this.imageCapture.background,
                grid: this.imageCapture.grid,
                bounds: [start[0], -start[1], end[0] - start[0], start[1] - end[1]],
                pixels: w,
              },
            ),
          ],
          { type: 'image/svg+xml' },
        ),
        `${this.project.name}.svg`,
      );
    } catch (error) {
      this.error(error);
    } finally {
      scene?.dispose();
    }
  }
  async png(): Promise<void> {
    let scene: Awaited<ReturnType<typeof createCaptureScene>> | null = null;
    try {
      scene = await createCaptureScene(
        this.store,
        this.flat,
        this.contextLost() ? null : this.spatial,
        { ...this.imageCapture },
        this.pngScale,
      );
      scene.render(this.store.clock.phase);
      download(await capturePng(scene.canvas), `${this.project.name}.png`);
    } catch (error) {
      this.error(error);
    } finally {
      scene?.dispose();
    }
  }
  async glb(): Promise<void> {
    try {
      if (!this.spatial) throw new Error('GLB requiere WebGL y una curva espacial');
      download(await this.spatial.exportGlb(), `${this.project.name}.glb`);
    } catch (error) {
      this.error(error);
    }
  }
  async copyLink(): Promise<void> {
    this.captureView();
    const encoded = encodeShare(this.store.snapshot());
    if (!encoded) {
      this.store.notice.set(
        'Esta creación es demasiado grande para un enlace. Descarga el proyecto JSON.',
      );
      return;
    }
    const url = `${location.origin}/studio/${this.dimension === 2 ? '2d' : '3d'}#p=${encoded}`;
    this.share.set(url);
    try {
      await navigator.clipboard.writeText(url);
      this.store.notice.set('Enlace copiado');
    } catch {
      this.open('share');
    }
  }
  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1048576) throw new Error('Archivo demasiado grande: máximo 1 MiB');
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml') {
        this.creationMode.set('svg');
        this.creationSvg.set(text);
        this.creationName.set(file.name.replace(/\.svg$/i, ''));
        this.exportOpen.set(false);
        this.creationOpen.set(true);
      } else {
        this.preview.set(parseProject(text));
        this.open('import');
      }
    } catch (error) {
      this.error(error);
    }
    input.value = '';
  }
  lift(): void {
    this.updateLift();
    this.open('lift');
  }
  saveProjection(): void {
    const s = this.store.reconstruction;
    if (!s || s.dimension !== 3) return;
    const plane = this.project.view.camera === 'perspective' ? 'xy' : this.project.view.camera,
      axes = plane === 'xz' ? [0, 2] : plane === 'yz' ? [1, 2] : [0, 1],
      points = Array.from(
        { length: s.count },
        (_, j) =>
          [s.coordinates[j * 3 + axes[0]], s.coordinates[j * 3 + axes[1]]] as [number, number],
      );
    this.preview.set(
      createProject(
        2,
        { kind: 'curve2d', points, closure: 'segment' },
        `${this.project.name.slice(0, 55)} · proyección ${plane.toUpperCase()}`,
      ),
    );
    this.open('import');
  }
  updateLift(): void {
    const s = this.store.reconstruction;
    if (!s || s.dimension !== 2) return;
    if (
      !Number.isFinite(this.liftAmplitude) ||
      this.liftAmplitude < 0 ||
      this.liftAmplitude > 2 ||
      !Number.isInteger(this.liftFrequency) ||
      this.liftFrequency < 1 ||
      this.liftFrequency > 32
    ) {
      this.store.notice.set('Usa amplitud entre 0 y 2 y frecuencia entera entre 1 y 32.');
      return;
    }
    const source = Array.from(
        { length: s.count },
        (_, i) => [s.coordinates[i * 2], s.coordinates[i * 2 + 1]] as const,
      ),
      reduced = resampleClosedPolyline(source, 2, 256),
      planar = Array.from(
        { length: 256 },
        (_, j) => [reduced.coordinates[j * 2], reduced.coordinates[j * 2 + 1]] as const,
      ),
      full = resampleClosedPolyline(source, 2, s.count),
      restored = resampleClosedPolyline(planar, 2, s.count),
      error = measureError(full, restored);
    this.liftError = {
      rms: error.rms * this.store.sourceScale,
      max: error.max * this.store.sourceScale,
    };
    const points = planar.map(
      (p, j) =>
        [
          p[0],
          p[1],
          this.liftAmplitude *
            Math.sin(
              (2 * Math.PI * this.liftFrequency * j) / 256 + (this.liftPhase * Math.PI) / 180,
            ),
        ] as [number, number, number],
    );
    this.preview.set(
      createProject(
        3,
        {
          kind: 'curve3d',
          points,
          closure: 'segment',
          interpolation: 'polyline',
          closed: true,
          provenance: {
            sourceId: this.project.id,
            operation: 'lift2d',
            reductionRms: this.liftError.rms,
            reductionMax: this.liftError.max,
            amplitude: this.liftAmplitude,
            frequency: this.liftFrequency,
            phase: (this.liftPhase * Math.PI) / 180,
          },
        },
        `${this.project.name.slice(0, 60)} · relieve`,
      ),
    );
  }
  previewPolygon(): string {
    const p = this.preview();
    if (!p) return '';
    const source = p.source,
      points =
        source.kind === 'curve2d' || source.kind === 'curve3d'
          ? source.points
          : Array.from({ length: 256 }, (_, j) =>
              source.kind === 'manual2d'
                ? evaluate2D(source.offset, source.circles, j / 256)
                : evaluateManual3D(source.offset, source.circles, j / 256),
            );
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      minX = Math.min(...xs),
      minY = Math.min(...ys),
      width = Math.max(...xs) - minX,
      height = Math.max(...ys) - minY,
      scale = Math.min(260 / Math.max(width, 0.001), 120 / Math.max(height, 0.001));
    return points
      .map(
        (p) =>
          `${150 + (p[0] - minX - width / 2) * scale},${75 - (p[1] - minY - height / 2) * scale}`,
      )
      .join(' ');
  }
  readonly recoveryBusy = signal(false);
  async recover(): Promise<void> {
    const draft = this.store.recovery();
    if (!draft || this.recoveryBusy()) return;
    this.recoveryBusy.set(true);
    try {
      if (await this.openProject(draft, { unsaved: true })) this.store.recovery.set(null);
    } catch (error) {
      this.error(error);
    } finally {
      this.recoveryBusy.set(false);
    }
  }
  async discardRecovery(): Promise<void> {
    const draft = this.store.recovery();
    if (!draft || this.recoveryBusy()) return;
    this.recoveryBusy.set(true);
    try {
      await this.store.repository.discardDraft(draft.id);
      this.store.recovery.set(null);
    } catch (error) {
      this.error(error);
    } finally {
      this.recoveryBusy.set(false);
    }
  }
  private error(error: unknown): void {
    this.store.notice.set(explainError(error));
  }
  async video(): Promise<void> {
    if (!this.videoAvailable || this.store.busy() || this.recording()) return;
    this.recordingAbort = new AbortController();
    const abort = this.recordingAbort;
    this.recording.set(true);
    const p = structuredClone(this.store.snapshot());
    let scene: Awaited<ReturnType<typeof createCaptureScene>> | null = null;
    try {
      scene = await createCaptureScene(
        this.store,
        this.flat,
        this.contextLost() ? null : this.spatial,
        {
          ...this.videoCapture,
          background:
            this.videoCapture.background === 'transparent' ? 'dark' : this.videoCapture.background,
        },
      );
      if (abort.signal.aborted) return;
      const recordingScene = scene;
      const blob = await recordCycle(
        scene.canvas,
        (t) => recordingScene.render(t),
        abort.signal,
        8000 / p.playback.speed,
      );
      download(blob, `${p.name}.${blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
    } catch (error) {
      this.error(error);
    } finally {
      scene?.dispose();
      this.recording.set(false);
      this.recordingAbort = null;
    }
  }
  cancelVideo(): void {
    this.recordingAbort?.abort();
  }
  ngOnDestroy(): void {
    this.captureGeneration++;
    if (this.nameTimer) clearTimeout(this.nameTimer);
    this.captureView();
    this.recordingAbort?.abort();
    this.destroyed = true;
    this.store.pause();
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.flat?.dispose();
    this.spatial?.dispose();
    document.removeEventListener('visibilitychange', this.visibility);
    this.canvas.nativeElement.removeEventListener('webglcontextlost', this.lost);
    this.canvas.nativeElement.removeEventListener('webglcontextrestored', this.restored);
  }
}
