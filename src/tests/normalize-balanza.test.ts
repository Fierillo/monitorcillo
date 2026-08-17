import { describe, expect, it } from 'vitest';
import { buildAperturaComercial, usdMillionsToPctPbi, withNegativeImports } from '../lib/balanza/schema';
import { normalizeBalanza } from '../lib/normalize';

describe('normalizeBalanza', () => {
    it('normalizes monthly ICA rows and fills missing saldo', () => {
        expect(normalizeBalanza([
            { fecha: '2026-02-01', exportaciones: '6500', importaciones: '5800', saldo: 700, impo_bienes_capital: 800 },
            { fecha: 'invalid', exportaciones: 1 },
            { fecha: '2026-01-01', exportaciones: 6100, importaciones: 5900 },
        ])).toEqual([
            { fecha: 'ENE 26', iso_fecha: '2026-01-01', exportaciones: 6100, importaciones: -5900, saldo: 200, expo_pp: null, expo_moa: null, expo_moi: null, expo_combustibles: null, impo_bienes_capital: null, impo_bienes_intermedios: null, impo_combustibles: null, impo_piezas: null, impo_bienes_consumo: null, impo_vehiculos: null, impo_resto: null, pbi: null, tc: null, ipc_nucleo: null, pbi_usd: null },
            { fecha: 'FEB 26', iso_fecha: '2026-02-01', exportaciones: 6500, importaciones: -5800, saldo: 700, expo_pp: null, expo_moa: null, expo_moi: null, expo_combustibles: null, impo_bienes_capital: -800, impo_bienes_intermedios: null, impo_combustibles: null, impo_piezas: null, impo_bienes_consumo: null, impo_vehiculos: null, impo_resto: null, pbi: null, tc: null, ipc_nucleo: null, pbi_usd: null },
        ]);
    });

    it('converts USD millions to percent of GDP', () => {
        expect(usdMillionsToPctPbi(1000, 50_000)).toBe(2);
        expect(usdMillionsToPctPbi(-1000, 50_000)).toBe(-2);
        expect(usdMillionsToPctPbi(1000, 0)).toBeNull();
    });

    it('builds annual trade openness from complete years', () => {
        const months = Array.from({ length: 12 }, (_, index) => ({
            iso_fecha: `2024-${String(index + 1).padStart(2, '0')}-01`,
            exportaciones: 100,
            importaciones: -80,
            pbi_usd: 2400,
        }));

        expect(buildAperturaComercial([
            ...months,
            { iso_fecha: '2025-01-01', exportaciones: 100, importaciones: -80, pbi_usd: 2400 },
        ])).toEqual([
            { fecha: '2024', iso_fecha: '2024-01-01', exportaciones: 50, importaciones: 40, apertura: 90, preliminary: false },
            { fecha: '2025', iso_fecha: '2025-01-01', exportaciones: 50, importaciones: 40, apertura: 90, preliminary: true },
        ]);
    });

    it('forces already persisted import values to negative for the chart', () => {
        expect(withNegativeImports({
            fecha: 'JUN 26',
            exportaciones: 9055,
            importaciones: 6861,
            impo_bienes_capital: -800,
            saldo: 2194,
        })).toMatchObject({
            fecha: 'JUN 26',
            exportaciones: 9055,
            importaciones: -6861,
            impo_bienes_capital: -800,
            impo_bienes_intermedios: null,
            saldo: 2194,
        });
    });
});
