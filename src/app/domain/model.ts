export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Point = Vec2 | Vec3;
export type Dimension = 2 | 3;
export type ClosureMode = 'segment' | 'return';
export type TermOrder = 'amplitude' | 'frequency';
export interface CurveSamples {
  dimension: Dimension;
  count: number;
  coordinates: Float64Array;
}
export interface PreparedCurve {
  samples: CurveSamples;
  sourceCenter: Point;
  sourceScale: number;
}
export interface Circle2 {
  frequency: number;
  radius: number;
  phase: number;
}
export interface Circle3 extends Circle2 {
  axisU: Vec3;
  axisV: Vec3;
}
export interface Harmonic3 {
  frequency: number;
  a: Vec3;
  b: Vec3;
}
export interface Fourier2D {
  kind: 'fourier2d';
  offset: Vec2;
  sampleCount: number;
  terms: Circle2[];
}
export interface Fourier3D {
  kind: 'fourier3d';
  offset: Vec3;
  sampleCount: number;
  harmonics: Harmonic3[];
}
export type FourierAnalysis = Fourier2D | Fourier3D;
export interface FourierBackend {
  forwardComplex(input: Float64Array): Float64Array;
}
export type ComputeOutcome<T> = { status: 'ok'; value: T } | { status: 'cancelled' };
