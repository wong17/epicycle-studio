import { CurveSamples, Vec2 } from '../../domain/model';
import { Viewport2D } from './viewport-2d';
import { StudioStore } from '../studio/studio-store';
export class CanvasRenderer {
  readonly viewport = new Viewport2D();
  private context: CanvasRenderingContext2D;
  private cache = document.createElement('canvas');
  private dpr = 1;
  private width = 1;
  private height = 1;
  private revision = -1;
  private inkBounds = [0, 0, 1, 1];
  drawing = false;
  previewStrokes: readonly (readonly Vec2[])[] = [];
  transparent = false;
  background = '#151515';
  editHandles = false;
  orbitWidth = 1;
  orbitColor = '#686868';
  vectorColor = '#b7b7b7';
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly store: StudioStore,
  ) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D no disponible');
    this.context = c;
  }
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr, width < 600 ? 1.5 : 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.cache.width = this.canvas.width;
    this.cache.height = this.canvas.height;
    this.viewport.width = width;
    this.viewport.height = height;
    this.revision = -1;
  }
  fit(): void {
    if (this.store.reconstruction) {
      const s = this.store.reconstruction,
        coordinates = new Float64Array(s.count * 2);
      for (let j = 0; j < s.count; j++)
        coordinates.set(
          this.projectPoint(s.coordinates.subarray(j * s.dimension, (j + 1) * s.dimension)),
          j * 2,
        );
      this.viewport.fit(coordinates, 2);
    }
    this.revision = -1;
  }
  invalidate(): void {
    this.revision = -1;
  }
  private projectPoint(point: ArrayLike<number>): Vec2 {
    const view = this.store.project().view.camera;
    return this.store.project().dimension === 3
      ? view === 'xz'
        ? [point[0], point[2]]
        : view === 'yz'
          ? [point[1], point[2]]
          : [point[0], point[1]]
      : [point[0], point[1]];
  }
  private path(
    c: CanvasRenderingContext2D,
    s: CurveSamples,
    color: string | CanvasGradient,
    width: number,
    end = s.count,
    closed = true,
  ): void {
    c.beginPath();
    for (let j = 0; j < end; j++) {
      const [x, y] = this.viewport.worldToScreen(
        this.projectPoint(s.coordinates.subarray(j * s.dimension, (j + 1) * s.dimension)),
      );
      if (j) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    if (closed) c.closePath();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  render(phase: number): void {
    const p = this.store.project(),
      c = this.context;
    if (this.revision !== this.store.revision()) {
      const cache = this.cache.getContext('2d')!;
      cache.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      cache.fillStyle = this.background;
      cache.clearRect(0, 0, this.width, this.height);
      if (!this.transparent) cache.fillRect(0, 0, this.width, this.height);
      if (p.appearance.grid) {
        cache.strokeStyle = '#252525';
        cache.lineWidth = 1;
        cache.beginPath();
        for (let x = (this.width / 2) % 32; x < this.width; x += 32) {
          cache.moveTo(x, 0);
          cache.lineTo(x, this.height);
        }
        for (let y = (this.height / 2) % 32; y < this.height; y += 32) {
          cache.moveTo(0, y);
          cache.lineTo(this.width, y);
        }
        cache.stroke();
      }
      if (!this.drawing && p.appearance.original && this.store.reference) {
        cache.setLineDash([5, 5]);
        this.path(cache, this.store.reference, '#909090', 1.5);
        cache.setLineDash([]);
      }
      if (
        !this.drawing &&
        p.appearance.colorMode !== 'spectrum' &&
        p.appearance.reconstruction &&
        this.store.reconstruction
      )
        this.path(cache, this.store.reconstruction, p.appearance.color, p.appearance.width);
      if (this.store.reconstruction) {
        const data = this.store.reconstruction;
        let x0 = Infinity,
          y0 = Infinity,
          x1 = -Infinity,
          y1 = -Infinity;
        for (let i = 0; i < data.count; i++) {
          const [x, y] = this.viewport.worldToScreen(
            this.projectPoint(
              data.coordinates.subarray(i * data.dimension, (i + 1) * data.dimension),
            ),
          );
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        this.inkBounds = [x0, y0, Math.max(x0 + 1, x1), Math.max(y0 + 1, y1)];
      }
      this.revision = this.store.revision();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.cache, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.drawing) {
      c.strokeStyle = '#ededed';
      c.lineWidth = 2;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const stroke of this.previewStrokes) {
        c.beginPath();
        stroke.forEach((point, i) => {
          const screen = this.viewport.worldToScreen(point);
          if (i) c.lineTo(...screen);
          else c.moveTo(...screen);
        });
        c.stroke();
      }
      if (this.editHandles) {
        c.fillStyle = '#d4f477';
        for (const stroke of this.previewStrokes) {
          const step = Math.max(1, Math.ceil(stroke.length / 100));
          for (let i = 0; i < stroke.length; i += step) {
            const [x, y] = this.viewport.worldToScreen(stroke[i]);
            c.fillRect(x - 2, y - 2, 4, 4);
          }
        }
      }
      return;
    }
    if (!this.store.reconstruction) return;
    let ink: string | CanvasGradient = p.appearance.color;
    if (p.appearance.colorMode === 'spectrum') {
      const gradient = c.createLinearGradient(
        this.inkBounds[0],
        this.inkBounds[1],
        this.inkBounds[2],
        this.inkBounds[3],
      );
      for (let i = 0; i <= 6; i++)
        gradient.addColorStop(i / 6, `hsl(${phase * 360 + i * 60} 95% 65%)`);
      ink = gradient;
      if (p.appearance.reconstruction && this.store.reconstruction)
        this.path(c, this.store.reconstruction, ink, p.appearance.width);
    }
    if (p.appearance.trace && this.store.reconstruction)
      this.path(
        c,
        this.store.reconstruction,
        ink,
        p.appearance.width + 1,
        Math.floor(phase * this.store.reconstruction.count) + 1,
        false,
      );
    let end = this.store.offset as Vec2;
    if (p.dimension === 2) {
      const limit = this.width < 600 ? 48 : 128;
      for (let i = 0; i < this.store.terms.length; i++) {
        const term = this.store.terms[i],
          angle = 2 * Math.PI * term.frequency * phase + term.phase,
          next: Vec2 = [
            end[0] + term.radius * Math.cos(angle),
            end[1] + term.radius * Math.sin(angle),
          ];
        if (i < limit && term.radius > 1e-7) {
          const start = this.viewport.worldToScreen(end),
            stop = this.viewport.worldToScreen(next);
          if (p.appearance.circles) {
            c.beginPath();
            c.arc(
              start[0],
              start[1],
              term.radius * this.viewport.scale * this.viewport.zoom,
              0,
              Math.PI * 2,
            );
            c.strokeStyle =
              p.appearance.colorMode === 'spectrum'
                ? `hsl(${phase * 120 + i * 17} 65% 64%)`
                : this.orbitColor;
            c.lineWidth = this.orbitWidth;
            c.stroke();
          }
          if (p.appearance.vectors) {
            c.beginPath();
            c.moveTo(...start);
            c.lineTo(...stop);
            c.strokeStyle = this.vectorColor;
            c.lineWidth = this.orbitWidth;
            c.stroke();
          }
        }
        end = next;
      }
    } else {
      const point = this.store.evaluate(phase);
      end = this.projectPoint(point);
    }
    const tip = this.viewport.worldToScreen(end);
    c.beginPath();
    c.arc(...tip, 4, 0, Math.PI * 2);
    c.fillStyle =
      p.appearance.colorMode === 'spectrum' ? `hsl(${phase * 360} 95% 65%)` : p.appearance.color;
    c.fill();
  }

  dispose(): void {
    this.cache.width = 0;
    this.cache.height = 0;
  }
}
