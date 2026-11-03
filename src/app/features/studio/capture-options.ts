import { Component, input, output } from '@angular/core';
import { OptionStrip } from './option-strip';
import { CaptureSettings } from './capture-scene';
@Component({
  selector: 'studio-capture-options',
  imports: [OptionStrip],
  templateUrl: './capture-options.html',
  styleUrl: './capture-options.scss',
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
