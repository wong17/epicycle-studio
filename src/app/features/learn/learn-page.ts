import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { evaluate2D, TAU } from '../../domain/fourier/math';
@Component({
  selector: 'app-learn-page',
  imports: [RouterLink],
  template: `<main>
    <a routerLink="/studio/2d">← Volver al estudio</a
    ><span class="eyebrow">EL ARTE DE SUMAR MOVIMIENTOS</span>
    <h1>Todo empieza<br />con un círculo.</h1>
    <p class="intro">
      Una curva compleja puede ser la suma de movimientos muy simples. Los epiciclos te dejan ver
      esa idea, un giro a la vez.
    </p>
    <canvas #canvas aria-label="Demostración de dos frecuencias circulares"></canvas
    ><label
      >Radio del segundo círculo · {{ radius()
      }}<input
        #typedControl1
        type="range"
        min="0"
        max="0.6"
        step="0.01"
        [value]="radius()"
        (input)="radius.set(+typedControl1.value); draw()" /></label
    ><label
      >Frecuencia · {{ frequency() }} vueltas/ciclo<input
        #typedControl2
        type="range"
        min="1"
        max="8"
        step="1"
        [value]="frequency()"
        (input)="frequency.set(+typedControl2.value); draw()"
    /></label>
    <div class="lessons">
      <article>
        <b>01 / Amplitud</b>
        <h2>El tamaño de cada giro</h2>
        <p>
          El radio mide cuánto aporta un círculo al dibujo. Un radio grande describe el gesto
          principal; radios pequeños completan detalles.
        </p>
      </article>
      <article>
        <b>02 / Frecuencia</b>
        <h2>El ritmo del movimiento</h2>
        <p>
          La frecuencia indica vueltas por ciclo. Una frecuencia negativa gira en sentido contrario.
          Las frecuencias enteras cierran la trayectoria al terminar el ciclo.
        </p>
      </article>
      <article>
        <b>03 / Fase y centro</b>
        <h2>Dónde empieza todo</h2>
        <p>
          La fase es el ángulo inicial. El término constante mueve el dibujo completo y no cuenta
          como un epiciclo.
        </p>
      </article>
      <article>
        <b>04 / Precisión</b>
        <h2>Elegir qué conservar</h2>
        <p>
          La DFT encuentra los coeficientes que reconstruyen muestras de tu curva; la FFT calcula
          esa misma transformación de forma eficiente. El estudio remuestrea por longitud y conserva
          el cierre que elegiste.
        </p>
      </article>
      <article>
        <b>05 / Espacio</b>
        <h2>Más allá del papel</h2>
        <p>
          En tres dimensiones cada armónico dibuja una elipse espacial. Dos círculos
          contrarrotatorios en el mismo plano reproducen exactamente ese movimiento. El tubo
          envuelve la curva; JSON conserva su edición.
        </p>
      </article>
      <article>
        <b>06 / Tus datos</b>
        <h2>Un estudio local</h2>
        <p>
          Guardar usa el almacenamiento de este navegador. Borrar datos del navegador elimina las
          copias locales: descarga JSON para trasladar y conservar tus creaciones. PNG, SVG y GLB
          son resultados visuales.
        </p>
      </article>
    </div>
    <a class="cta" routerLink="/studio/2d">Crear mi primera curva →</a>
  </main>`,
  styles: `
    :host {
      display: block;
      background: #151515;
      color: #ededed;
      min-height: 100vh;
    }
    main {
      max-width: 1000px;
      margin: auto;
      padding: 38px 24px 80px;
    }
    a {
      color: #d4f477;
      text-decoration: none;
      font-size: 13px;
    }
    .eyebrow {
      display: block;
      font-size: 10px;
      letter-spacing: 3px;
      color: #adadad;
      margin-top: 70px;
    }
    h1 {
      font: clamp(46px, 8vw, 88px)/1.05 Georgia;
      letter-spacing: -2px;
      margin: 22px 0;
    }
    .intro {
      max-width: 570px;
      font-size: 18px;
      line-height: 1.7;
      color: #adadad;
    }
    canvas {
      width: 100%;
      height: 340px;
      display: block;
      background: #222222;
      border: 1px solid #3b3b3b;
      border-radius: 10px;
      margin: 35px 0;
    }
    label {
      display: block;
      font-size: 13px;
      color: #adadad;
      margin: 18px 0;
    }
    input {
      display: block;
      width: 100%;
      max-width: 500px;
      margin-top: 10px;
    }
    .lessons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 35px;
      margin-top: 60px;
    }
    article {
      border-top: 1px solid #3b3b3b;
      padding-top: 24px;
    }
    article b {
      font: 11px Consolas;
      color: #d4f477;
    }
    h2 {
      font: 25px Georgia;
    }
    article p {
      font-size: 14px;
      line-height: 1.8;
      color: #adadad;
    }
    .cta {
      display: inline-block;
      margin-top: 45px;
      padding: 15px 22px;
      border: 1px solid #d4f477;
      border-radius: 6px;
    }
    @media (max-width: 600px) {
      .lessons {
        grid-template-columns: 1fr;
      }
      canvas {
        height: 260px;
      }
    }
  `,
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
