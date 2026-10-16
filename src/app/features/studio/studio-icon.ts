import { getPreset } from '../../domain/curves/presets';
import { Component, input } from '@angular/core';

const paths: Record<string, string> = {
  circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  ellipse: 'M12 6a10 6 0 1 0 0 12 10 6 0 1 0 0-12',
  star: 'M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z',
  heart: 'M12 21C-5 11 4-3 12 7c8-10 17 4 0 14z',
  flower: 'M12 9C4-7 1 9 9 11C-8 11 3 22 10 14C5 30 20 25 14 15C28 25 26 7 16 11C26-2 9-7 12 9z',
  trefoil: 'M12 8C-4-4 0 23 12 15C28 25 29 0 16 7C15-8-3 6 8 13C6 29 28 19 16 11',
  lissajous: 'M3 12C3-3 21 27 21 12S3-3 3 12C3 27 21-3 21 12S3 27 3 12',
  tilted: 'M5 19C-3 11 11-3 19 5S13 27 5 19z',
  perpendicular: 'M3 8l9-5 9 5-9 5zM12 3v18M3 16l9 5 9-5',
  chain:
    'M2 12h20M4 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M20 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  'close-path': 'M4 17L8 4l12 5-4 11zM4 17l12 3',
  'return-path': 'M4 17L8 4l12 5M20 9l-4-1m4 1-2 4M18 14l-8-6-3 11',
  amplitude: 'M4 20V12M9 20V5M14 20V9M19 20V3',
  frequency: 'M3 13c3-12 5 12 8 0s5 12 8 0M3 20h18',
  front: 'M4 4h16v16H4zM4 15h16M9 4v16',
  top: 'M3 9l9-6 9 6-9 6zM3 9v7l9 6 9-6V9',
  side: 'M5 4l14 5v12L5 16zM12 7v12',
  polyline: 'M3 18l5-12 7 9 6-12',
  spline: 'M3 18C8-13 14 33 21 3',
  samples: 'M5 5h1m5 0h1m5 0h1M5 12h1m5 0h1m5 0h1M5 19h1m5 0h1m5 0h1',
  precision: 'M12 3v18M3 12h18M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12',
  speed: 'M3 17a9 9 0 1 1 18 0M7 17h10M12 13l5-6M6 9l1 1M12 4v2',
  math: 'M19 4H5l7 8-7 8h14M19 4v3M19 17v3',
  up: 'M12 20V4M5 11l7-7 7 7',
  down: 'M12 4v16M5 13l7 7 7-7',
  copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
  erase: 'M3 14l9-11 9 8-8 10H9zM7 10l9 8M12 21h10',
  close: 'M6 6l12 12M6 18L18 6',
  collapse: 'M8 5l7 7-7 7',
  pause: 'M8 5v14M16 5v14',
  cursor: 'M5 3l14 9-7 1-3 7z',
  edit: 'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  plane: 'M3 3h18v18H3zM3 12h18M12 3v18',
  cube: 'M12 3l9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9',
  save: 'M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8',
  folder: 'M3 6h7l2 3h9v11H3z',
  import: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  export: 'M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5',
  panel: 'M3 4h18v16H3zM15 4v16M18 8h1m-1 4h1',
  undo: 'M8 4L3 9l5 5M3 9h10a7 7 0 0 1 0 14',
  redo: 'M16 4l5 5-5 5M21 9h-10a7 7 0 0 0 0 14',
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotate: 'M20 7v5h-5M20 12a8 8 0 1 0-2 6',
  play: 'M9 5l10 7-10 7z',
  timeline: 'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4',
  orbit: 'M12 3a9 9 0 1 0 9 9M12 8a4 4 0 1 0 4 4M12 12l7-7M17 3h4v4h-4z',
  curve: 'M3 16C6 1 10 1 12 12s6 14 9-7',
  points: 'M5 5h4v4H5zM15 15h4v4h-4zM9 7h8v8M7 9v8h8',
  image: 'M4 3h16a1 1 0 0 1 1 1v16H3V4a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M15 7h.01',
  vector: 'M5 17C5 3 19 3 19 17M3 15h4v4H3zM17 15h4v4h-4zM10 3h4v4h-4zM7 5h3m4 0h3',
  code: 'M5 3h10l4 4v14H5zM14 3v5h5M10 11l-2 3 2 3m4-6 2 3-2 3',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  video: 'M4 4h16v16H4zM4 8h16M4 16h16M8 4v4m8-4v4M8 16v4m8-4v4M10 10l5 2-5 2z',
  landscape: 'M3 6h18v12H3z',
  square: 'M4 4h16v16H4z',
  portrait: 'M6 3h12v18H6z',
  transparency: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18M3 3l18 18',
  spectrum: 'M12 3a9 9 0 1 0 9 9M12 3v5m0 4 7-7M3 12h5m4 0v9m0-9 7 7M6 6l3 3M6 18l3-3',
  camera: 'M3 7h5l2-3h4l2 3h5v13H3zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6',

  stop: 'M6 6h12v12H6z',
  help: 'M9 8a3 3 0 1 1 5 2l-2 2v2M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
};

// Mathematical thumbnails use the same curves as the actual presets.
for (const name of [
  'circle',
  'ellipse',
  'star',
  'heart',
  'flower',
  'trefoil',
  'cinquefoil',
  'lissajous',
  'tilted',
]) {
  const points = getPreset(
    name,
    ['trefoil', 'cinquefoil', 'lissajous', 'tilted'].includes(name) ? 3 : 2,
  ).filter((_, i, all) => all.length < 64 || i % 4 === 0);
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = 18 / Math.max(maxX - minX, maxY - minY);
  paths[name] =
    points
      .map(
        (p, i) =>
          `${i ? 'L' : 'M'}${(12 + (p[0] - (minX + maxX) / 2) * scale).toFixed(2)} ${(12 - (p[1] - (minY + maxY) / 2) * scale).toFixed(2)}`,
      )
      .join(' ') + 'Z';
}

@Component({
  selector: 'studio-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path" /></svg>',
  styles:
    ':host{display:inline-flex;width:19px;height:19px;flex-shrink:0}svg{width:100%;height:100%}',
})
export class StudioIcon {
  readonly name = input('settings');
  get path(): string {
    return paths[this.name()] ?? paths['settings'];
  }
}
