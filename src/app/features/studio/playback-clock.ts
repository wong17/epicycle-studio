export class PlaybackClock {
  phase = 0;
  playing = false;
  speed = 1;
  private last: number | null = null;
  play(): void {
    this.playing = true;
    this.last = null;
  }
  pause(): void {
    this.playing = false;
    this.last = null;
  }
  seek(phase: number): void {
    this.phase = ((phase % 1) + 1) % 1;
    this.last = null;
  }
  setSpeed(speed: number): void {
    if (speed < 0.25 || speed > 4 || !Number.isFinite(speed)) throw new Error('SPEED');
    this.speed = speed;
  }
  reset(): void {
    this.seek(0);
  }
  tick(now: number): number {
    if (this.playing) {
      if (this.last !== null)
        this.phase =
          (this.phase + (Math.min(100, Math.max(0, now - this.last)) * this.speed) / 8000) % 1;
      this.last = now;
    }
    return this.phase;
  }
  dispose(): void {
    this.pause();
  }
}
