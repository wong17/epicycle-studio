import { Component, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { StudioIcon } from './studio-icon';

export interface VisualChoice {
  value: string | number;
  label: string;
  icon?: string;
  badge?: string;
  color?: string;
  disabled?: boolean;
}
@Component({
  selector: 'studio-options',
  imports: [StudioIcon, NgTemplateOutlet, CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus],
  templateUrl: './option-strip.html',
  styleUrl: './option-strip.scss',
})
export class OptionStrip {
  readonly label = input.required<string>();
  readonly options = input.required<readonly VisualChoice[]>();
  readonly value = input<string | number>('');
  readonly selectable = input(true);
  readonly compact = input(false);
  readonly valueChange = output<string>();
  readonly hovered = signal<string | number | null>(null);
  readonly pickerOpen = signal(false);
  readonly positions: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
  same(value: string | number): boolean {
    return this.selectable() && String(value) === String(this.value());
  }
  showHover(value: string | number): void {
    if (window.matchMedia('(hover: hover)').matches) this.hovered.set(value);
  }
  showFocus(value: string | number): void {
    if (
      window.matchMedia('(hover: hover)').matches ||
      document.activeElement?.matches(':focus-visible')
    )
      this.hovered.set(value);
  }
  choose(value: string | number): void {
    this.hovered.set(null);
    this.pickerOpen.set(false);
    this.valueChange.emit(String(value));
  }
  dismiss(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.hovered.set(null);
      this.pickerOpen.set(false);
    }
  }
}
