import { describe, it, expect } from 'vitest';
import { isoToFecha, isoToMonthLabel, normalizeEmision, normalizeBma } from './normalize';

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
    it('averages daily values and strictly calculates BMAmplia', () => {
        const rawData = [
            {
                fecha: '2026-02-05',
                base_monetaria: 100,
                pases: 50,
                leliq: 0,
                lefi: 50,
                otros: 10,
                depositos_tesoro: null // Weekly series missing here
            },
            {
                // Another day in the same month
                fecha: '2026-02-15',
                base_monetaria: 200,
                pases: 50,
                leliq: 0,
                lefi: 50,
                otros: 30,
                depositos_tesoro: 300 // Weekly series exists here
            }
        ];

        const normalized = normalizeBma(rawData);
        
        expect(normalized).toHaveLength(1);
        expect(normalized[0]).toMatchObject({
            fecha: 'FEB 26',
            iso_fecha: '2026-02-01',
            // Averages:
            // base_monetaria: (100+200)/2 = 150
            // pases: (50+50)/2 = 50
            // leliq: (0+0)/2 = 0
            // lefi: (50+50)/2 = 50
            // otros: (10+30)/2 = 20
            BaseMonetaria: 150,
            PasivosRemunerados: 120, // 50 + 0 + 50 + 20
            // depositos_tesoro: (300)/1 = 300
            DepositosTesoro: 300,
            BMAmplia: 570 // 150 + 120 + 300
        });
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
                depositos_tesoro: null
            }
        ];

        const normalized = normalizeBma(rawData);
        expect(normalized[0].BMAmplia).toBeNull();
    });
});
