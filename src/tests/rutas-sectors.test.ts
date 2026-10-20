import { describe, expect, it } from 'vitest';
import geometry from '@/lib/rutas/geometry.json';
import { COMPANY_PALETTE, companyColors, sectorsForTramo, sliceRouteByKm } from '@/lib/rutas/sectors';
import { paintRoutes } from '@/lib/rutas/status';
import { RUTAS_SECTORES as ROUTE_SECTORS, RUTAS_SEED, seedTramos } from './fixtures/rutas';

const AUTOPISTAS_SIN_TRAZA = 30.39 + 13.86 + 6.05;

describe('concession kilometres along each route', () => {
    it('covers each published tramo without overlapping another company', () => {
        for (const tramo of RUTAS_SEED) {
            const covered = ROUTE_SECTORS.filter(sector => sector.tramoId === tramo.id).reduce((sum, sector) => sum + sector.km, 0);
            const expected = tramo.id === 'sur-atlantico-acceso-sur' ? (tramo.km ?? 0) - AUTOPISTAS_SIN_TRAZA : tramo.km ?? 0;
            expect(covered).toBeCloseTo(expected, 2);
            for (const code of tramo.rutas) {
                expect(ROUTE_SECTORS.some(sector => sector.tramoId === tramo.id && sector.ruta === code)).toBe(true);
            }
        }

        const byRoute = new Map<string, typeof ROUTE_SECTORS>();
        for (const sector of ROUTE_SECTORS) {
            const rows = byRoute.get(sector.ruta) ?? [];
            rows.push(sector);
            byRoute.set(sector.ruta, rows);
        }
        for (const sectors of byRoute.values()) {
            const sorted = [...sectors].sort((left, right) => left.desdeKm - right.desdeKm);
            for (let index = 1; index < sorted.length; index += 1) {
                expect(sorted[index - 1].hastaKm).toBeLessThanOrEqual(sorted[index].desdeKm + 0.05);
            }
        }
    });

    it('cuts a route by progressive and keeps each company on its own stretch', () => {
        const line = [[[-60, 0], [-50, 0]]];
        expect(sliceRouteByKm(line, 100, 0, 100)).toBe(line);
        const middle = sliceRouteByKm(line, 100, 25, 75);
        expect(middle[0][0][0]).toBeCloseTo(-57.5, 1);
        expect(middle[0].at(-1)?.[0]).toBeCloseTo(-52.5, 1);
        const shifted = sliceRouteByKm(line, 200, 100, 150, 100);
        expect(shifted[0][0][0]).toBeCloseTo(-60, 1);
        expect(shifted[0].at(-1)?.[0]).toBeCloseTo(-55, 1);

        const names = [...new Set(RUTAS_SEED.map(tramo => tramo.concesionaria))];
        expect(names).toHaveLength(COMPANY_PALETTE.length);
        expect(new Set(companyColors(names).values()).size).toBe(names.length);

        const painted = paintRoutes(geometry.routes, seedTramos(), 'concesion');
        const route9 = painted.find(route => route.code === '9');
        const south = route9?.segments.find(segment => segment.tramoId === 'portuario-sur');
        const north = route9?.segments.find(segment => segment.tramoId === 'noroeste' && segment.km === 453.57);
        const rosario = route9?.segments.find(segment => segment.tramoId === 'portuario-norte');
        expect(meanLat(south?.lines ?? [])).toBeLessThan(-32);
        expect(meanLat(north?.lines ?? [])).toBeGreaterThan(-29);
        expect(meanLat(south?.lines ?? [])).toBeLessThan(meanLat(rosario?.lines ?? []));
        expect(south?.color).toBe(painted.find(route => route.code === '188')?.segments.find(segment => segment.tramoId === 'portuario-sur')?.color);
        expect(south?.color).not.toBe(rosario?.color);
        expect(route9?.segments.some(segment => segment.concesionaria === 'Sin dato')).toBe(true);
    });
});

function meanLat(lines: number[][][]): number {
    const points = lines.flat();
    return points.reduce((sum, point) => sum + point[1], 0) / points.length;
}

it('sectorsForTramo uses only the tramo own stored sectors, none when missing', () => {
    const own = [{ ruta: '9', desdeKm: 0, hastaKm: 10 }, { ruta: '5', desdeKm: 0, hastaKm: 3 }];
    expect(sectorsForTramo('9', own)).toEqual([own[0]]);
    expect(sectorsForTramo('9')).toEqual([]);
});
