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
        expect(byFecha.get('2025-01-01')).toMatchObject({ pobreza_indec: 31.6, pobreza: 31.6, preliminar: false });
        expect(byFecha.get('2025-06-01')).toMatchObject({ pobreza_indec: 31.6, pobreza: 31.6, preliminar: false });
        // jul-dic 2025 (from 2026-01-01)
        expect(byFecha.get('2025-07-01')).toMatchObject({ pobreza_indec: 28.2, pobreza: 28.2, preliminar: false });
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza: 28.2, preliminar: false });
    });

    it('shows UTDT nowcast only after last INDEC month', () => {
        // INDEC semestral: 2026-01-01 = semestre jul-dic 2025 → meses 2025-07 a 2025-12
        // UTDT nowcast para meses no cubiertos por INDEC: 2026-01 ene-adelante
        const result = normalizePobreza([
            { fecha: '2026-01-01', pobreza_indec: 28.2 },
            { fecha: '2026-01-01', pobreza_utdt_proyectada: 28.5 },
            { fecha: '2026-02-01', pobreza_utdt_proyectada: 28.7 },
            { fecha: '2026-03-01', pobreza_utdt_proyectada: 29.0 },
        ]);

        const byFecha = new Map(result.map(r => [r.iso_fecha, r]));

        // INDEC hasta Dic 2025 (expanded from 2026-01-01)
        expect(byFecha.get('2025-12-01')).toMatchObject({ pobreza_indec: 28.2, pobreza_utdt_proyectada: null, pobreza: 28.2, preliminar: false });
        // UTDT nowcast solo despues del ultimo INDEC
        expect(byFecha.get('2026-01-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt_proyectada: 28.5, pobreza: 28.5, preliminar: true });
        expect(byFecha.get('2026-02-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt_proyectada: 28.7, pobreza: 28.7, preliminar: true });
        expect(byFecha.get('2026-03-01')).toMatchObject({ pobreza_indec: null, pobreza_utdt_proyectada: 29.0, pobreza: 29.0, preliminar: true });
    });
});
