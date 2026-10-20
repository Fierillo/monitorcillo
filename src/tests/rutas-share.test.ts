import { describe, expect, it } from 'vitest';
import { concessionedKm, concessionedShare, type PaintedRoute, type PaintedSegment } from '@/lib/rutas/status';

const seg = (tramoId: string | null, km: number | null): PaintedSegment => ({ tramoId, tramo: null, concesionaria: 'x', color: '#000', km, lines: [] });
const route = (km: number | null, segments: PaintedSegment[]) => ({ km, segments }) as unknown as PaintedRoute;

describe('concessionedShare', () => {
    it('divides concessioned km by the whole network km', () => {
        const stages = new Map([['a', 'concesionado' as const], ['b', 'en-licitacion' as const]]);
        expect(concessionedShare([route(100, [seg('a', 30), seg('b', 20), seg(null, 50)]), route(100, [seg('a', 10)])], stages)).toBeCloseTo(0.2);
    });
    it('is zero for an empty network', () => {
        expect(concessionedShare([], new Map())).toBe(0);
    });
});

describe('concessionedKm', () => {
    it('sums only concessioned segment km', () => {
        const stages = new Map([['a', 'concesionado' as const], ['b', 'en-licitacion' as const]]);
        expect(concessionedKm([route(100, [seg('a', 30), seg('b', 20), seg('a', null)]), route(100, [seg('a', 10)])], stages)).toBe(40);
    });
});
