/// <reference lib="webworker" />
import { traceRaster } from '../../domain/image-tracing/trace-raster';
import { PhotoRequest, PhotoResponse } from './photo-protocol';
addEventListener('message', ({ data }: MessageEvent<PhotoRequest>) => {
  let response: PhotoResponse;
  try {
    response = {
      jobId: data.jobId,
      status: 'success',
      points: traceRaster(data.raster, data.options),
    };
  } catch (error) {
    response = {
      jobId: data.jobId,
      status: 'failure',
      message: error instanceof Error ? error.message : 'No se pudo convertir la imagen.',
    };
  }
  postMessage(response);
});
