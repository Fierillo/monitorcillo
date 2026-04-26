import { describe, it, expect } from 'vitest';
import { isoToFecha, isoToMonthLabel, normalizeEmision, normalizeBma, normalizeRecaudacion } from '../lib/normalize';

describe('normalize.ts formatting helpers', () => {
    it('isoToFecha converts YYYY-MM-DD to DD MMM YY format', () => {
        expect(isoToFecha('2026-02-25')).toBe('25 FEB 26');
        expect(isoToFecha('2026-01-01')).toBe('1 ENE 26');
    });

    it('isoToMonthLabel converts YYYY-MM-DD to MMM YY format', () => {
        expect(isoToMonthLabel('2026-02-25')).toBe('FEB 26');
        expect(isoToMonthLabel('2026-01-01')).toBe('ENE 26');
    });
});

describe('normalizeEmision', () => {
    it('calculates derived columns and separates positive/negative values', () => {
        const rawData = [
            {
                fecha: '2026-01-01',
                compra_dolares: 100,
                tc: 1000,
                bcra: 100000,
                vencimientos: 5000,
                licitado: 6000, // licitaciones should be -1000
                resultado_fiscal: -2000
            }
        ];

        const normalized = normalizeEmision(rawData);
        
        expect(normalized).toHaveLength(1);
        expect(normalized[0]).toMatchObject({
            fecha: '1 ENE 26',
            iso_fecha: '2026-01-01',
            BCRA: 100000,
            BCRA_POS: 100000,
            BCRA_NEG: null,
            Licitaciones: -1000,
            Licitaciones_POS: null,
            Licitaciones_NEG: -1000,
            'Resultado fiscal': -2000,
            ResultadoFiscal_POS: null,
            ResultadoFiscal_NEG: -2000,
            TOTAL: 97000, // 100000 - 1000 - 2000
            ACUMULADO: 97000,
        });
    });

    it('accumulates running total correctly across multiple days', () => {
        const rawData = [
            { fecha: '2026-01-01', bcra: 10, vencimientos: 0, licitado: 0, resultado_fiscal: 0 },
            { fecha: '2026-01-02', bcra: 20, vencimientos: 0, licitado: 0, resultado_fiscal: 0 }
        ];

        const normalized = normalizeEmision(rawData);
        
        expect(normalized[0].ACUMULADO).toBe(10);
        expect(normalized[1].ACUMULADO).toBe(30);
    });
});

describe('normalizeBma', () => {
    it('averages daily values, calculates % PBI, and strictly calculates BMAmplia', () => {
        // For % PBI, BMA values are divided by PBI_Anualizado, then * 100.
        // PBI_Anualizado = PBI_Trimestral * (EMAE_actual / EMAE_base) * (IPC_actual / IPC_base)
        // Let's set fallback bases to 1.0 for simplicity.
        const rawData = [
            {
                fecha: '2024-01-01',
                emae_desestacionalizado: 1.0,
                ipc_nucleo: 1.0
            },
            {
                fecha: '2026-02-05',
                base_monetaria: 150, 
                pases: 50, 
                leliq: 0,
                lefi: 50, 
                otros: 20, 
                depositos_tesoro: null,
                pbi_trimestral: 36000, 
                emae_desestacionalizado: 1.0,
                ipc_nucleo: 1.25 // Inflation adjustment: 1.25 factor
            },
            {
                fecha: '2026-02-15',
                base_monetaria: 150, 
                pases: 50, 
                leliq: 0,
                lefi: 50, 
                otros: 20, 
                depositos_tesoro: 300,
                pbi_trimestral: null,
                emae_desestacionalizado: null,
                ipc_nucleo: null
            }
        ];

        // Averages:
        // bmRaw: 150
        // pasivosRemuneradosRaw: 120
        // depositosTesoroRaw: 300
        // BMAmpliaRaw: 570
        // PBI_Anualizado = 36000 * 1.0 * 1.25 = 45000
        // BaseMonetaria %: (150 / 45000) * 100 = 0.3333...
        // PasivosRemunerados %: (120 / 45000) * 100 = 0.2666...
        // DepositosTesoro %: (300 / 45000) * 100 = 0.6666...
        // BMAmplia %: (570 / 45000) * 100 = 1.2666...

        const normalized = normalizeBma(rawData);
        
        expect(normalized).toHaveLength(2);
        
        const bmaRow = normalized.find(r => r.iso_fecha === '2026-02-01');
        expect(bmaRow).toBeDefined();
        
        expect(bmaRow!.BaseMonetaria).toBeCloseTo(0.41667, 4);
        expect(bmaRow!.PasivosRemunerados).toBeCloseTo(0.33333, 4);
        expect(bmaRow!.DepositosTesoro).toBeCloseTo(0.83333, 4);
        expect(bmaRow!.BMAmplia).toBeCloseTo(1.58333, 4);
    });

    it('returns BMAmplia as null if DepositosTesoro is missing for the entire month', () => {
        const rawData = [
            {
                fecha: '2026-03-01',
                base_monetaria: 100,
                pases: 50,
                leliq: null,
                lefi: null,
                otros: null,
                depositos_tesoro: null,
                pbi_trimestral: 36000,
                emae_desestacionalizado: 1.0,
                ipc_nucleo: 1.0
            }
        ];

        const normalized = normalizeBma(rawData);
        expect(normalized[0].BMAmplia).toBeNull();
    });
});

describe('normalizeRecaudacion', () => {
    it('calculates Recaudacion as % of Monthly GDP', () => {
        // Monthly GDP = Annualized GDP / 12
        // Annualized GDP = PBI_Trimestral * (EMAE_actual / EMAE_base) * (IPC_actual / IPC_base)
        const rawData = [
            {
                fecha: '2024-01-01',
                emae_desestacionalizado: 1.0, // fallback base
                ipc_nucleo: 1.0
            },
            {
                fecha: '2026-02-01',
                mes: '02',
                year: 2026,
                recaudacion_total: 100,
                pbi_trimestral: 36000,
                emae_desestacionalizado: 1.0,
                ipc_nucleo: 1.0
            }
        ];

        // Annualized GDP = 36000
        // Monthly GDP = 36000 / 12 = 3000
        // % PBI = (100 / 3000) * 100 = 3.3333...

        const normalized = normalizeRecaudacion(rawData);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].pctPbi).toBeCloseTo(3.3333, 4);
        expect(normalized[0].fecha).toBe('FEB 26');
        expect(normalized[0].iso_fecha).toBe('2026-02-01');
    });
});
