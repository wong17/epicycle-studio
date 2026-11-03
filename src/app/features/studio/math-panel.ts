import { StudioTooltip } from './studio-tooltip';
import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { StudioStore } from './studio-store';
import { StudioIcon } from './studio-icon';

@Component({
  selector: 'studio-math-panel',
  imports: [DecimalPipe, StudioIcon, StudioTooltip],
  templateUrl: './math-panel.html',
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
