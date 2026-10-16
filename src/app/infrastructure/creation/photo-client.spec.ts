import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoClient, PhotoOptions } from './photo-client';
const options: PhotoOptions = { style: 'continuous', detail: 2, contrast: 1, invert: false };
afterEach(() => vi.unstubAllGlobals());
describe('PhotoClient validation', () => {
  it('rejects unsupported formats before decoding', async () => {
    await expect(
      new PhotoClient().trace(new File(['svg'], 'test.svg', { type: 'image/svg+xml' }), options),
    ).rejects.toThrow(/JPEG|PNG|WebP/);
  });
  it('rejects empty files before decoding', async () => {
    await expect(
      new PhotoClient().trace(new File([], 'empty.png', { type: 'image/png' }), options),
    ).rejects.toThrow(/vacío/i);
  });
  it('rejects files above 12 MiB before decoding', async () => {
    await expect(
      new PhotoClient().trace(
        new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
        options,
      ),
    ).rejects.toThrow(/12/);
  });
  it('rejects invalid options before decoding', async () => {
    await expect(
      new PhotoClient().trace(new File(['content'], 'test.png', { type: 'image/png' }), {
        ...options,
        detail: 9,
      }),
    ).rejects.toThrow(/opciones/i);
  });
  it('rejects corrupt signatures before decoding', async () => {
    const file = new File(['not an image'], 'test.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });
    await expect(new PhotoClient().trace(file, options)).rejects.toThrow(/contenido|imagen/i);
  });
  it.each([
    {
      label: 'JPEG SOF',
      mime: 'image/jpeg',
      bytes: new Uint8Array([
        255, 216, 255, 192, 0, 17, 8, 0, 32, 16, 1, 3, 1, 17, 0, 2, 17, 1, 3, 17, 1,
      ]),
    },
    {
      label: 'WebP canvas',
      mime: 'image/webp',
      bytes: new Uint8Array([
        82, 73, 70, 70, 22, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, 0, 0, 0, 0, 0, 16,
        0, 31, 0, 0,
      ]),
    },
  ])('rejects oversized $label before invoking decoder or worker', async ({ mime, bytes }) => {
    const decode = vi.fn(),
      factory = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const file = new File([bytes], 'oversized', { type: mime });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    await expect(new PhotoClient(factory).trace(file, options)).rejects.toThrow(/4096/);
    expect(decode).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });
  it('rejects disposed clients with an abort error', async () => {
    const client = new PhotoClient();
    client.dispose();
    await expect(
      client.trace(new File(['content'], 'test.png', { type: 'image/png' }), options),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

import { PhotoRequest, PhotoResponse, PhotoWorkerPort } from './photo-protocol';
class TestPhotoWorker implements PhotoWorkerPort {
  onmessage: ((event: MessageEvent<PhotoResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: PhotoRequest[] = [];
  transfers: Transferable[][] = [];
  terminate = vi.fn();
  postMessage(request: PhotoRequest, transfer: Transferable[]): void {
    this.requests.push(request);
    this.transfers.push(transfer);
  }
  respond(data: PhotoResponse): void {
    this.onmessage?.(new MessageEvent<PhotoResponse>('message', { data }));
  }
}
function validFile(): File {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 32);
  const file = new File([bytes], 'sample.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  return file;
}
function decoder(width = 64, height = 32) {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  );
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
      }),
    }),
  });
  return bitmap;
}
describe('PhotoClient jobs', () => {
  it('transfers a downsampled raster and preserves source dimensions', async () => {
    const bitmap = decoder(1024, 512),
      worker = new TestPhotoWorker(),
      client = new PhotoClient(() => worker);
    const pending = client.trace(validFile(), options);
    await vi.waitFor(() => expect(worker.requests.length).toBe(1));
    const request = worker.requests[0];
    expect(request.raster.width).toBe(256);
    expect(request.raster.height).toBe(128);
    expect(worker.transfers[0]).toEqual([request.raster.data.buffer]);
    expect(bitmap.close).toHaveBeenCalledOnce();
    worker.respond({
      jobId: request.jobId,
      status: 'success',
      points: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(await pending).toEqual({
      sourceWidth: 1024,
      sourceHeight: 512,
      points: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('cancels prior workers and ignores stale success and failure', async () => {
    decoder();
    const workers = [new TestPhotoWorker(), new TestPhotoWorker()];
    let next = 0;
    const client = new PhotoClient(() => workers[next++]);
    const first = client.trace(validFile(), options);
    const firstRejection = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(workers[0].requests.length).toBe(1));
    const second = client.trace(validFile(), options);
    await firstRejection;
    await vi.waitFor(() => expect(workers[1].requests.length).toBe(1));
    workers[0].respond({
      jobId: workers[0].requests[0].jobId,
      status: 'success',
      points: [[9, 9]],
    });
    workers[0].onerror?.(new ErrorEvent('error'));
    expect(workers[1].terminate).not.toHaveBeenCalled();
    workers[1].respond({
      jobId: workers[1].requests[0].jobId,
      status: 'success',
      points: [
        [0, 0],
        [1, 0],
      ],
    });
    expect((await second).points).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('settles cancellation while a bitmap is still decoding and closes the late bitmap', async () => {
    let finish: ((value: { width: number; height: number; close: () => void }) => void) | undefined;
    const bitmap = { width: 64, height: 32, close: vi.fn() };
    vi.stubGlobal(
      'createImageBitmap',
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const worker = new TestPhotoWorker(),
      client = new PhotoClient(() => worker),
      pending = client.trace(validFile(), options);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(finish).toBeDefined());
    client.cancel();
    await rejection;
    finish?.(bitmap);
    await vi.waitFor(() => expect(bitmap.close).toHaveBeenCalledOnce());
    expect(worker.requests).toHaveLength(0);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('rejects decoded images above 4096 and closes their bitmap', async () => {
    const bitmap = decoder(4097, 64),
      worker = new TestPhotoWorker(),
      client = new PhotoClient(() => worker);
    await expect(client.trace(validFile(), options)).rejects.toThrow(/4096/);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('reports worker unavailability before image decoding', async () => {
    const bitmap = decoder();
    vi.stubGlobal('Worker', undefined);
    await expect(new PhotoClient().trace(validFile(), options)).rejects.toThrow(/Workers/);
    expect(bitmap.close).not.toHaveBeenCalled();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it('surfaces tracing failures and terminates the worker', async () => {
    decoder();
    const worker = new TestPhotoWorker(),
      client = new PhotoClient(() => worker),
      pending = client.trace(validFile(), options);
    const rejected = expect(pending).rejects.toThrow('detalle');
    await vi.waitFor(() => expect(worker.requests.length).toBe(1));
    worker.respond({ jobId: worker.requests[0].jobId, status: 'failure', message: 'Sin detalle' });
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('attaches worker failure handling before awaiting image decoding', async () => {
    vi.stubGlobal('createImageBitmap', () => new Promise(() => {}));
    const worker = new TestPhotoWorker(),
      client = new PhotoClient(() => worker);
    const pending = client.trace(validFile(), options);
    const rejected = expect(pending).rejects.toThrow(/convertir/);
    await vi.waitFor(() => expect(worker.onerror).not.toBeNull());
    worker.onerror?.(new ErrorEvent('error'));
    await rejected;
  });
});
