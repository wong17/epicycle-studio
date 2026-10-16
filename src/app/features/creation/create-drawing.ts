import { StudioTooltip } from '../studio/studio-tooltip';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudioIcon } from '../studio/studio-icon';
import { GALLERY, GalleryCategory, getGalleryDrawing } from '../../domain/creation/gallery';
import { DrawingDraft, RouteOrder } from '../../domain/creation/types';
import { connectStrokes, normalizeDrawing } from '../../domain/creation/continuous-route';
import { createTextDrawing } from '../../domain/creation/text-drawing';
import { Vec2 } from '../../domain/model';
import { explainError } from '../../domain/errors';
import { readSvgDrawing, SvgStroke } from '../../infrastructure/creation/svg-drawing';
import { PhotoClient, PhotoOptions, PhotoStyle } from '../../infrastructure/creation/photo-client';

type CreationMode = 'gallery' | 'text' | 'svg' | 'photo';

@Component({
  selector: 'studio-create-drawing',
  imports: [FormsModule, StudioIcon, StudioTooltip],
  templateUrl: './create-drawing.html',
  styleUrl: './create-drawing.scss',
})
export class CreateDrawing implements AfterViewInit, OnDestroy, OnInit {
  readonly initialMode = input<CreationMode>('gallery');
  readonly returnFocus = input<HTMLElement | null>(null);
  readonly initialSvg = input('');
  readonly initialName = input('Ilustración SVG');
  readonly operationError = input('');
  readonly submitting = input(false);
  readonly created = output<DrawingDraft>();
  readonly dismissed = output<void>();
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  readonly mode = signal<CreationMode>('gallery');
  readonly category = signal<GalleryCategory>('all');
  readonly gallery = GALLERY;
  readonly categories: readonly { id: GalleryCategory; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'nature', label: 'Naturaleza' },
    { id: 'portraits', label: 'Retratos' },
    { id: 'geometry', label: 'Geometría' },
  ];
  readonly modes: readonly { id: CreationMode; label: string; icon: string }[] = [
    { id: 'gallery', label: 'Galería', icon: 'flower' },
    { id: 'text', label: 'Texto', icon: 'text' },
    { id: 'svg', label: 'SVG', icon: 'vector' },
    { id: 'photo', label: 'Foto', icon: 'image' },
  ];
  readonly filteredGallery = computed(() =>
    this.gallery.filter((item) => this.category() === 'all' || item.category === this.category()),
  );
  readonly draft = signal<DrawingDraft | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly selectedGallery = signal('profile');
  readonly svgStrokes = signal<readonly SvgStroke[]>([]);
  readonly selectedSvg = signal<ReadonlySet<string>>(new Set());
  readonly thumbnails = new Map(
    this.gallery.map((item) => [
      item.id,
      polygon(normalizeDrawing(connectStrokes(getGalleryDrawing(item.id).strokes))),
    ]),
  );
  readonly routeResult = computed<{ points: Vec2[]; error: string }>(() => {
    const draft = this.draft();
    if (!draft) return { points: [], error: '' };
    try {
      return { points: normalizeDrawing(connectStrokes(draft.strokes, this.order())), error: '' };
    } catch (error) {
      return { points: [], error: explainError(error) };
    }
  });
  readonly route = computed(() => this.routeResult().points);
  readonly order = signal<RouteOrder>('nearest');
  readonly previewPoints = computed(() => polygon(this.route()));
  readonly pointCount = computed(() => this.route().length);
  text = 'Tu nombre';
  variation = 0;
  photoStyle: PhotoStyle = 'continuous';
  photoDetail = 3;
  photoContrast = 1.2;
  photoInvert = false;
  photoName = '';
  private photoFile: File | null = null;
  private photoClient = new PhotoClient();
  private generation = 0;
  private trigger: HTMLElement | null = null;
  private closed = false;

  ngOnInit(): void {
    this.setMode(this.initialMode());
    if (this.initialSvg()) this.setSvgText(this.initialSvg(), this.initialName());
  }
  ngAfterViewInit(): void {
    this.trigger =
      this.returnFocus() ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy(): void {
    this.closed = true;
    this.generation++;
    this.photoClient.dispose();
    this.dialog.nativeElement.close();
    this.trigger?.focus();
  }
  dismiss(): void {
    if (!this.submitting()) this.dismissed.emit();
  }
  setMode(mode: CreationMode): void {
    this.generation++;
    this.photoClient.cancel();
    this.busy.set(false);
    this.error.set('');
    this.mode.set(mode);
    this.draft.set(null);
    if (mode === 'gallery') this.selectGallery(this.selectedGallery());
    else if (mode === 'text') this.generateText();
    else if (mode === 'svg') this.updateSvg();
    else if (this.photoFile) void this.generatePhoto();
  }
  selectGallery(id: string): void {
    this.attempt(() => {
      this.selectedGallery.set(id);
      this.draft.set(getGalleryDrawing(id, this.variation));
    });
  }
  vary(): void {
    this.variation++;
    this.selectGallery(this.selectedGallery());
  }
  generateText(): void {
    this.attempt(() => this.draft.set(createTextDrawing(this.text)));
  }
  async loadSvg(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    const generation = ++this.generation;
    this.error.set('');
    this.draft.set(null);
    this.svgStrokes.set([]);
    this.busy.set(true);
    try {
      if (file.size > 262144) throw new Error('El SVG debe pesar como máximo 256 KiB.');
      const text = await file.text();
      if (this.closed || generation !== this.generation) return;
      this.setSvgText(text, file.name.replace(/\.svg$/i, ''));
    } catch (error) {
      if (generation === this.generation) this.error.set(explainError(error));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  private setSvgText(text: string, name: string): void {
    this.attempt(() => {
      const strokes = readSvgDrawing(text);
      this.svgStrokes.set(strokes);
      this.selectedSvg.set(new Set(strokes.map((stroke) => stroke.id)));
      this.updateSvg(name);
    });
  }
  toggleSvg(id: string): void {
    const selected = new Set(this.selectedSvg());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.selectedSvg.set(selected);
    this.updateSvg();
  }
  private updateSvg(name = this.draft()?.name ?? 'Ilustración SVG'): void {
    const strokes = this.svgStrokes().filter((stroke) => this.selectedSvg().has(stroke.id));
    this.draft.set(
      strokes.length
        ? { name, strokes: strokes.map((stroke) => stroke.points), closure: 'return' }
        : null,
    );
  }
  async loadPhoto(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    this.photoFile = file;
    this.photoName = file.name;
    await this.generatePhoto();
  }
  async generatePhoto(): Promise<void> {
    if (!this.photoFile) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.draft.set(null);
    const options: PhotoOptions = {
      style: this.photoStyle,
      detail: this.photoDetail,
      contrast: this.photoContrast,
      invert: this.photoInvert,
    };
    try {
      const result = await this.photoClient.trace(this.photoFile, options);
      if (this.closed || generation !== this.generation) return;
      this.draft.set({
        name: this.photoFile.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Fotografía',
        strokes: [result.points],
        closure: 'return',
      });
    } catch (error) {
      if (generation === this.generation && !this.closed) this.error.set(explainError(error));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  cancelProcessing(): void {
    this.generation++;
    this.photoClient.cancel();
    this.busy.set(false);
    this.error.set('Procesamiento cancelado. Puedes ajustar las opciones y volver a intentar.');
  }
  confirm(): void {
    const draft = this.draft();
    if (!draft || this.busy() || this.submitting()) return;
    this.attempt(() => {
      const points = this.route();
      if (points.length < 3) throw new Error('Elige un recorrido con al menos tres puntos.');
      this.created.emit({ ...draft, strokes: [points] });
    });
  }
  private attempt(action: () => void): void {
    this.error.set('');
    try {
      action();
    } catch (error) {
      this.draft.set(null);
      this.error.set(explainError(error));
    }
  }
}

function polygon(points: readonly Vec2[]): string {
  return points.map(([x, y]) => `${160 + x * 100},${120 - y * 100}`).join(' ');
}
