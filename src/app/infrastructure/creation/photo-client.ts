import { Vec2 } from '../../domain/model';
import { validateTraceOptions } from '../../domain/image-tracing/trace-raster';
import { PhotoRequest, PhotoResponse, PhotoWorkerPort } from './photo-protocol';
import { readPhotoMetadata } from './photo-metadata';

export type PhotoStyle = 'contours' | 'continuous';
export interface PhotoOptions {
  style: PhotoStyle;
  detail: number;
  contrast: number;
  invert: boolean;
}
export interface PhotoResult {
  points: Vec2[];
  sourceWidth: number;
  sourceHeight: number;
}

const abortError = () => new DOMException('Conversión de foto cancelada.', 'AbortError');

/** Decodes locally, then sends a small transferable raster to a disposable worker. */
export class PhotoClient {
  private worker: PhotoWorkerPort | null = null;
  private job = 0;
  private rejectPending: ((error: unknown) => void) | null = null;
  private disposed = false;
  constructor(
    private readonly factory: () => PhotoWorkerPort = () => {
      if (typeof Worker === 'undefined')
        throw new Error('Tu navegador necesita Web Workers para convertir fotos.');
      return new Worker(new URL('./photo-trace.worker', import.meta.url), { type: 'module' });
    },
  ) {}

  trace(file: File, options: PhotoOptions): Promise<PhotoResult> {
    this.cancel();
    const jobId = this.job;
    const settings = { ...options };
    if (this.disposed) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      this.rejectPending = reject;
      const fail = (error: unknown) => {
        if (jobId !== this.job || this.disposed) return;
        this.job++;
        this.release();
        reject(error);
      };
      const run = async () => {
        validateTraceOptions(settings);
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
          throw new Error('Selecciona una imagen JPEG, PNG o WebP.');
        if (!file.size) throw new Error('El archivo de imagen está vacío.');
        if (file.size > 12 * 1024 * 1024) throw new Error('La imagen supera el límite de 12 MiB.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        this.checkCurrent(jobId);
        readPhotoMetadata(bytes, file.type);
        // Start the worker before decoding, so unsupported environments fail cheaply.
        this.worker = this.factory();
        const worker = this.worker;
        worker.onerror = () =>
          fail(new Error('No se pudo convertir la foto. Reintenta o usa otro navegador.'));
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
          throw new Error(
            'No se pudo decodificar la imagen. Comprueba el archivo JPEG, PNG o WebP.',
          );
        }
        try {
          this.checkCurrent(jobId);
          const sourceWidth = bitmap.width,
            sourceHeight = bitmap.height;
          if (sourceWidth < 2 || sourceHeight < 2 || sourceWidth > 4096 || sourceHeight > 4096)
            throw new Error('La imagen debe medir entre 2 y 4096 píxeles por lado.');
          const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
          const width = Math.max(2, Math.round(sourceWidth * scale));
          const height = Math.max(2, Math.round(sourceHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('No se pudo preparar la imagen en este navegador.');
          context.drawImage(bitmap, 0, 0, width, height);
          const raster = { width, height, data: context.getImageData(0, 0, width, height).data };
          canvas.width = 0;
          canvas.height = 0;
          worker.onmessage = ({ data }: MessageEvent<PhotoResponse>) => {
            if (jobId !== this.job || this.disposed || data.jobId !== jobId) return;
            this.release();
            if (data.status === 'failure') reject(new Error(data.message));
            else resolve({ points: data.points, sourceWidth, sourceHeight });
          };
          const request: PhotoRequest = { jobId, raster, options: settings };
          worker.postMessage(request, [raster.data.buffer]);
        } finally {
          bitmap.close();
        }
      };
      void run().catch(fail);
    });
  }

  cancel(): void {
    this.job++;
    const reject = this.rejectPending;
    this.release();
    reject?.(abortError());
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
  private checkCurrent(jobId: number): void {
    if (jobId !== this.job || this.disposed) throw abortError();
  }
  private release(): void {
    this.worker?.terminate();
    this.worker = null;
    this.rejectPending = null;
  }
}
