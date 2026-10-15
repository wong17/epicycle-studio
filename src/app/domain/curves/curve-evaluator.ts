import { Circle3, Harmonic3, Vec3 } from '../model';
import { TAU, evaluate3D, evaluateManual3D, norm } from '../fourier/math';
export interface CurveEvaluator3 {
  pointAt(phase: number): Vec3;
  tangentAt(phase: number): Vec3;
  secondDerivativeBound: number;
}
export function createManualCurve3(offset: Vec3, circles: readonly Circle3[]): CurveEvaluator3 {
  return {
    pointAt: (t) => evaluateManual3D(offset, circles, t),
    tangentAt: (t) => {
      const result = [0, 0, 0];
      for (const c of circles) {
        const w = TAU * c.frequency,
          a = w * t + c.phase;
        for (let d = 0; d < 3; d++)
          result[d] += w * c.radius * (-c.axisU[d] * Math.sin(a) + c.axisV[d] * Math.cos(a));
      }
      return result as unknown as Vec3;
    },
    secondDerivativeBound: circles.reduce((v, c) => v + (TAU * c.frequency) ** 2 * c.radius, 0),
  };
}
export function createFourierCurve3(
  offset: Vec3,
  harmonics: readonly Harmonic3[],
): CurveEvaluator3 {
  return {
    pointAt: (t) => evaluate3D(offset, harmonics, t),
    tangentAt: (t) => {
      const result = [0, 0, 0];
      for (const h of harmonics) {
        const w = TAU * h.frequency,
          a = w * t;
        for (let d = 0; d < 3; d++) result[d] += w * (-h.a[d] * Math.sin(a) + h.b[d] * Math.cos(a));
      }
      return result as unknown as Vec3;
    },
    secondDerivativeBound: harmonics.reduce(
      (v, h) => v + (TAU * h.frequency) ** 2 * (norm(h.a) + norm(h.b)),
      0,
    ),
  };
}
