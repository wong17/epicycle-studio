import { describe, expect, it } from 'vitest';
import { readPhotoMetadata } from './photo-metadata';
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
function jpeg(width: number, height: number, marker = 0xc0): Uint8Array {
  // A camera APP1 segment, fill marker bytes, then a three-component SOF.
  const bytes = new Uint8Array([
    255,
    216,
    255,
    225,
    0,
    8,
    69,
    120,
    105,
    102,
    0,
    0,
    255,
    255,
    marker,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    17,
    0,
    2,
    17,
    1,
    3,
    17,
    1,
    255,
    217,
  ]);
  return bytes;
}
function webp(width: number, height: number, kind: 'VP8 ' | 'VP8L' | 'VP8X'): Uint8Array {
  const length = kind === 'VP8L' ? 5 : 10,
    bytes = new Uint8Array(20 + length + (length % 2)),
    view = new DataView(bytes.buffer);
  bytes.set([82, 73, 70, 70]);
  view.setUint32(4, bytes.length - 8, true);
  bytes.set([87, 69, 66, 80], 8);
  bytes.set(
    [...kind].map((c) => c.charCodeAt(0)),
    12,
  );
  view.setUint32(16, length, true);
  if (kind === 'VP8 ') {
    bytes.set([0, 0, 0, 157, 1, 42], 20);
    view.setUint16(26, width, true);
    view.setUint16(28, height, true);
  } else if (kind === 'VP8X') {
    const w = width - 1,
      h = height - 1;
    bytes.set([w & 255, (w >> 8) & 255, (w >> 16) & 255], 24);
    bytes.set([h & 255, (h >> 8) & 255, (h >> 16) & 255], 27);
  } else {
    const w = width - 1,
      h = height - 1;
    bytes.set([47, w & 255, ((w >> 8) & 63) | ((h & 3) << 6), (h >> 2) & 255, (h >> 10) & 15], 20);
  }
  return bytes;
}
const formats = [
  { label: 'PNG', mime: 'image/png', make: png },
  { label: 'camera baseline JPEG', mime: 'image/jpeg', make: (w: number, h: number) => jpeg(w, h) },
  {
    label: 'camera progressive JPEG',
    mime: 'image/jpeg',
    make: (w: number, h: number) => jpeg(w, h, 0xc2),
  },
  { label: 'WebP VP8', mime: 'image/webp', make: (w: number, h: number) => webp(w, h, 'VP8 ') },
  { label: 'WebP VP8L', mime: 'image/webp', make: (w: number, h: number) => webp(w, h, 'VP8L') },
  { label: 'WebP VP8X', mime: 'image/webp', make: (w: number, h: number) => webp(w, h, 'VP8X') },
];
describe('readPhotoMetadata', () => {
  it.each(formats)('accepts exact dimension boundaries for $label', ({ mime, make }) => {
    expect(readPhotoMetadata(make(4096, 2), mime)).toEqual({ width: 4096, height: 2 });
    expect(readPhotoMetadata(make(2, 4096), mime)).toEqual({ width: 2, height: 4096 });
  });
  it.each(formats)(
    'rejects immediately excessive and undersized dimensions for $label',
    ({ mime, make }) => {
      for (const [width, height] of [
        [4097, 2],
        [2, 4097],
        [1, 2],
        [2, 1],
      ])
        expect(() => readPhotoMetadata(make(width, height), mime)).toThrow(/4096|dimensiones/);
    },
  );
  it.each(formats)('rejects truncated headers for $label', ({ mime, make }) => {
    const bytes = make(64, 32);
    for (const length of [0, 1, 4, 12, 18, 22])
      expect(() => readPhotoMetadata(bytes.subarray(0, length), mime)).toThrow(
        /imagen|cabecera|JPEG|WebP|PNG/,
      );
  });
  it('rejects JPEG segment overflow and missing frame metadata', () => {
    for (const bytes of [
      new Uint8Array([255, 216, 255, 225, 255, 255]),
      new Uint8Array([255, 216, 255, 225, 0, 1]),
      new Uint8Array([255, 216, 255, 217]),
      new Uint8Array([255, 216, 255, 218, 0, 2]),
    ])
      expect(() => readPhotoMetadata(bytes, 'image/jpeg')).toThrow(/JPEG|cabecera/);
  });
  it('rejects zero JPEG components and truncated SOF component entries', () => {
    const empty = jpeg(64, 32);
    empty[22] = 0;
    expect(() => readPhotoMetadata(empty, 'image/jpeg')).toThrow(/JPEG|cabecera/);
    const short = jpeg(64, 32);
    short[16] = 8;
    expect(() => readPhotoMetadata(short, 'image/jpeg')).toThrow(/JPEG|cabecera/);
  });
  it('rejects WebP chunk and RIFF overflow without out-of-bounds reads', () => {
    const chunk = webp(64, 32, 'VP8X');
    new DataView(chunk.buffer).setUint32(16, 0xffffffff, true);
    expect(() => readPhotoMetadata(chunk, 'image/webp')).toThrow(/WebP|cabecera/);
    const riff = webp(64, 32, 'VP8L');
    new DataView(riff.buffer).setUint32(4, 0xffffffff, true);
    expect(() => readPhotoMetadata(riff, 'image/webp')).toThrow(/WebP|cabecera/);
  });
  it('rejects extreme extended WebP canvas dimensions before decode', () => {
    expect(() => readPhotoMetadata(webp(0x1000000, 16, 'VP8X'), 'image/webp')).toThrow(/4096/);
  });
  it('rejects invalid WebP bitstream signatures and unsupported lossless versions', () => {
    const lossy = webp(64, 32, 'VP8 ');
    lossy[23] = 0;
    expect(() => readPhotoMetadata(lossy, 'image/webp')).toThrow(/WebP/);
    const lossless = webp(64, 32, 'VP8L');
    lossless[24] |= 32;
    expect(() => readPhotoMetadata(lossless, 'image/webp')).toThrow(/WebP/);
  });
  it('rejects mismatched MIME and malformed PNG IHDR headers', () => {
    expect(() => readPhotoMetadata(png(64, 32), 'image/jpeg')).toThrow(/JPEG/);
    const bytes = png(64, 32);
    bytes[12] = 0;
    expect(() => readPhotoMetadata(bytes, 'image/png')).toThrow(/PNG/);
    expect(() => readPhotoMetadata(png(64, 32), 'image/gif')).toThrow(/JPEG|PNG|WebP/);
  });
  it('does not depend on the input view starting at buffer offset zero', () => {
    const source = jpeg(3000, 2000),
      bytes = new Uint8Array(source.length + 8);
    bytes.set(source, 4);
    expect(readPhotoMetadata(bytes.subarray(4, 4 + source.length), 'image/jpeg')).toEqual({
      width: 3000,
      height: 2000,
    });
  });
});
