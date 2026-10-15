/// <reference lib="webworker" />
import {
  analyze2D,
  analyze3D,
  restoreSourceFrame,
  evaluate2D,
  evaluate3D,
  sampleCurve,
  select2DTerms,
  select3DHarmonics,
} from '../../domain/fourier/math';
import { PreparedCurve, FourierAnalysis, TermOrder } from '../../domain/model';
export type ComputeRequest =
  | { jobId: number; kind: 'analyze'; prepared: PreparedCurve }
  | {
      jobId: number;
      kind: 'sample';
      analysis: FourierAnalysis;
      count: number;
      order: TermOrder;
      outputCount: number;
    };
addEventListener('message', ({ data }: { data: ComputeRequest }) => {
  try {
    let value;
    if (data.kind === 'analyze') {
      const p = data.prepared;
      value = restoreSourceFrame(
        p.samples.dimension === 2 ? analyze2D(p.samples) : analyze3D(p.samples),
        p,
      );
    } else {
      const a = data.analysis;
      if (a.kind === 'fourier2d') {
        const terms = select2DTerms(a, data.count, data.order);
        value = sampleCurve(2, data.outputCount, (t) => evaluate2D(a.offset, terms, t));
      } else {
        const terms = select3DHarmonics(a, data.count);
        value = sampleCurve(3, data.outputCount, (t) => evaluate3D(a.offset, terms, t));
      }
    }
    postMessage({ jobId: data.jobId, status: 'success', value });
  } catch (error) {
    postMessage({
      jobId: data.jobId,
      status: 'failure',
      message: error instanceof Error ? error.message : 'Cálculo fallido',
    });
  }
});
