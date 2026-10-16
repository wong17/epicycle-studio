export function videoMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream)
    return null;
  return (
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'].find((mime) =>
      MediaRecorder.isTypeSupported(mime),
    ) ?? null
  );
}
export function recordCycle(
  canvas: HTMLCanvasElement,
  render: (phase: number) => void,
  signal: AbortSignal,
  durationMs = 8000,
): Promise<Blob> {
  const mime = videoMime();
  if (!mime)
    return Promise.reject(
      new Error('Este navegador no admite grabación de video. Exporta PNG o GLB.'),
    );
  if (signal.aborted) return Promise.reject(new DOMException('Grabación cancelada', 'AbortError'));
  return new Promise((resolve, reject) => {
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(30);
    } catch (error) {
      reject(error);
      return;
    }
    const tracks = stream.getTracks();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    } catch (error) {
      tracks.forEach((t) => t.stop());
      reject(error);
      return;
    }
    const chunks: Blob[] = [];
    let raf = 0,
      start: number | null = null,
      failed = false,
      cleaned = false;
    const clean = () => {
      if (cleaned) return;
      cleaned = true;
      cancelAnimationFrame(raf);
      tracks.forEach((t) => t.stop());
      signal.removeEventListener('abort', cancel);
      document.removeEventListener('visibilitychange', hidden);
    };
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      clean();
      let reason = error;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch (stopError) {
        reason = new AggregateError([error, stopError], 'La grabación falló al detenerse');
      }
      reject(reason);
    };
    const cancel = () =>
      fail(
        new DOMException(
          'Grabación cancelada. Mantén la pestaña visible para grabar.',
          'AbortError',
        ),
      );
    const hidden = () => {
      if (document.hidden) cancel();
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      fail(new Error('El codificador de video falló. Puedes exportar PNG o GLB.'));
    };
    recorder.onstop = () => {
      clean();
      if (!failed) {
        if (chunks.length) resolve(new Blob(chunks, { type: mime }));
        else reject(new Error('La grabación no produjo contenido'));
      }
    };
    signal.addEventListener('abort', cancel, { once: true });
    document.addEventListener('visibilitychange', hidden);
    const frame = (now: number) => {
      if (failed) return;
      if (start === null) start = now;
      const phase = (now - start) / durationMs;
      try {
        render(Math.min(0.99999, phase));
        if (phase >= 1) recorder.stop();
        else raf = requestAnimationFrame(frame);
      } catch (error) {
        fail(error);
        return;
      }
    };
    try {
      render(0);
      if (signal.aborted) {
        cancel();
        return;
      }
      recorder.start(200);
      raf = requestAnimationFrame(frame);
    } catch (error) {
      fail(error);
    }
  });
}
