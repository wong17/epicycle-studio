import { Raster, TraceOptions } from '../../domain/image-tracing/trace-raster';
import { Vec2 } from '../../domain/model';
export interface PhotoRequest {
  jobId: number;
  raster: Raster;
  options: TraceOptions;
}
export type PhotoResponse =
  | { jobId: number; status: 'success'; points: Vec2[] }
  | { jobId: number; status: 'failure'; message: string };
export interface PhotoWorkerPort {
  onmessage: ((event: MessageEvent<PhotoResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: PhotoRequest, transfer: Transferable[]): void;
  terminate(): void;
}
