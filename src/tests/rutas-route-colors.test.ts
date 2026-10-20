import { describe, expect, it } from 'vitest';
import { routeColors } from '@/lib/rutas/sectors';

describe('routeColors', () => {
    it('gives every route its own color, even with more than a hundred routes', () => {
        const codes = Array.from({ length: 140 }, (_, index) => String(index + 1));
        const colors = routeColors(codes);
        expect(new Set(colors.values()).size).toBe(140);
    });

    it('is stable for the same route list', () => {
        expect(routeColors(['3', '9']).get('9')).toBe(routeColors(['3', '9']).get('9'));
    });
});
