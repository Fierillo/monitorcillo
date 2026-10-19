import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import geometry from '@/lib/rutas/geometry.json';
import { normalizeRouteCode } from '@/lib/rutas/status';

describe('simplified national route geometry', () => {
    it('keeps the official route network inside continental Argentina and a small payload', () => {
        const bytes = readFileSync(join(process.cwd(), 'src/lib/rutas/geometry.json')).byteLength;
        expect(bytes).toBeLessThan(160_000);
        expect(geometry.source.routes).toBe('https://datos.transporte.gob.ar/dataset/rutas-nacionales');
        expect(geometry.source.outline).toBe('https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson');
        expect(geometry.source.retrieved).toBe('2026-10-19');

        const codes = geometry.routes.map(route => route.code);
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes).toContain('9');
        expect(codes).toContain('A12');
        expect(codes.length).toBeGreaterThanOrEqual(100);

        for (const route of geometry.routes) {
            expect(normalizeRouteCode(route.code)).toBe(route.code);
            expect(route.label).toBe(`RN ${route.code}`);
            expect(route.lines.some(line => line.length >= 2)).toBe(true);
            for (const line of route.lines) {
                for (const [lon, lat] of line) {
                    expect(lon).toBeGreaterThanOrEqual(-75);
                    expect(lon).toBeLessThanOrEqual(-53);
                    expect(lat).toBeGreaterThanOrEqual(-56);
                    expect(lat).toBeLessThanOrEqual(-21);
                }
            }
        }

        expect(geometry.routes.find(route => route.code === '9')?.km).toBe(1975.46);
        expect(geometry.routes.find(route => route.code === '3')?.km).toBe(3079.16);
        expect(geometry.routes.find(route => route.code === 'A12')?.km).toBe(66.71);

        const outlinePoints = geometry.outline.flat();
        expect(geometry.outline.length).toBeGreaterThanOrEqual(24);
        expect(outlinePoints.some(([lon, lat]) => lon < -57 && lon > -63 && lat < -33 && lat > -38)).toBe(true);
        expect(outlinePoints.some(([, lat]) => lat < -56)).toBe(false);
    });
});
