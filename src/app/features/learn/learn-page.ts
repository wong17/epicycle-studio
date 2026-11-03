import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { evaluate2D, TAU } from '../../domain/fourier/math';
@Component({
  selector: 'app-learn-page',
  imports: [RouterLink],
  templateUrl: './learn-page.html',
  styleUrl: './learn-page.scss',
})
export class LearnPage implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  radius = signal(0.3);
  frequency = signal(3);
  private observer: ResizeObserver | null = null;
  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this.canvas.nativeElement);
    this.draw();
  }
  draw(): void {
    const canvas = this.canvas.nativeElement,
      w = canvas.clientWidth,
      h = canvas.clientHeight,
      dpr = Math.min(devicePixelRatio, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext('2d')!;
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#d4f477';
    c.lineWidth = 2;
    c.beginPath();
    for (let j = 0; j <= 1024; j++) {
      const p = evaluate2D(
          [0, 0],
          [
            { frequency: 1, radius: 0.65, phase: 0 },
            { frequency: -this.frequency(), radius: this.radius(), phase: 0 },
          ],
          j / 1024,
        ),
        x = w / 2 + p[0] * h * 0.38,
        y = h / 2 - p[1] * h * 0.38;
      if (j) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
    c.strokeStyle = '#6b6b6b';
    c.beginPath();
    c.arc(w / 2, h / 2, h * 0.38 * 0.65, 0, TAU);
    c.stroke();
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
