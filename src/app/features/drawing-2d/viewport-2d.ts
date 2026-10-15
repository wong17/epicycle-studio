import { Vec2 } from '../../domain/model';
export class Viewport2D {
  width = 1;
  height = 1;
  zoom = 1;
  center: Vec2 = [0, 0];
  scale = 1;
  fit(points: Float64Array, dimension: number): void {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < points.length; i += dimension) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
    if (!Number.isFinite(minX)) return;
    this.center = [(minX + maxX) / 2, (minY + maxY) / 2];
    this.scale =
      Math.min(this.width / Math.max(maxX - minX, 0.1), this.height / Math.max(maxY - minY, 0.1)) *
      0.65;
    this.zoom = 1;
  }
  worldToScreen(p: Vec2): Vec2 {
    return [
      this.width / 2 + (p[0] - this.center[0]) * this.scale * this.zoom,
      this.height / 2 - (p[1] - this.center[1]) * this.scale * this.zoom,
    ];
  }
  screenToWorld(p: Vec2): Vec2 {
    return [
      (p[0] - this.width / 2) / this.scale / this.zoom + this.center[0],
      -(p[1] - this.height / 2) / this.scale / this.zoom + this.center[1],
    ];
  }
}
