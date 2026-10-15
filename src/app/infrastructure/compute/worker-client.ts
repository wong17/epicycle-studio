import {
  ComputeOutcome,
  FourierAnalysis,
  PreparedCurve,
  Fourier2D,
  Fourier3D,
  CurveSamples,
  TermOrder,
} from '../../domain/model';
import {
  analyze2D,
  analyze3D,
  restoreSourceFrame,
  sampleCurve,
  evaluate2D,
  evaluate3D,
  select2DTerms,
  select3DHarmonics,
} from '../../domain/fourier/math';
export class WorkerClient {
  private worker: Worker | null = null;
  private job = 0;
  private pending: ((result: ComputeOutcome<unknown>) => void) | null = null;
  private disposed = false;
  constructor(
    private readonly factory: () => Worker = () =>
      new Worker(new URL('./fourier.worker', import.meta.url), { type: 'module' }),
  ) {}
  sample2D(
    analysis: Fourier2D,
    count: number,
    order: TermOrder,
    outputCount: number,
  ): Promise<ComputeOutcome<CurveSamples>> {
    return this.sample(analysis, count, order, outputCount);
  }
  sample3D(
    analysis: Fourier3D,
    count: number,
    outputCount: number,
  ): Promise<ComputeOutcome<CurveSamples>> {
    return this.sample(analysis, count, 'amplitude', outputCount);
  }
  private async sample(
    analysis: FourierAnalysis,
    count: number,
    order: TermOrder,
    outputCount: number,
  ): Promise<ComputeOutcome<CurveSamples>> {
    this.cancel();
    if (this.disposed) return { status: 'cancelled' };
    const jobId = ++this.job;
    if (typeof Worker === 'undefined') {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (jobId !== this.job) return { status: 'cancelled' };
      if (analysis.kind === 'fourier2d') {
        const terms = select2DTerms(analysis, count, order);
        return {
          status: 'ok',
          value: sampleCurve(2, outputCount, (t) => evaluate2D(analysis.offset, terms, t)),
        };
      }
      const terms = select3DHarmonics(analysis, count);
      return {
        status: 'ok',
        value: sampleCurve(3, outputCount, (t) => evaluate3D(analysis.offset, terms, t)),
      };
    }
    return new Promise((resolve, reject) => {
      this.pending = resolve as (result: ComputeOutcome<unknown>) => void;
      try {
        const worker = (this.worker = this.factory());
        worker.onmessage = ({ data }) => {
          if (data.jobId !== this.job || this.disposed) return;
          this.pending = null;
          worker.terminate();
          this.worker = null;
          if (data.status === 'failure') reject(new Error(data.message));
          else resolve({ status: 'ok', value: data.value });
        };
        worker.onerror = () => {
          if (jobId !== this.job || this.disposed) return;
          this.pending = null;
          worker.terminate();
          this.worker = null;
          reject(new Error('No se pudo muestrear la curva'));
        };
        worker.postMessage({ kind: 'sample', jobId, analysis, count, order, outputCount });
      } catch (error) {
        this.pending = null;
        this.worker?.terminate();
        this.worker = null;
        reject(error);
      }
    });
  }
  async analyze(prepared: PreparedCurve): Promise<ComputeOutcome<FourierAnalysis>> {
    this.cancel();
    if (this.disposed) return { status: 'cancelled' };
    const jobId = ++this.job;
    if (typeof Worker === 'undefined') {
      if (prepared.samples.count > 256) throw new Error('Modo sin Worker: máximo 256 muestras');
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (jobId !== this.job) return { status: 'cancelled' };
      return {
        status: 'ok',
        value: restoreSourceFrame(
          prepared.samples.dimension === 2
            ? analyze2D(prepared.samples)
            : analyze3D(prepared.samples),
          prepared,
        ),
      };
    }
    return new Promise((resolve, reject) => {
      this.pending = resolve as (result: ComputeOutcome<unknown>) => void;
      try {
        this.worker = this.factory();
        this.worker.onmessage = ({ data }) => {
          if (data.jobId !== this.job || this.disposed) return;
          this.pending = null;
          this.worker?.terminate();
          this.worker = null;
          if (data.status === 'failure') reject(new Error(data.message));
          else resolve({ status: 'ok', value: data.value });
        };
        this.worker.onerror = () => {
          if (jobId !== this.job || this.disposed) return;
          this.pending = null;
          this.worker?.terminate();
          this.worker = null;
          reject(new Error('No se pudo cargar el cálculo. Reintenta.'));
        };
        const copy = {
          ...prepared,
          samples: { ...prepared.samples, coordinates: prepared.samples.coordinates.slice() },
        };
        this.worker.postMessage({ kind: 'analyze', jobId, prepared: copy }, [
          copy.samples.coordinates.buffer,
        ]);
      } catch (error) {
        this.pending = null;
        this.worker?.terminate();
        this.worker = null;
        reject(error);
      }
    });
  }
  cancel(): void {
    this.job++;
    this.worker?.terminate();
    this.worker = null;
    this.pending?.({ status: 'cancelled' });
    this.pending = null;
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}
