import { it, expect, vi, afterEach } from 'vitest';
import { WorkerClient } from './worker-client';
import { prepareCurve } from '../../domain/curves/prepare-curve';
const prepared = () =>
  prepareCurve(
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    2,
    'segment',
    256,
  );
class TestWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
}
afterEach(() => vi.unstubAllGlobals());
it('ignoresStaleResponse', async () => {
  vi.stubGlobal('Worker', TestWorker);
  const workers: TestWorker[] = [],
    client = new WorkerClient(() => {
      const w = new TestWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
  const a = client.analyze(prepared()),
    b = client.analyze(prepared());
  expect(await a).toEqual({ status: 'cancelled' });
  const job = workers[1].postMessage.mock.calls[0][0].jobId;
  workers[0].onmessage?.({ data: { jobId: job - 2, status: 'success', value: 'stale' } });
  workers[1].onmessage?.({ data: { jobId: job, status: 'success', value: 'current' } });
  expect(await b).toEqual({ status: 'ok', value: 'current' });
  expect(workers[0].terminate).toHaveBeenCalled();
  client.dispose();
});
it('transferDoesNotDetachDocument', async () => {
  vi.stubGlobal('Worker', TestWorker);
  const w = new TestWorker(),
    client = new WorkerClient(() => w as unknown as Worker),
    p = prepared(),
    pending = client.analyze(p),
    message = w.postMessage.mock.calls[0][0];
  expect(message.prepared.samples.coordinates.buffer).not.toBe(p.samples.coordinates.buffer);
  client.dispose();
  expect(await pending).toEqual({ status: 'cancelled' });
  expect(p.samples.coordinates.length).toBe(512);
});
it('workerFailureRejectsAndDisposeStopsDelivery', async () => {
  vi.stubGlobal('Worker', TestWorker);
  const w = new TestWorker(),
    client = new WorkerClient(() => w as unknown as Worker),
    p = client.analyze(prepared()),
    job = w.postMessage.mock.calls[0][0].jobId;
  w.onmessage?.({ data: { jobId: job, status: 'failure', message: 'failure' } });
  await expect(p).rejects.toThrow('failure');
  client.dispose();
  expect(await client.analyze(prepared())).toEqual({ status: 'cancelled' });
});
it('fallbackLimitsSampleCount', async () => {
  vi.stubGlobal('Worker', undefined);
  const client = new WorkerClient();
  expect((await client.analyze(prepared())).status).toBe('ok');
  await expect(
    client.analyze(
      prepareCurve(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        2,
        'segment',
        512,
      ),
    ),
  ).rejects.toThrow('256');
});
it('staleErrorCannotTerminateCurrentWorker', async () => {
  vi.stubGlobal('Worker', TestWorker);
  const workers: TestWorker[] = [],
    client = new WorkerClient(() => {
      const w = new TestWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
  const first = client.analyze(prepared()),
    second = client.analyze(prepared());
  expect(await first).toEqual({ status: 'cancelled' });
  workers[0].onerror?.();
  expect(workers[1].terminate).not.toHaveBeenCalled();
  const job = workers[1].postMessage.mock.calls[0][0].jobId;
  workers[1].onmessage?.({ data: { jobId: job, status: 'success', value: 'latest' } });
  expect(await second).toEqual({ status: 'ok', value: 'latest' });
  client.dispose();
});
// Regression verifies all terminal paths against current job identity.
