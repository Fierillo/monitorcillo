import { describe, it, expect } from 'vitest';
import { isoToFecha, isoToMonthLabel, normalizeEmision, normalizeBma, normalizeRecaudacion, normalizePoderAdquisitivo } from '../lib/normalize';

describe('normalizePoderAdquisitivo', () => {
    it('normalizes all series to 100 on 2017-01-01 and shifts informal salary', () => {
        const rawData = [
            { fecha: '2017-01-01', ipc_nucleo: 100, salario_registrado: 1000, salario_no_registrado: 500, salario_privado: 1000, salario_publico: 1000, ripte: 1000, jubilacion_minima: 1000 },
            { fecha: '2017-02-01', ipc_nucleo: 105 },
            { fecha: '2017-03-01', ipc_nucleo: 110 },
            { fecha: '2017-04-01', ipc_nucleo: 115 },
            { fecha: '2017-05-01', ipc_nucleo: 118 },
            { fecha: '2017-06-01', ipc_nucleo: 120, salario_registrado: 1200, salario_no_registrado: 800, salario_privado: 1200, salario_publico: 1200, ripte: 1200, jubilacion_minima: 1200 },
        ];

        const normalized = normalizePoderAdquisitivo(rawData);
        const jan17 = normalized.find(r => r.iso_fecha === '2017-01-01');
        
        expect(jan17).toBeDefined();
        expect(jan17!.blanco).toBe(100);
        expect(jan17!.negro).toBe(100);
    });
});

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
        const rawData = [
            {
                fecha: '2017-01-01',
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
                pbi_trimestral: 45000,
                emae_desestacionalizado: 1.0,
                ipc_nucleo: 1.25
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

        const normalized = normalizeBma(rawData);
        
        expect(normalized).toHaveLength(2);
        
        const bmaRow = normalized.find(r => r.iso_fecha === '2026-02-01');
        expect(bmaRow).toBeDefined();
        
        expect(bmaRow!.BaseMonetaria).toBeCloseTo(0.26667, 4);
        expect(bmaRow!.PasivosRemunerados).toBeCloseTo(0.21333, 4);
        expect(bmaRow!.DepositosTesoro).toBeCloseTo(0.53333, 4);
        expect(bmaRow!.BMAmplia).toBeCloseTo(1.01333, 4);
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
    it('calculates Recaudacion as % of monthly PBI', () => {
        const rawData = [
            {
                fecha: '2017-01-01',
                ipc_nucleo: 100,
            },
            {
                fecha: '2026-02-01',
                mes: '02',
                year: 2026,
                recaudacion_total: 100,
                pbi_trimestral: 36000,
                ipc_nucleo: 100,
            }
        ];

        const normalized = normalizeRecaudacion(rawData);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].pctPbi).toBeCloseTo(0.2778, 4);
        expect(normalized[0].fecha).toBe('FEB 26');
        expect(normalized[0].iso_fecha).toBe('2026-02-01');
    });

    it('does not repeat a previous PBI when the month has no monthly PBI value', () => {
        const normalized = normalizeRecaudacion([
            {
                fecha: '2017-01-01',
                ipc_nucleo: 100,
            },
            {
                fecha: '2026-01-01',
                mes: '01',
                year: 2026,
                recaudacion_total: 100,
                pbi_trimestral: 1000,
                ipc_nucleo: 100,
            },
            {
                fecha: '2026-02-01',
                mes: '02',
                year: 2026,
                recaudacion_total: 100,
                ipc_nucleo: 100,
            },
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].iso_fecha).toBe('2026-01-01');
    });
});
