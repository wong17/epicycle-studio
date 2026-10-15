import FFT from 'fft.js';
import { FourierBackend } from '../model';
export class FftJsBackend implements FourierBackend {
  forwardComplex(input: Float64Array): Float64Array {
    const n = input.length / 2;
    if (!Number.isInteger(n) || n < 2 || (n & (n - 1)) !== 0) throw new Error('COUNT');
    const fft = new FFT(n),
      output = new Float64Array(input.length);
    fft.transform(output, input);
    return output;
  }
}
