export interface PhotoMetadata {
  width: number;
  height: number;
}

/** Reads allocation bounds before invoking a browser image decoder. No pixel decode. */
export function readPhotoMetadata(bytes: Uint8Array, type: string): PhotoMetadata {
  let metadata: PhotoMetadata;
  if (type === 'image/png') metadata = pngMetadata(bytes);
  else if (type === 'image/jpeg') metadata = jpegMetadata(bytes);
  else if (type === 'image/webp') metadata = webpMetadata(bytes);
  else throw new Error('Selecciona una imagen JPEG, PNG o WebP.');
  if (metadata.width < 2 || metadata.height < 2 || metadata.width > 4096 || metadata.height > 4096)
    throw new Error('Dimensiones de imagen no válidas: entre 2 y 4096 píxeles por lado.');
  return metadata;
}

function invalid(format: string): Error {
  return new Error(`La cabecera de la imagen ${format} está incompleta o no es válida.`);
}
function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function matches(bytes: Uint8Array, offset: number, values: readonly number[]): boolean {
  return values.every((value, index) => bytes[offset + index] === value);
}
function pngMetadata(bytes: Uint8Array): PhotoMetadata {
  if (
    bytes.length < 33 ||
    !matches(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10]) ||
    !matches(bytes, 8, [0, 0, 0, 13, 73, 72, 68, 82])
  )
    throw invalid('PNG');
  const data = view(bytes);
  return { width: data.getUint32(16), height: data.getUint32(20) };
}

function jpegMetadata(bytes: Uint8Array): PhotoMetadata {
  if (bytes.length < 4 || !matches(bytes, 0, [255, 216])) throw invalid('JPEG');
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 255) throw invalid('JPEG');
    // Fill bytes are legal between JPEG markers, including camera APP metadata.
    while (offset < bytes.length && bytes[offset] === 255) offset++;
    if (offset >= bytes.length) throw invalid('JPEG');
    const marker = bytes[offset++];
    // Entropy-coded scan data cannot precede the frame header.
    if (marker === 0 || marker === 216 || marker === 217 || marker === 218) throw invalid('JPEG');
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) throw invalid('JPEG');
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) throw invalid('JPEG');
    const frame = marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);
    if (frame) {
      if (length < 8) throw invalid('JPEG');
      const components = bytes[offset + 7];
      if (!components || length < 8 + 3 * components) throw invalid('JPEG');
      return {
        width: bytes[offset + 5] * 256 + bytes[offset + 6],
        height: bytes[offset + 3] * 256 + bytes[offset + 4],
      };
    }
    offset += length;
  }
  throw invalid('JPEG');
}

// WebP layouts follow the Google WebP RIFF container / lossless bitstream specs.
function webpMetadata(bytes: Uint8Array): PhotoMetadata {
  if (
    bytes.length < 20 ||
    !matches(bytes, 0, [82, 73, 70, 70]) ||
    !matches(bytes, 8, [87, 69, 66, 80])
  )
    throw invalid('WebP');
  const data = view(bytes);
  const end = data.getUint32(4, true) + 8;
  if (end > bytes.length || end < 20 || end % 2) throw invalid('WebP');
  let offset = 12;
  while (offset + 8 <= end) {
    const length = data.getUint32(offset + 4, true);
    const payload = offset + 8;
    const next = payload + length + (length % 2);
    if (next > end) throw invalid('WebP');
    if (matches(bytes, offset, [86, 80, 56, 88])) {
      if (length !== 10) throw invalid('WebP');
      const uint24 = (index: number) =>
        bytes[index] + 256 * bytes[index + 1] + 65536 * bytes[index + 2];
      return { width: 1 + uint24(payload + 4), height: 1 + uint24(payload + 7) };
    }
    if (matches(bytes, offset, [86, 80, 56, 76])) {
      if (length < 5 || bytes[payload] !== 47 || bytes[payload + 4] >> 5) throw invalid('WebP');
      return {
        width: 1 + bytes[payload + 1] + ((bytes[payload + 2] & 63) << 8),
        height:
          1 +
          (bytes[payload + 2] >> 6) +
          (bytes[payload + 3] << 2) +
          ((bytes[payload + 4] & 15) << 10),
      };
    }
    if (matches(bytes, offset, [86, 80, 56, 32])) {
      if (length < 10 || bytes[payload] & 1 || !matches(bytes, payload + 3, [157, 1, 42]))
        throw invalid('WebP');
      return {
        width: data.getUint16(payload + 6, true) & 16383,
        height: data.getUint16(payload + 8, true) & 16383,
      };
    }
    offset = next;
  }
  throw invalid('WebP');
}
