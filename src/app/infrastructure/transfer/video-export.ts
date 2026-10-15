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
      failed = false;
    const clean = () => {
      cancelAnimationFrame(raf);
      tracks.forEach((t) => t.stop());
      signal.removeEventListener('abort', cancel);
      document.removeEventListener('visibilitychange', hidden);
    };
    const cancel = () => {
      failed = true;
      clean();
      if (recorder.state !== 'inactive') recorder.stop();
      reject(
        new DOMException(
          'Grabación cancelada. Mantén la pestaña visible para grabar.',
          'AbortError',
        ),
      );
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      failed = true;
      clean();
      reject(new Error('El codificador de video falló. Puedes exportar PNG o GLB.'));
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
      if (start === null) start = now;
      const phase = (now - start) / durationMs;
      try {
        render(Math.min(0.99999, phase));
      } catch (error) {
        failed = true;
        clean();
        recorder.stop();
        reject(error);
        return;
      }
      if (phase >= 1) recorder.stop();
      else raf = requestAnimationFrame(frame);
    };
    render(0);
    recorder.start(200);
    raf = requestAnimationFrame(frame);
  });
}
