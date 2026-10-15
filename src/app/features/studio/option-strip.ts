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
  template: `
    @if (compact()) {
      <button
        type="button"
        class="compact-choice"
        cdkOverlayOrigin
        #origin="cdkOverlayOrigin"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="pickerOpen()"
        (click)="pickerOpen.set(!pickerOpen())"
        title="Elegir velocidad"
      >
        <studio-icon name="speed" /><span>{{ value() }}×</span>
      </button>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="pickerOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayPush]="true"
        [cdkConnectedOverlayViewportMargin]="8"
        [cdkConnectedOverlayHasBackdrop]="true"
        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
        (backdropClick)="pickerOpen.set(false)"
        (overlayKeydown)="dismiss($event)"
      >
        <div
          class="option-popover"
          role="dialog"
          [attr.aria-label]="label()"
          aria-modal="true"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
        >
          <p>{{ label() }}</p>
          <ng-container [ngTemplateOutlet]="choices" />
        </div>
      </ng-template>
    } @else {
      <div class="choice-label">{{ label() }}</div>
      <ng-container [ngTemplateOutlet]="choices" />
    }
    <ng-template #choices>
      <div class="choice-row" role="group" [attr.aria-label]="label()">
        @for (option of options(); track option.value) {
          <button
            type="button"
            class="visual-choice"
            cdkOverlayOrigin
            #anchor="cdkOverlayOrigin"
            [class.chosen]="same(option.value)"
            [attr.aria-pressed]="selectable() ? same(option.value) : null"
            [attr.aria-label]="option.label"
            [disabled]="option.disabled"
            (click)="choose(option.value)"
            (mouseenter)="showHover(option.value)"
            (mouseleave)="hovered.set(null)"
            (focus)="showFocus(option.value)"
            (blur)="hovered.set(null)"
          >
            @if (option.color) {
              <span class="color-swatch" [style.background]="option.color"></span>
            } @else {
              <studio-icon [name]="option.icon ?? 'settings'" />
            }
            @if (option.badge) {
              <span class="choice-badge">{{ option.badge }}</span>
            }
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="anchor"
            [cdkConnectedOverlayUsePopover]="'inline'"
            [cdkConnectedOverlayOpen]="hovered() === option.value"
            [cdkConnectedOverlayPositions]="positions"
            [cdkConnectedOverlayPush]="true"
            [cdkConnectedOverlayViewportMargin]="8"
          >
            <div class="option-tooltip" role="tooltip">{{ option.label }}</div>
          </ng-template>
        }
      </div>
    </ng-template>
  `,
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
