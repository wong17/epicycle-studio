import { Component, input, output } from '@angular/core';
import { OptionStrip } from './option-strip';
import { CaptureSettings } from './capture-scene';
@Component({
  selector: 'studio-capture-options',
  imports: [OptionStrip],
  template: `
    <studio-options
      label="Fondo de exportación"
      [options]="video() ? backgrounds : transparentBackgrounds"
      [value]="settings().background"
      (valueChange)="setBackground($event)"
    />
    <label class="grid-option"
      ><input
        #typedControl1
        type="checkbox"
        [checked]="settings().grid"
        (change)="update({ grid: typedControl1.checked })"
      />Incluir cuadrícula</label
    >
    <studio-options
      label="Formato del encuadre"
      [options]="[
        { value: 'landscape', label: 'Horizontal 16:9', icon: 'landscape' },
        { value: 'square', label: 'Cuadrado 1:1', icon: 'square' },
        { value: 'portrait', label: 'Vertical 9:16', icon: 'portrait' },
      ]"
      [value]="settings().aspect"
      (valueChange)="setAspect($event)"
    />
    <studio-options
      label="Encuadre"
      [options]="[
        { value: 'fit', label: 'Ajustar dibujo', icon: 'fit' },
        { value: 'current', label: 'Usar vista actual del editor', icon: 'camera' },
      ]"
      [value]="settings().framing"
      (valueChange)="setFraming($event)"
    />
    <label class="zoom-label"
      >Zoom de exportación <span aria-hidden="true">{{ settings().zoom }}×</span>
      <input
        #typedControl2
        type="range"
        aria-label="Zoom de exportación"
        min="0.25"
        max="3"
        step="0.05"
        [value]="settings().zoom"
        (change)="update({ zoom: +typedControl2.value })"
      />
    </label>
    <label class="zoom-label"
      >Grosor de líneas <span aria-hidden="true">{{ settings().lineWeight }}×</span>
      <input
        #typedControl3
        type="range"
        aria-label="Grosor de líneas"
        min="1"
        max="3"
        step="0.25"
        [value]="settings().lineWeight"
        (change)="update({ lineWeight: +typedControl3.value })"
      />
    </label>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 12px;
        padding-top: 12px;
      }
      .grid-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      .zoom-label {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        font-size: 12px;
        gap: 6px;
      }
      input[type='range'] {
        width: 100%;
        accent-color: var(--accent);
      }
      input[type='checkbox'] {
        accent-color: var(--accent);
      }
      .zoom-label span {
        color: var(--accent);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class CaptureOptions {
  readonly settings = input.required<CaptureSettings>();
  readonly video = input(false);
  readonly settingsChange = output<CaptureSettings>();
  readonly backgrounds = [
    { value: 'dark', label: 'Gris oscuro', color: '#151515' },
    { value: 'black', label: 'Negro', color: '#000000' },
  ];
  readonly transparentBackgrounds = [
    ...this.backgrounds,
    { value: 'transparent', label: 'Transparente', icon: 'transparency' },
  ];
  setBackground(value: string): void {
    if (value === 'dark' || value === 'black' || (value === 'transparent' && !this.video()))
      this.update({ background: value });
  }
  setAspect(value: string): void {
    if (value === 'landscape' || value === 'square' || value === 'portrait')
      this.update({ aspect: value });
  }
  setFraming(value: string): void {
    if (value === 'fit' || value === 'current') this.update({ framing: value });
  }
  update(patch: Partial<CaptureSettings>): void {
    this.settingsChange.emit({ ...this.settings(), ...patch });
  }
}
