import {
  CurveSamples,
  Fourier2D,
  Fourier3D,
  Harmonic3,
  Circle3,
  Point,
  Circle2,
  Vec2,
  Vec3,
  PreparedCurve,
  FourierAnalysis,
  TermOrder,
  FourierBackend,
} from '../model';
import { FftJsBackend } from './backend';
export const TAU = Math.PI * 2;
const backend = new FftJsBackend();
function validateSamples(s: CurveSamples, dimension: 2 | 3): void {
  if (s.dimension !== dimension || s.coordinates.length !== s.count * dimension)
    throw new Error('DIMENSION');
  if (s.count < 2 || (s.count & (s.count - 1)) !== 0) throw new Error('COUNT');
  if (s.coordinates.some((x) => !Number.isFinite(x))) throw new Error('NON_FINITE');
}
export function analyze2D(samples: CurveSamples, fft: FourierBackend = backend): Fourier2D {
  validateSamples(samples, 2);
  const n = samples.count,
    c = fft.forwardComplex(samples.coordinates),
    terms: Circle2[] = [];
  for (let k = 1; k < n; k++)
    terms.push({
      frequency: k < n / 2 ? k : k - n,
      radius: Math.hypot(c[2 * k], c[2 * k + 1]) / n,
      phase: Math.atan2(c[2 * k + 1], c[2 * k]),
    });
  return { kind: 'fourier2d', offset: [c[0] / n, c[1] / n], sampleCount: n, terms };
}
export function analyze3D(samples: CurveSamples, fft: FourierBackend = backend): Fourier3D {
  validateSamples(samples, 3);
  const n = samples.count,
    axes = Array.from({ length: 3 }, (_, d) => {
      const input = new Float64Array(n * 2);
      for (let j = 0; j < n; j++) input[2 * j] = samples.coordinates[3 * j + d];
      return fft.forwardComplex(input);
    }),
    harmonics: Harmonic3[] = [];
  for (let k = 1; k <= n / 2; k++) {
    const scale = k === n / 2 ? 1 : 2;
    harmonics.push({
      frequency: k,
      a: axes.map((c) => (scale * c[2 * k]) / n) as unknown as Vec3,
      b: k === n / 2 ? [0, 0, 0] : (axes.map((c) => (-2 * c[2 * k + 1]) / n) as unknown as Vec3),
    });
  }
  return {
    kind: 'fourier3d',
    offset: axes.map((c) => c[0] / n) as unknown as Vec3,
    sampleCount: n,
    harmonics,
  };
}
export function evaluate2D(offset: Vec2, terms: readonly Circle2[], phase: number): Vec2 {
  let x = offset[0],
    y = offset[1];
  for (const c of terms) {
    const a = TAU * c.frequency * phase + c.phase;
    x += c.radius * Math.cos(a);
    y += c.radius * Math.sin(a);
  }
  return [x, y];
}
export function evaluate3D(offset: Vec3, terms: readonly Harmonic3[], phase: number): Vec3 {
  const out = [...offset];
  for (const h of terms) {
    const a = TAU * h.frequency * phase,
      c = Math.cos(a),
      s = Math.sin(a);
    for (let d = 0; d < 3; d++) out[d] += h.a[d] * c + h.b[d] * s;
  }
  return out as unknown as Vec3;
}
export const dot = (a: Vec3, b: Vec3) => a.reduce((v, x, i) => v + x * b[i], 0);
export const norm = (a: Vec3) => Math.hypot(...a);
const mul = (a: Vec3, s: number) => a.map((x) => x * s) as unknown as Vec3;
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function planeBasis(normal: Vec3, rotation = 0): { axisU: Vec3; axisV: Vec3 } {
  const length = norm(normal);
  if (length < 1e-12) throw new Error('Normal no puede ser cero');
  const n = mul(normal, 1 / length),
    axis = n.map(Math.abs).indexOf(Math.min(...n.map(Math.abs))),
    seed = [0, 0, 0];
  seed[axis] = 1;
  const u0 = cross(n, seed as unknown as Vec3),
    u = mul(u0, 1 / norm(u0)),
    v = cross(n, u),
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  return {
    axisU: u.map((x, i) => c * x + s * v[i]) as unknown as Vec3,
    axisV: v.map((x, i) => c * x - s * u[i]) as unknown as Vec3,
  };
}
export function harmonicToCircles(h: Harmonic3): Circle3[] {
  const na = norm(h.a),
    nb = norm(h.b);
  if (na === 0 && nb === 0) return [];
  const u = na > 1e-12 ? mul(h.a, 1 / na) : mul(h.b, 1 / nb),
    alpha = dot(h.a, u),
    beta = dot(h.b, u),
    perp = h.b.map((x, i) => x - beta * u[i]) as unknown as Vec3,
    gamma = norm(perp),
    v = gamma > 1e-12 ? mul(perp, 1 / gamma) : planeBasis(u).axisU;
  return [
    [(alpha + gamma) / 2, -beta / 2, h.frequency],
    [(alpha - gamma) / 2, beta / 2, -h.frequency],
  ]
    .filter(([re, im]) => Math.hypot(re, im) > 0)
    .map(([re, im, frequency]) => ({
      frequency,
      radius: Math.hypot(re, im),
      phase: Math.atan2(im, re),
      axisU: u,
      axisV: v,
    }));
}
export function evaluateCircle3(c: Circle3, phase: number): Vec3 {
  const a = TAU * c.frequency * phase + c.phase,
    cos = c.radius * Math.cos(a),
    sin = c.radius * Math.sin(a);
  return c.axisU.map((x, i) => cos * x + sin * c.axisV[i]) as unknown as Vec3;
}
export function evaluateManual3D(offset: Vec3, circles: readonly Circle3[], phase: number): Vec3 {
  const out = [...offset];
  for (const c of circles) {
    const p = evaluateCircle3(c, phase);
    for (let d = 0; d < 3; d++) out[d] += p[d];
  }
  return out as unknown as Vec3;
}
export function select2DTerms(
  a: Fourier2D,
  count: number,
  order: TermOrder = 'amplitude',
): Circle2[] {
  if (!Number.isInteger(count) || count < 1 || count > a.terms.length) throw new Error('COUNT');
  return [...a.terms]
    .sort(
      (x, y) =>
        (order === 'amplitude' ? y.radius - x.radius : 0) ||
        Math.abs(x.frequency) - Math.abs(y.frequency) ||
        x.frequency - y.frequency,
    )
    .slice(0, count);
}
export function select3DHarmonics(a: Fourier3D, count: number): Harmonic3[] {
  if (!Number.isInteger(count) || count < 1 || count > a.harmonics.length) throw new Error('COUNT');
  const energy = (h: Harmonic3) =>
    (dot(h.a, h.a) + dot(h.b, h.b)) / (h.frequency === a.sampleCount / 2 ? 1 : 2);
  return [...a.harmonics]
    .sort((x, y) => energy(y) - energy(x) || x.frequency - y.frequency)
    .slice(0, count);
}
export function sampleCurve(
  dimension: 2 | 3,
  count: number,
  evaluate: (phase: number) => Point,
): CurveSamples {
  if (!Number.isInteger(count) || count < 2 || count > 8192) throw new Error('COUNT');
  const coordinates = new Float64Array(count * dimension);
  for (let j = 0; j < count; j++) {
    const p = evaluate(j / count);
    if (p.length !== dimension || p.some((x) => !Number.isFinite(x)))
      throw new Error('DIMENSION / NON_FINITE');
    coordinates.set(p, j * dimension);
  }
  return { dimension, count, coordinates };
}
export function restoreSourceFrame(a: FourierAnalysis, p: PreparedCurve): FourierAnalysis {
  const offset = a.offset.map((x, d) => p.sourceCenter[d] + x / p.sourceScale);
  return a.kind === 'fourier2d'
    ? {
        ...a,
        offset: offset as unknown as Vec2,
        terms: a.terms.map((t) => ({ ...t, radius: t.radius / p.sourceScale })),
      }
    : {
        ...a,
        offset: offset as unknown as Vec3,
        harmonics: a.harmonics.map((h) => ({
          ...h,
          a: mul(h.a, 1 / p.sourceScale),
          b: mul(h.b, 1 / p.sourceScale),
        })),
      };
}
export function restoreSampleFrame(p: PreparedCurve): CurveSamples {
  const s = p.samples;
  return {
    ...s,
    coordinates: s.coordinates.map((x, i) => x / p.sourceScale + p.sourceCenter[i % s.dimension]),
  };
}
export function measureError(a: CurveSamples, b: CurveSamples): { rms: number; max: number } {
  if (
    a.dimension !== b.dimension ||
    a.count !== b.count ||
    a.coordinates.length !== b.coordinates.length
  )
    throw new Error('DIMENSION');
  let total = 0,
    max = 0;
  for (let j = 0; j < a.count; j++) {
    let sq = 0;
    for (let d = 0; d < a.dimension; d++)
      sq += (a.coordinates[j * a.dimension + d] - b.coordinates[j * a.dimension + d]) ** 2;
    total += sq;
    max = Math.max(max, Math.sqrt(sq));
  }
  return { rms: Math.sqrt(total / a.count), max };
}
