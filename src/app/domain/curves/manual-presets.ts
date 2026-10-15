import { Source } from '../projects/project-schema';
import { planeBasis } from '../fourier/math';
export function getManualPreset(dimension: 2 | 3, id: string): Source {
  const circle = (frequency: number, radius: number, phase = 0) => ({
    id: crypto.randomUUID(),
    frequency,
    radius,
    phase,
  });
  if (dimension === 2)
    return {
      kind: 'manual2d',
      offset: [0, 0],
      circles:
        id === 'ellipse'
          ? [circle(1, 0.75), circle(-1, 0.25)]
          : id === 'lissajous'
            ? [circle(2, 0.5), circle(-2, 0.5), circle(3, 0.3), circle(-3, 0.3, Math.PI)]
            : [circle(1, 0.5), circle(-4, 0.5)],
    };
  const xy = {
      axisU: [1, 0, 0] as [number, number, number],
      axisV: [0, 1, 0] as [number, number, number],
    },
    xz = {
      axisU: [1, 0, 0] as [number, number, number],
      axisV: [0, 0, 1] as [number, number, number],
    },
    yz = {
      axisU: [0, 1, 0] as [number, number, number],
      axisV: [0, 0, 1] as [number, number, number],
    };
  const circles =
    id === 'coplanar'
      ? [
          { ...circle(1, 0.65), ...xy },
          { ...circle(-3, 0.25), ...xy },
        ]
      : id === 'five'
        ? [
            { ...circle(1, 0.5), ...xy },
            { ...circle(2, 0.22), ...xz },
            { ...circle(-3, 0.15), ...yz },
            { ...circle(5, 0.08), ...planeBasis([1, 1, 1]) },
            { ...circle(-7, 0.05), ...planeBasis([1, -1, 0.5]) },
          ]
        : [
            { ...circle(1, 0.7), ...xy },
            { ...circle(3, 0.3), ...xz },
          ];
  return {
    kind: 'manual3d',
    offset: [0, 0, 0],
    circles: circles.map((c) => ({ ...c, axisU: [...c.axisU], axisV: [...c.axisV] })),
  };
}
