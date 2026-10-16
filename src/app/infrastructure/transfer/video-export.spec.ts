import { afterEach, expect, it, vi } from 'vitest';
import { recordCycle } from './video-export';

const captureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'captureStream',
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (captureDescriptor)
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', captureDescriptor);
  else Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream');
});

it.each(['render', 'start'] as const)(
  'recordingStartupFailureReleasesTracksAndListeners-%s',
  async (stage) => {
    const stopTrack = vi.fn();
    const start = vi.fn(() => {
      if (stage === 'start') throw new Error('Start failed');
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      start = start;
      stop = vi.fn();
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const capture = vi.fn(() => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      value: capture,
    });
    const controller = new AbortController();
    const removeAbort = vi.spyOn(controller.signal, 'removeEventListener');
    const removeVisibility = vi.spyOn(document, 'removeEventListener');
    const render = () => {
      if (stage === 'render') throw new Error('Render failed');
    };
    await expect(
      recordCycle(document.createElement('canvas'), render, controller.signal),
    ).rejects.toThrow(stage === 'render' ? 'Render failed' : 'Start failed');
    expect(capture).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(removeAbort).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  },
);
