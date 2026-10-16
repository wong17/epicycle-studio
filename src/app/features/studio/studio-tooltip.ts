import {
  Component,
  Directive,
  ElementRef,
  Injectable,
  OnDestroy,
  inject,
  input,
  effect,
  untracked,
} from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

@Component({
  selector: 'studio-tooltip-content',
  template: '{{ text() }}',
  host: { role: 'tooltip', '[id]': 'id()' },
  styles: `
    :host {
      display: block;
      padding: 7px 10px;
      max-width: min(260px, calc(100vw - 16px));
      border: 1px solid #555;
      border-radius: 5px;
      background: #303030;
      color: #ededed;
      font:
        11px/1.5 system-ui,
        sans-serif;
      text-align: center;
      overflow-wrap: anywhere;
      pointer-events: none;
    }
  `,
})
class TooltipContent {
  readonly text = input('');
  readonly id = input('');
}

@Injectable({ providedIn: 'root' })
class TooltipLayer {
  private readonly overlay = inject(Overlay);
  private ref: OverlayRef | null = null;
  private anchor: HTMLElement | null = null;
  private description: string | null = null;
  private nextId = 0;
  show(anchor: HTMLElement, text: string): void {
    this.hide();
    const positions: ConnectedPosition[] = anchor.closest('.canvas-toolbar')
      ? [{ originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 }]
      : anchor.closest('.zoom-tools')
        ? [
            {
              originX: 'start',
              originY: 'center',
              overlayX: 'end',
              overlayY: 'center',
              offsetX: -8,
            },
          ]
        : [];
    positions.push(
      { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
      { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    );
    const ref = this.overlay.create({
      usePopover: true,
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(anchor)
        .withPositions(positions)
        .withViewportMargin(8)
        .withPush(true),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    this.ref = ref;
    this.anchor = anchor;
    this.description = anchor.getAttribute('aria-describedby');
    const id = `studio-hint-${++this.nextId}`;
    anchor.setAttribute('aria-describedby', [this.description, id].filter(Boolean).join(' '));
    ref.overlayElement.style.pointerEvents = 'none';
    const content = ref.attach(new ComponentPortal(TooltipContent));
    content.setInput('text', text);
    content.setInput('id', id);
  }
  hide(owner?: HTMLElement): void {
    if (owner && owner !== this.anchor) return;
    if (this.anchor) {
      if (this.description) this.anchor.setAttribute('aria-describedby', this.description);
      else this.anchor.removeAttribute('aria-describedby');
    }
    this.ref?.dispose();
    this.ref = null;
    this.anchor = null;
    this.description = null;
  }
}

@Directive({
  selector: '[data-tooltip]',
  host: {
    '[attr.data-tooltip]': 'text()',
    '(mouseenter)': 'hover()',
    '(mouseleave)': 'leave()',
    '(focusin)': 'focus()',
    '(focusout)': 'blur()',
    '(pointerdown)': 'hide()',
    '(document:keydown.escape)': 'hide()',
  },
})
export class StudioTooltip implements OnDestroy {
  readonly text = input('', { alias: 'data-tooltip' });
  private readonly anchor = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly layer = inject(TooltipLayer);
  private hovered = false;
  private keyboardFocused = false;
  constructor() {
    effect(() => {
      this.text();
      untracked(() => this.hide());
    });
  }
  hover(): void {
    this.hovered = window.matchMedia('(hover: hover)').matches;
    if (this.hovered) this.show();
  }
  leave(): void {
    this.hovered = false;
    if (!this.keyboardFocused) this.hide();
  }
  focus(): void {
    this.keyboardFocused = this.anchor.matches(':focus-visible');
    if (this.keyboardFocused) this.show();
  }
  blur(): void {
    this.keyboardFocused = false;
    if (!this.hovered) this.hide();
  }
  private show(): void {
    if (this.text().trim()) this.layer.show(this.anchor, this.text());
  }
  hide(): void {
    this.layer.hide(this.anchor);
  }
  ngOnDestroy(): void {
    this.hide();
  }
}
