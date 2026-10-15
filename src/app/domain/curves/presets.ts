import { Point, Dimension } from '../model';
export function getPreset(id: string, dimension: Dimension): Point[] {
  if (dimension === 2 && id === 'star')
    return Array.from({ length: 10 }, (_, j) => {
      const angle = Math.PI / 2 + (j * Math.PI) / 5,
        r = j % 2 ? 0.43 : 1;
      return [r * Math.cos(angle), r * Math.sin(angle)] as const;
    });
  return Array.from({ length: 256 }, (_, j) => {
    const t = (Math.PI * 2 * j) / 256;
    if (dimension === 3) {
      if (id === 'cinquefoil')
        return [
          (0.72 + 0.28 * Math.cos(5 * t)) * Math.cos(3 * t),
          (0.72 + 0.28 * Math.cos(5 * t)) * Math.sin(3 * t),
          0.42 * Math.sin(5 * t),
        ] as const;
      if (id === 'lissajous')
        return [Math.sin(3 * t), Math.sin(4 * t + 0.4), Math.sin(5 * t)] as const;
      if (id === 'tilted') return [Math.cos(t), 0.7 * Math.sin(t), 0.7 * Math.sin(t)] as const;
      return [
        (0.72 + 0.25 * Math.cos(3 * t)) * Math.cos(2 * t),
        (0.72 + 0.25 * Math.cos(3 * t)) * Math.sin(2 * t),
        0.35 * Math.sin(3 * t),
      ] as const;
    }
    if (id === 'circle') return [Math.cos(t), Math.sin(t)] as const;
    if (id === 'ellipse') return [Math.cos(t), 0.6 * Math.sin(t)] as const;
    if (id === 'flower') {
      const r = 0.7 + 0.24 * Math.cos(5 * t);
      return [r * Math.cos(t), r * Math.sin(t)] as const;
    }
    return [
      Math.sin(t) ** 3,
      (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
    ] as const;
  });
}
