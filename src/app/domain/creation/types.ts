import type { ClosureMode, Vec2 } from '../model';

export interface DrawingDraft {
  readonly name: string;
  readonly strokes: readonly (readonly Vec2[])[];
  readonly closure: ClosureMode;
}

export type RouteOrder = 'original' | 'nearest';
