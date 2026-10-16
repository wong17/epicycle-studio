import { Fourier2D } from '../model';

/** Parseval bounds RMS; the sum of omitted radii also bounds the worst-point error. */
export function recommendTermCount(analysis: Fourier2D, normalizationScale = 1): number {
  const radii = analysis.terms
    .map((term) => term.radius * normalizationScale)
    .sort((a, b) => b - a);
  let energy = radii.reduce((sum, r) => sum + r * r, 0);
  let tail = radii.reduce((sum, r) => sum + r, 0);
  for (let i = 0; i < radii.length; i++) {
    energy = Math.max(0, energy - radii[i] * radii[i]);
    tail = Math.max(0, tail - radii[i]);
    if (Math.sqrt(energy) <= 0.0015 && tail <= 0.02) return i + 1;
  }
  return Math.max(1, radii.length);
}
