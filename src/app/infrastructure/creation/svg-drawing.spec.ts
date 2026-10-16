import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSvgDrawing, splitSvgSubpaths } from './svg-drawing';
import { connectStrokes } from '../../domain/creation/continuous-route';

const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${content}</svg>`;

describe('SVG path splitting', () => {
  it('preservesRelativeMovetoAcrossClosedAndOpenSubpaths', () => {
    expect(splitSvgSubpaths('m10 20 5 0z m2 3 l4 5 m1 2h3')).toEqual([
      'M 10 20 l 5 0 Z',
      'M 12 23 l 4 5',
      'M 17 30 h 3',
    ]);
  });
  it('tracksCurveAndArcEndpointsBeforeRelativeMoveto', () => {
    expect(
      splitSvgSubpaths('M0 0 C1 2 3 4 5 6 s1 2 3 4 q1 2 3 4 t2 3 a4 5 30 0 1 6 7 m2 3L40 50')[1],
    ).toBe('M 21 27 L 40 50');
  });
  it('acceptsExponentNumbersWithoutTreatingThemAsCommands', () => {
    expect(splitSvgSubpaths('M1e1-.5L.25 2E+1M0 0L1 1')).toEqual([
      'M 10 -0.5 L 0.25 20',
      'M 0 0 L 1 1',
    ]);
  });
  it.each([
    { name: 'missingMove', data: 'L1 1' },
    { name: 'repeatedComma', data: 'M0,,0L1 1' },
    { name: 'trailingComma', data: 'M0 0L1 1,' },
    { name: 'commaBeforeCommand', data: 'M0 0,L1 1' },
    { name: 'missingCoordinate', data: 'M0 0L1' },
    { name: 'unknownCommand', data: 'M0 0R1 2' },
    { name: 'invalidArcFlag', data: 'M0 0A1 1 0 2 0 3 4' },
    { name: 'negativeArcRadius', data: 'M0 0A-1 1 0 0 0 3 4' },
    { name: 'nonFinite', data: 'M1e999 0' },
    { name: 'numbersAfterClose', data: 'M0 0Z1 2' },
  ])('rejectsInvalidSyntax_$name', ({ data }) => {
    expect(() => splitSvgSubpaths(data)).toThrow();
  });
});

describe('safe SVG drawing import', () => {
  // jsdom has no SVG geometry. This narrow geometry adapter verifies allocation,
  // coordinates and detached-node behavior; the parser itself is tested without mocks.
  const measured: SVGElement[] = [];
  beforeEach(() => {
    measured.length = 0;
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: function (this: SVGElement): number {
        measured.push(this);
        return this.getAttribute('d')?.includes('L 30') ? 30 : 10;
      },
    });
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
      configurable: true,
      value: (distance: number) => ({ x: distance, y: 5 }),
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(SVGElement.prototype, 'getTotalLength');
    Reflect.deleteProperty(SVGElement.prototype, 'getPointAtLength');
    vi.restoreAllMocks();
  });
  it('samplesMultipleElementsAndSubpathsWithinProportionalBudget', () => {
    const result = readSvgDrawing(svg('<path id="first" d="M0 0L10 0M20 0L30 0"/><line x2="10"/>'));
    expect(result).toHaveLength(3);
    expect(result.map((stroke) => stroke.name)).toEqual(['first · 1', 'first · 2', 'Trazo 3']);
    expect(new Set(result.map((stroke) => stroke.id)).size).toBe(3);
    expect(result[1].points.length).toBeGreaterThan(result[0].points.length * 2.9);
    expect(result.reduce((total, stroke) => total + stroke.points.length, 0)).toBeLessThanOrEqual(
      4096,
    );
    expect(result[1].points[0]).toEqual([0, -5]);
    expect(result[1].points.at(-1)).toEqual([30, -5]);
    expect(measured.every((node) => !node.isConnected && node.attributes.length === 1)).toBe(true);
  });
  it('preservesTinyClosedContoursBesideLongStrokes', () => {
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: function (this: SVGElement): number {
        return this.getAttribute('d')?.includes(' a ') ? 1 : 1_000_000;
      },
    });
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
      configurable: true,
      value: function (this: SVGElement, distance: number) {
        if (!this.getAttribute('d')?.includes(' a ')) return { x: distance, y: 0 };
        // Closed geometry has identical endpoints; intermediate samples preserve extent.
        if (distance === 0 || distance === 1) return { x: 1, y: 0 };
        return { x: Math.cos(2 * Math.PI * distance), y: Math.sin(2 * Math.PI * distance) };
      },
    });
    const strokes = readSvgDrawing(svg('<path d="M0 0L1000000 0"/><circle r="1"/>'));
    expect(strokes[1].points).toHaveLength(8);
    expect(strokes[1].points[0]).toEqual(strokes[1].points.at(-1));
    expect(new Set(strokes[1].points.map((point) => point.join(','))).size).toBeGreaterThan(2);
    expect(() => connectStrokes(strokes.map((stroke) => stroke.points))).not.toThrow();
    expect(strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)).toBeLessThanOrEqual(
      4096,
    );
  });
  it('ignoresExportedBackgroundAndGridLayersButKeepsTheCurve', () => {
    const strokes = readSvgDrawing(
      svg(
        '<rect data-epicycle-layer="background" width="100" height="100"/>' +
          '<g data-epicycle-layer="grid"><g><line x2="100"/>' +
          '<path d="M0 0L1 1"/>'.repeat(65) +
          '</g></g>' +
          '<path id="curve" d="M0 0L10 0"/>',
      ),
    );
    expect(strokes).toHaveLength(1);
    expect(strokes[0].name).toBe('curve');
    expect(strokes[0].points).toHaveLength(4096);
    expect(measured).toHaveLength(1);
    expect(measured[0].getAttribute('d')).toBe('M 0 0 L 10 0');
  });
  it('validatesAllMarkedLayerContentBeforeMeasuringAnyCurve', () => {
    expect(() =>
      readSvgDrawing(
        svg('<path d="M0 0L10 0"/><g data-epicycle-layer="grid"><script>alert(1)</script></g>'),
      ),
    ).toThrow('permitidos');
    expect(measured).toHaveLength(0);
    expect(() =>
      readSvgDrawing(
        svg(
          '<rect data-epicycle-layer="background" width="10" height="10" onload="alert(1)"/>' +
            '<path d="M0 0L10 0"/>',
        ),
      ),
    ).toThrow('referencias externas');
    expect(measured).toHaveLength(0);
  });
  it('supportsBasicShapesAndRoundedRectangles', () => {
    const result = readSvgDrawing(
      svg(
        '<rect width="10" height="20" rx="2"/><circle r="5"/><ellipse rx="4" ry="2"/><polyline points="0,0 1,2 3,4"/><polygon points="0,0 1,2 3,4"/>',
      ),
    );
    expect(result).toHaveLength(5);
    expect(measured.map((node) => node.getAttribute('d'))).toEqual([
      'M 2 0 h 6 a 2 2 0 0 1 2 2 v 16 a 2 2 0 0 1 -2 2 h -6 a 2 2 0 0 1 -2 -2 v -16 a 2 2 0 0 1 2 -2 Z',
      'M 5 0 a 5 5 0 1 0 -10 0 a 5 5 0 1 0 10 0 Z',
      'M 4 0 a 4 2 0 1 0 -8 0 a 4 2 0 1 0 8 0 Z',
      'M 0 0 L 1 2 L 3 4',
      'M 0 0 L 1 2 L 3 4 Z',
    ]);
  });
  it('skipsZeroSizedShapesAndZeroLengthPaths', () => {
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: () => 0,
    });
    expect(() => readSvgDrawing(svg('<rect width="0" height="4"/><path d="M0 0"/>'))).toThrow(
      'longitud',
    );
  });
  it('acceptsExactly64StrokesAndRejects65', () => {
    const path = '<path d="M0 0L1 1"/>';
    const result = readSvgDrawing(svg(path.repeat(64)));
    expect(result).toHaveLength(64);
    expect(result.reduce((sum, stroke) => sum + stroke.points.length, 0)).toBeLessThanOrEqual(4096);
    expect(() => readSvgDrawing(svg(path.repeat(65)))).toThrow('64');
  });
  it.each([
    { name: 'foreignRoot', text: '<svg xmlns="urn:foreign" viewBox="0 0 1 1"/>' },
    { name: 'missingNamespace', text: '<svg viewBox="0 0 1 1"/>' },
    { name: 'foreignChild', text: svg('<path xmlns="urn:foreign" d="M0 0L1 1"/>') },
    { name: 'script', text: svg('<script>alert(1)</script>') },
    { name: 'externalImage', text: svg('<image href="https://example.com/p.png"/>') },
    { name: 'event', text: svg('<path d="M0 0L1 1" onload="alert(1)"/>') },
    { name: 'transform', text: svg('<g transform="scale(2)"><path d="M0 0L1 1"/></g>') },
    { name: 'css', text: svg('<path d="M0 0L1 1" style="stroke:red"/>') },
    { name: 'urlReference', text: svg('<path d="M0 0L1 1" fill="url(https://example.com/a)"/>') },
    { name: 'entity', text: '<!DOCTYPE svg [<!ENTITY x "1">]>' + svg('<path d="M0 0L1 1"/>') },
    { name: 'malformed', text: svg('<path>') },
    { name: 'badViewBox', text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 1"/>' },
    { name: 'percentageShape', text: svg('<rect width="50%" height="10"/>') },
    { name: 'invalidPolyline', text: svg('<polyline points="0 0 L1 1"/>') },
  ])('rejectsUnsafeOrInvalidInput_$name', ({ text }) => {
    expect(() => readSvgDrawing(text)).toThrow();
  });
  it('rejectsOversizedUploadsBeforeParsing', () => {
    expect(() => readSvgDrawing(' '.repeat(262145))).toThrow('grande');
  });
  it('rejectsNonFiniteGeometryAndSamples', () => {
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: () => NaN,
    });
    expect(() => readSvgDrawing(svg('<path d="M0 0L1 1"/>'))).toThrow('Geometría');
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: () => 10,
    });
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
      configurable: true,
      value: () => ({ x: Infinity, y: 0 }),
    });
    expect(() => readSvgDrawing(svg('<path d="M0 0L1 1"/>'))).toThrow('Geometría');
  });
});
