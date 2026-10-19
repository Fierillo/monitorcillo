import { describe, expect, it } from 'vitest';
import { emaeDesestacionalizadoMap, seriesValueMap, valueAtOrBefore } from './series';

describe('as-of series lookup', () => {
    it('uses the latest observation at or before the date and never a later one', () => {
        const values = seriesValueMap([
            ['2026-03-01', 3],
            ['2026-01-01', 1],
            ['2026-02-01', 2],
        ]);

        expect(valueAtOrBefore(values, '2026-02-15')).toBe(2);
        expect(valueAtOrBefore(values, '2026-02-01')).toBe(2);
        expect(valueAtOrBefore(values, '2026-04-01')).toBe(3);
        expect(valueAtOrBefore(values, '2025-12-31')).toBeNull();
        expect(valueAtOrBefore(new Map(), '2026-01-01')).toBeNull();
    });

    it('keeps a gap instead of borrowing the next observation', () => {
        const values = new Map([['2026-04-01', 4], ['2026-01-01', 1]]);

        expect(valueAtOrBefore(values, '2026-03-01')).toBe(1);
    });

    it('keeps zeros, drops nulls, and lets the later duplicate win', () => {
        const values = seriesValueMap([
            ['2026-02-01', null],
            ['2026-01-01', 0],
            ['2026-03-01', 5],
            ['2026-03-01', 7],
        ]);

        expect(values.has('2026-02-01')).toBe(false);
        expect(values.get('2026-01-01')).toBe(0);
        expect(values.get('2026-03-01')).toBe(7);
        expect([...values.keys()]).toEqual(['2026-01-01', '2026-03-01']);
    });

    it('drops an EMAE month that has no seasonally adjusted value', () => {
        const values = emaeDesestacionalizadoMap([
            { fecha: '2026-01-01', emae_desestacionalizado: null },
            { fecha: '2026-02-01', emae_desestacionalizado: 101.5 },
        ]);

        expect(valueAtOrBefore(values, '2026-01-15')).toBeNull();
        expect(valueAtOrBefore(values, '2026-02-01')).toBe(101.5);
    });
});
