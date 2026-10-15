import { it, expect } from 'vitest';
import { PlaybackClock } from './playback-clock';
import { History } from './history';
it('phaseIsIndependentOfFrameRate', () => {
  for (const fps of [30, 60, 120]) {
    const clock = new PlaybackClock();
    clock.play();
    clock.tick(0);
    for (let j = 1; j <= fps * 2; j++) clock.tick((j * 1000) / fps);
    expect(clock.phase).toBeCloseTo(0.25, 10);
    clock.pause();
    clock.tick(99999);
    expect(clock.phase).toBeCloseTo(0.25, 10);
    clock.seek(0.8);
    clock.play();
    clock.tick(99999);
    expect(clock.phase).toBeCloseTo(0.8, 10);
    clock.reset();
    expect(clock.phase).toBe(0);
  }
});
it('limitsInterruptedFrameDelta', () => {
  const clock = new PlaybackClock();
  clock.play();
  clock.tick(0);
  clock.tick(10000);
  expect(clock.phase).toBe(0.0125);
});
it('undoRedoDropsOnlyNewBranch', () => {
  const h = new History<number>();
  h.push(1);
  h.push(2);
  expect(h.undo(3)).toBe(2);
  expect(h.redo(2)).toBe(3);
  expect(h.undo(3)).toBe(2);
  h.push(2);
  expect(h.redo(4)).toBeUndefined();
});
