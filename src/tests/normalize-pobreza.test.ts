import { describe, expect, it } from 'vitest';
import { normalizePobreza } from '../lib/normalize';

describe('normalizePobreza', () => {
    it('expands INDEC data to all months of the semester', () => {
        const result = normalizePobreza([
            { fecha: '2025-07-01', pobreza_indec: 31.6 },
            { fecha: '2026-01-01', pobreza_indec: 28.2 },
        ]);

        const byFecha = new Map(result.map(r => [r.iso_fecha, r]));

        expect(byFecha.get('2025-01-01')).toMatchObject({ pobreza_indec: 31.6, pobreza_utdt: null });
        expect(byFecha.get('2025-06-01')).toMatchObject({ pobreza_indec: 31.6, pobreza_utdt: null });
        expect(byFecha.get('2025-07-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: null });
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: null });
    });

    it('keeps UTDT nowcast as a separate series when it overlaps INDEC', () => {
        const result = normalizePobreza([
            { fecha: '2026-01-01', pobreza_indec: 28.2 },
            { fecha: '2025-10-01', pobreza_utdt: 28.8 },
            { fecha: '2025-11-01', pobreza_utdt: 28.5 },
            { fecha: '2025-12-01', pobreza_utdt: 28.2 },
            { fecha: '2026-01-01', pobreza_utdt: 28.5 },
            { fecha: '2026-02-01', pobreza_utdt: 28.7 },
            { fecha: '2026-03-01', pobreza_utdt: 29.0 },
        ]);

        const byFecha = new Map(result.map(r => [r.iso_fecha, r]));

        expect(byFecha.get('2025-10-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.8 });
        expect(byFecha.get('2025-11-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.5 });
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.2 });
        expect(byFecha.get('2026-01-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 28.5 });
        expect(byFecha.get('2026-02-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 28.7 });
        expect(byFecha.get('2026-03-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 29.0 });
    });

    it('keeps UCA EDSA as an annual third-quarter point', () => {
        const result = normalizePobreza([
            { fecha: '2020-01-01', pobreza_indec: 30 },
            { fecha: '2019-09-01', pobreza_uca: 40 },
            { fecha: '2018-09-01', pobreza_uca: 50 },
        ]);

        const byFecha = new Map(result.map(r => [r.iso_fecha, r]));

        expect(byFecha.get('2018-09-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: null, pobreza_uca: 50 });
        expect(byFecha.get('2018-10-01')).toBeUndefined();
        expect(byFecha.get('2019-09-01')).toMatchObject({ pobreza_indec: 30, pobreza_utdt: null, pobreza_uca: 40 });
        expect(byFecha.get('2019-08-01')).toMatchObject({ pobreza_indec: 30, pobreza_utdt: null, pobreza_uca: null });
    });
});
