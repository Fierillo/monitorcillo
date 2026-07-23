import { describe, expect, it } from 'vitest';
import { normalizeRecaudacion } from '../lib/normalize';

describe('normalizeRecaudacion', () => {
    it('keeps original PBI ratio and adds a 12-month moving-average series', () => {
        const rawData = [
            { fecha: '2017-01-01', ipc_nucleo: 100 },
            ...Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                return {
                    fecha: `2026-${String(month).padStart(2, '0')}-01`,
                    mes: String(month).padStart(2, '0'),
                    year: 2026,
                    recaudacion_total: 100 + index,
                    iva: 40,
                    ganancias: 20,
                    aportes_personales: 15,
                    contribuciones_patronales: 20,
                    pbi_trimestral: 1200,
                    ipc_nucleo: 100,
                };
            }),
        ];

        const normalized = normalizeRecaudacion(rawData);

        expect(normalized).toHaveLength(12);
        expect(normalized[0]).toMatchObject({
            iso_fecha: '2026-01-01',
            pctPbiMm12: null,
            ivaPctPbiMm12: null,
            otrosPctPbiMm12: null,
        });
        expect(normalized.at(-1)?.iso_fecha).toBe('2026-12-01');
        expect(normalized.at(-1)?.pctPbi).toBeCloseTo(9.25, 4);
        expect(normalized.at(-1)?.pctPbiMm12).toBeCloseTo(8.7917, 4);
        expect(normalized.at(-1)?.ivaPctPbi).toBeCloseTo(3.3333, 4);
        expect(normalized.at(-1)?.gananciasPctPbi).toBeCloseTo(1.6667, 4);
        expect(normalized.at(-1)?.aportesPctPbi).toBeCloseTo(1.25, 4);
        expect(normalized.at(-1)?.contribucionesPctPbi).toBeCloseTo(1.6667, 4);
        expect(normalized.at(-1)?.otrosPctPbi).toBeCloseTo(1.3333, 4);
    });

    it('makes the breakdown sum equal to the aggregate total', () => {
        const normalized = normalizeRecaudacion([
            { fecha: '2017-01-01', ipc_nucleo: 100 },
            {
                fecha: '2026-01-01',
                mes: '01',
                year: 2026,
                recaudacion_total: 200,
                iva: 80,
                ganancias: 40,
                aportes_personales: 30,
                contribuciones_patronales: 25,
                pbi_trimestral: 1000,
                ipc_nucleo: 100,
            },
        ]);

        const row = normalized[0];
        const parts = [
            row.ivaPctPbi,
            row.gananciasPctPbi,
            row.aportesPctPbi,
            row.contribucionesPctPbi,
            row.otrosPctPbi,
        ];

        expect(parts.every(value => value != null)).toBe(true);
        expect(parts.reduce<number>((sum, value) => sum + (value as number), 0)).toBeCloseTo(row.pctPbi as number, 8);
        expect(row.otrosPctPbi).toBeCloseTo(2.5, 4);
    });

    it('does not repeat a previous PBI when the month has no monthly PBI value', () => {
        const normalized = normalizeRecaudacion([
            { fecha: '2017-01-01', ipc_nucleo: 100 },
            ...Array.from({ length: 13 }, (_, index) => ({
                fecha: `2026-${String(index + 1).padStart(2, '0')}-01`,
                mes: String(index + 1).padStart(2, '0'),
                year: 2026,
                recaudacion_total: 100,
                pbi_trimestral: index === 12 ? undefined : 1000,
                ipc_nucleo: 100,
            })),
        ]);

        expect(normalized.at(-1)?.iso_fecha).toBe('2026-12-01');
        expect(normalized.some(row => row.iso_fecha === '2027-01-01')).toBe(false);
    });
});
