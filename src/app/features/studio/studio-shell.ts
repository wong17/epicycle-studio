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
import { StudioStore } from './studio-store';
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
import { resampleClosedPolyline } from '../../domain/curves/prepare-curve';
import { measureError, evaluate2D, evaluateManual3D } from '../../domain/fourier/math';
import {
  download,
  exportSvg,
  encodeShare,
  decodeShare,
  capturePng,
  inspectSvg,
  sampleSvg,
} from '../../infrastructure/transfer/transfer';
@Component({
  selector: 'app-studio-shell',
  host: { '(document:keydown.escape)': 'closeExport()' },
  imports: [FormsModule, DecimalPipe, RouterLink, StudioIcon, MathPanel, OptionStrip],
  templateUrl: './studio-shell.html',
  styleUrl: './studio-shell.scss',
})
export class StudioShell implements AfterViewInit, OnDestroy {
  readonly store = inject(StudioStore);
  readonly inspectorOpen = this.store.inspectorOpen;
  readonly exportOpen = signal(false);
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
  readonly tool = signal<'explore' | 'draw' | 'points' | 'pan'>('explore');
  readonly ready = signal(false);
  readonly modal = signal('');
  readonly preview = signal<Project | null>(null);
  readonly pending = signal<readonly Vec2[] | null>(null);
  readonly share = signal('');
  readonly svgPaths = signal<{ name: string; d: string }[]>([]);
  depth = 0;
  pngScale = 1;
  pngTransparent = false;
  svgClosure: 'segment' | 'return' = 'segment';
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
  chooseTool(value: 'explore' | 'draw' | 'points' | 'pan'): void {
    this.tool.set(value);
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
      this.dimension !== 2 ||
      this.pending() ||
      this.pointer !== null ||
      !(this.tool() === 'draw' || this.tool() === 'pan')
    )
      return;
    this.pointer = event.pointerId;
    this.points = [];
    this.canvas.nativeElement.setPointerCapture(event.pointerId);
    this.addPoint(event);
  }
  pointerMove(event: PointerEvent): void {
    if (this.pointer !== event.pointerId) return;
    if (this.tool() === 'pan' && this.flat) {
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
    if (this.points.length >= 10000) {
      this.store.notice.set('Límite de 10 000 puntos alcanzado. Confirma el trazo.');
      this.pointerUp(event);
      return;
    }
    this.points.push(point);
    this.flat.preview = this.points;
  }
  pointerUp(event: PointerEvent): void {
    if (this.pointer !== event.pointerId) return;
    this.pointer = null;
    this.canvas.nativeElement.releasePointerCapture(event.pointerId);
    if (this.tool() === 'draw') {
      if (this.points.length >= 3) this.pending.set([...this.points]);
      else {
        this.store.notice.set('Dibuja al menos tres puntos antes de confirmar.');
        this.cancelDrawing();
      }
    }
  }
  cancelDrawing(): void {
    this.pointer = null;
    this.pending.set(null);
    this.points = [];
    if (this.flat) this.flat.preview = [];
  }
  confirmDrawing(closure: 'segment' | 'return'): void {
    const points = this.pending();
    if (!points) return;
    this.store.setSource({ kind: 'curve2d', points: points.map((p) => [...p]), closure });
    this.cancelDrawing();
    this.chooseTool('explore');
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
  setLayer(key: keyof Project['appearance'], value: boolean): void {
    this.store.edit((p) => {
      (p.appearance as unknown as Record<string, unknown>)[key] = value;
    }, false);
  }
  setPreset(id: string): void {
    this.store.setPreset(id);
    this.fitted = false;
  }
  switchMode(dimension: 2 | 3): void {
    if (dimension === this.dimension) return;
    this.captureView();
    const navigate = async () => {
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
  async openProject(p: Project, copy = false): Promise<void> {
    this.captureView();
    this.close();
    if (this.store.dirty())
      try {
        await this.store.repository.draft(this.store.snapshot());
      } catch {
        this.store.notice.set(
          'Descarga el proyecto actual antes de abrir otro: no se pudo conservar el borrador.',
        );
        return;
      }
    await this.store.load(p, copy);
    if (p.dimension !== this.dimension)
      await this.router.navigate(['/studio', p.dimension === 2 ? '2d' : '3d']);
    else {
      this.fitted = false;
      this.fit();
      this.restoreView();
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
  exportSvg(): void {
    try {
      const s = this.store.reconstruction;
      if (s)
        download(
          new Blob([exportSvg(s, this.project.appearance.color, this.project.appearance.width)], {
            type: 'image/svg+xml',
          }),
          `${this.project.name}.svg`,
        );
    } catch (error) {
      this.error(error);
    }
  }
  async png(): Promise<void> {
    try {
      if (this.flat) {
        this.flat.transparent = this.pngTransparent;
        this.flat.invalidate();
      }
      this.spatial?.renderer.setClearAlpha(this.pngTransparent ? 0 : 1);
      this.flat?.render(this.store.clock.phase);
      this.spatial?.render(this.store.clock.phase);
      const source = this.flat?.canvas ?? this.canvas.nativeElement,
        canvas = document.createElement('canvas'),
        scale = Math.min(this.pngScale, 4096 / source.width, 4096 / source.height);
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (this.flat) {
        this.flat.transparent = false;
        this.flat.invalidate();
      }
      this.spatial?.renderer.setClearAlpha(1);
      download(await capturePng(canvas), `${this.project.name}.png`);
    } catch (error) {
      this.error(error);
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
        this.svgPaths.set(inspectSvg(text));
        this.open('svg');
      } else {
        this.preview.set(parseProject(text));
        this.open('import');
      }
    } catch (error) {
      this.error(error);
    }
    input.value = '';
  }
  importPath(index: number): void {
    try {
      const points = sampleSvg(this.svgPaths()[index].d);
      this.preview.set(
        createProject(
          2,
          { kind: 'curve2d', points: points.map((p) => [...p]), closure: this.svgClosure },
          this.svgPaths()[index].name,
        ),
      );
      this.modal.set('import');
    } catch (error) {
      this.error(error);
    }
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
  async recover(): Promise<void> {
    const p = this.store.recovery();
    if (p) {
      await this.openProject(p);
      this.store.recovery.set(null);
    }
  }
  async discardRecovery(): Promise<void> {
    const p = this.store.recovery();
    if (p) await this.store.repository.discardDraft(p.id);
    this.store.recovery.set(null);
  }
  private error(error: unknown): void {
    this.store.notice.set(explainError(error));
  }
  async video(): Promise<void> {
    if (!this.videoAvailable || this.store.busy() || this.recording()) return;
    this.recordingAbort = new AbortController();
    const abort = this.recordingAbort;
    this.recording.set(true);
    const snapshot = new StudioStore(),
      p = structuredClone(this.store.snapshot());
    snapshot.project.set(p);
    snapshot.offset = structuredClone(this.store.offset);
    snapshot.terms = structuredClone(this.store.terms);
    snapshot.circles3 = structuredClone(this.store.circles3);
    snapshot.harmonics = structuredClone(this.store.harmonics);
    snapshot.reconstruction = structuredClone(this.store.reconstruction);
    snapshot.reference = structuredClone(this.store.reference);
    const canvas = document.createElement('canvas');
    let renderer: CanvasRenderer | import('../spatial/three-renderer').ThreeRenderer | null = null;
    try {
      if (this.spatial) {
        const { ThreeRenderer } = await import('../spatial/three-renderer');
        if (abort.signal.aborted) return;
        const spatial = new ThreeRenderer(canvas, snapshot, () => undefined);
        renderer = spatial;
        spatial.resize(1280, 720, 1);
        spatial.fit();
        spatial.setCamera(p.view.camera);
        spatial.camera.position.copy(this.spatial.camera.position);
        spatial.camera.zoom = this.spatial.camera.zoom;
        spatial.camera.updateProjectionMatrix();
        spatial.controls.target.copy(this.spatial.controls.target);
        spatial.controls.update();
      } else {
        renderer = new CanvasRenderer(canvas, snapshot);
        renderer.resize(1280, 720, 1);
        renderer.fit();
      }
      const recordingRenderer = renderer;
      const blob = await recordCycle(
        canvas,
        (t) => recordingRenderer.render(t),
        abort.signal,
        8000 / p.playback.speed,
      );
      download(blob, `${p.name}.${blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
    } catch (error) {
      this.error(error);
    } finally {
      renderer?.dispose();
      snapshot.dispose();
      this.recording.set(false);
      this.recordingAbort = null;
    }
  }
  cancelVideo(): void {
    this.recordingAbort?.abort();
  }
  ngOnDestroy(): void {
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
