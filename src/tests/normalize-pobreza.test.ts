import { describe, expect, it } from 'vitest';
import { normalizePobreza } from '../lib/normalize';

describe('normalizePobreza', () => {
    it('expands INDEC official semesters and UTDT preliminary months to monthly rows', () => {
        const result = normalizePobreza([
            { fecha: '2025-07-01', pobreza_indec: 31.6 },
            { fecha: '2026-01-01', pobreza_indec: 28.2 },
            { fecha: '2025-10-01', pobreza_utdt: 35.9, pobreza_utdt_lower: 35.2, pobreza_utdt_upper: 36.6 },
            { fecha: '2026-01-01', pobreza_utdt_proyectada: 31, pobreza_utdt_proyectada_lower: 28.8, pobreza_utdt_proyectada_upper: 31.7 },
            { fecha: '2026-02-01', pobreza_utdt_proyectada: 28.6, pobreza_utdt_proyectada_lower: 29.2, pobreza_utdt_proyectada_upper: 32.1 },
            { fecha: '2026-03-01', pobreza_utdt_proyectada: 25.6, pobreza_utdt_proyectada_lower: 27.5, pobreza_utdt_proyectada_upper: 30.4 },
        ]);

        expect(result.map(row => row.iso_fecha)).toEqual([
            '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01', '2025-06-01',
            '2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01',
            '2026-01-01', '2026-02-01', '2026-03-01',
        ]);
        expect(result[0]).toMatchObject({ iso_fecha: '2025-01-01', pobreza_indec: 31.6, pobreza: 31.6, preliminar: false });
        expect(result[9]).toMatchObject({ iso_fecha: '2025-10-01', pobreza_indec: 28.2, pobreza_utdt: 35.9, pobreza: 28.2, preliminar: false });
        expect(result[11]).toMatchObject({ iso_fecha: '2025-12-01', pobreza_indec: 28.2, pobreza: 28.2, preliminar: false });
        expect(result[12]).toMatchObject({ iso_fecha: '2026-01-01', pobreza_utdt: null, pobreza_utdt_proyectada: 31, pobreza: 31, preliminar: true });
        expect(result[13]).toMatchObject({ iso_fecha: '2026-02-01', pobreza_utdt: null, pobreza_utdt_proyectada: 28.6, pobreza: 28.6, preliminar: true });
        expect(result[14]).toMatchObject({ iso_fecha: '2026-03-01', pobreza_utdt: null, pobreza_utdt_proyectada: 25.6, pobreza_utdt_proyectada_lower: 27.5, pobreza_utdt_proyectada_upper: 30.4, preliminar: true });
    });
});
