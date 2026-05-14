import { describe, expect, it } from 'vitest';
import { normalizePobreza } from '../lib/normalize';

describe('normalizePobreza', () => {
    it('expands INDEC data to all months of the semester', () => {
        // INDEC semestral dates: 2025-07-01 = ene-jun 2025, 2026-01-01 = jul-dic 2025
        const result = normalizePobreza([
            { fecha: '2025-07-01', pobreza_indec: 31.6 },
            { fecha: '2026-01-01', pobreza_indec: 28.2 },
        ]);

        const byFecha = new Map(result.map(r => [r.iso_fecha, r]));

        // ene-jun 2025 (from 2025-07-01)
        expect(byFecha.get('2025-01-01')).toMatchObject({ pobreza_indec: 31.6, pobreza_utdt: null });
        expect(byFecha.get('2025-06-01')).toMatchObject({ pobreza_indec: 31.6, pobreza_utdt: null });
        // jul-dic 2025 (from 2026-01-01)
        expect(byFecha.get('2025-07-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: null });
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: null });
    });

    it('keeps UTDT nowcast as a separate series when it overlaps INDEC', () => {
        // INDEC semestral: 2026-01-01 = semestre jul-dic 2025 → meses 2025-07 a 2025-12
        // UTDT nowcast para meses no cubiertos por INDEC: 2026-01 ene-adelante
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

        // INDEC hasta Dic 2025 (expanded from 2026-01-01)
        expect(byFecha.get('2025-10-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.8 });
        expect(byFecha.get('2025-11-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.5 });
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt: 28.2 });
        expect(byFecha.get('2026-01-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 28.5 });
        expect(byFecha.get('2026-02-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 28.7 });
        expect(byFecha.get('2026-03-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt: 29.0 });
    });
});
