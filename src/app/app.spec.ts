import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { it, expect } from 'vitest';
import { App } from './app';
it('providesApplicationRouterOutlet', () => {
  TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
});
