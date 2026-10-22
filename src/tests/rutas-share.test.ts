import { describe, expect, it } from 'vitest';
import { concessionedKm, concessionedShare, type PaintedRoute, type PaintedSegment } from '@/lib/rutas/status';

const seg = (tramoId: string | null, km: number | null): PaintedSegment => ({ tramoId, tramo: null, concesionaria: 'x', color: '#000', km, lines: [] });
const route = (km: number | null, segments: PaintedSegment[]) => ({ km, segments }) as unknown as PaintedRoute;

describe('concessionedShare', () => {
    it('divides concessioned km by the stored national network km, not by the drawn routes', () => {
        const stages = new Map([['a', 'concesionado' as const], ['b', 'en-licitacion' as const]]);
        expect(concessionedShare([route(100, [seg('a', 30), seg('b', 20), seg(null, 50)]), route(100, [seg('a', 10)])], stages, 400)).toBeCloseTo(0.1);
    });
    it('has no share without a stored network total', () => {
        const stages = new Map([['a', 'concesionado' as const]]);
        expect(concessionedShare([route(100, [seg('a', 30)])], stages, null)).toBeNull();
        expect(concessionedShare([route(100, [seg('a', 30)])], stages, 0)).toBeNull();
    });
});

describe('concessionedKm', () => {
    it('sums only concessioned segment km', () => {
        const stages = new Map([['a', 'concesionado' as const], ['b', 'en-licitacion' as const]]);
        expect(concessionedKm([route(100, [seg('a', 30), seg('b', 20), seg('a', null)]), route(100, [seg('a', 10)])], stages)).toBe(40);
    });
});
