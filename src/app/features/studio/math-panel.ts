import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { StudioStore } from './studio-store';
import { StudioIcon } from './studio-icon';

@Component({
  selector: 'studio-math-panel',
  imports: [DecimalPipe, StudioIcon],
  template: `
    @if (store.mathOpen()) {
      <section id="animation-math" aria-labelledby="math-title" class="math-panel" tabindex="0">
        <header>
          <h2 id="math-title">Matemática en movimiento</h2>
          <span>{{ store.project().dimension }}D</span>
        </header>
        @if (data(); as d) {
          <p class="equation">p(t) = c₀ + Σ vₖ(t)</p>
          <p class="explanation">
            Cada componente aporta un movimiento periódico. Su suma sitúa el lápiz.
          </p>
          <dl class="metrics">
            <div>
              <dt>Fase del ciclo · t</dt>
              <dd data-testid="math-phase">{{ d.phase | number: '1.3-3' }}</dd>
            </div>
            <div>
              <dt>Ángulo · 2πt</dt>
              <dd data-testid="math-angle">{{ d.angle | number: '1.1-1' }}°</dd>
            </div>
            <div>
              <dt>Período del reloj</dt>
              <dd data-testid="math-period">{{ d.period | number: '1.2-2' }} s</dd>
            </div>
            <div>
              <dt>Frecuencia base</dt>
              <dd>{{ d.frequency | number: '1.3-3' }} Hz</dd>
            </div>
            <div>
              <dt>
                {{
                  store.project().dimension === 2
                    ? 'Epiciclos seleccionados'
                    : 'Componentes seleccionados'
                }}
              </dt>
              <dd>{{ d.components }}</dd>
            </div>
            <div>
              <dt>Armónico máximo · |k|</dt>
              <dd>{{ d.maxFrequency }}</dd>
            </div>
          </dl>
          <h3>Posición del lápiz</h3>
          <dl class="coordinates">
            @for (coordinate of d.position; track $index) {
              <div>
                <dt>{{ ['x', 'y', 'z'][$index] }}</dt>
                <dd>{{ coordinate | number: '1.4-4' }}</dd>
              </div>
            }
          </dl>
          <p class="note">Coordenadas de la curva, independientes de la cámara.</p>
          @if (d.hasReference) {
            <dl class="metrics errors">
              <div>
                <dt>Error RMS</dt>
                <dd>{{ d.rms | number: '1.5-5' }}</dd>
              </div>
              <div>
                <dt>Error máximo</dt>
                <dd>{{ d.maxError | number: '1.5-5' }}</dd>
              </div>
            </dl>
          } @else {
            <p class="note">
              Composición manual: no hay una curva original con la que medir el error.
            </p>
          }
          <p class="note">
            Período y frecuencia a la velocidad seleccionada. Los datos se actualizan hasta 10 veces
            por segundo.
          </p>
        } @else {
          <p class="explanation" role="status">Preparando los datos de la curva…</p>
        }
      </section>
    }
    <button
      class="icon-button math-toggle"
      (click)="store.setMathOpen(!store.mathOpen())"
      [attr.aria-expanded]="store.mathOpen()"
      aria-controls="animation-math"
      aria-label="Datos matemáticos"
      title="Datos matemáticos"
      data-tooltip="Datos matemáticos"
    >
      <studio-icon name="math" />
    </button>
  `,
  styleUrl: './math-panel.scss',
})
export class MathPanel {
  readonly store = inject(StudioStore);
  readonly data = computed(() => {
    if (!this.store.mathOpen() || this.store.busy()) return null;
    this.store.revision();
    const project = this.store.project();
    const phase = this.store.phase();
    const terms =
      project.dimension === 2
        ? this.store.terms
        : project.source.kind === 'manual3d'
          ? this.store.circles3
          : this.store.harmonics;
    const period = 8 / project.playback.speed;
    return {
      phase,
      angle: 360 * phase,
      period,
      frequency: 1 / period,
      components: terms.length,
      maxFrequency: terms.reduce((max, term) => Math.max(max, Math.abs(term.frequency)), 0),
      position: this.store.evaluate(phase),
      hasReference: this.store.reference !== null,
      rms: this.store.error.rms,
      maxError: this.store.error.max,
    };
  });
}
