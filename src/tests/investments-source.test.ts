import { describe, expect, it } from 'vitest';
import { NON_RIGI_INVESTMENTS, RIGI_EVALUATION_OBSERVATIONS, RIGI_INVESTMENT_CHART_DATA, RIGI_INVESTMENTS } from '@/lib/investments-source';

describe('RIGI investments source', () => {
    it('builds a continuous monthly series from January 2017', () => {
        expect(RIGI_INVESTMENT_CHART_DATA).toHaveLength(115);
        expect(RIGI_INVESTMENT_CHART_DATA[0]).toEqual({
            fecha: 'ENE 17',
            iso_fecha: '2017-01-01',
            aprobadas: 0,
            en_evaluacion: 0,
            anunciadas: 0,
            confirmadas: 0,
        });
        expect(RIGI_INVESTMENT_CHART_DATA.at(-1)).toEqual({
            fecha: 'JUL 26',
            iso_fecha: '2026-07-01',
            aprobadas: 46708,
            en_evaluacion: 101241,
            anunciadas: 880,
            confirmadas: 6764,
        });
    });

    it('repeats the previous evaluation value in months without updates', () => {
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-01-01')?.en_evaluacion).toBe(8655);
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-02-01')?.en_evaluacion).toBe(8655);
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-03-01')?.en_evaluacion).toBe(8655);
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-04-01')?.en_evaluacion).toBe(12503);
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2026-05-01')?.en_evaluacion).toBe(67755);
        expect(RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2026-06-01')?.en_evaluacion).toBe(111037);
    });

    it('keeps every historical evaluation observation traceable to a source', () => {
        expect(RIGI_EVALUATION_OBSERVATIONS).toHaveLength(6);
        expect(RIGI_EVALUATION_OBSERVATIONS.every(observation => observation.source.startsWith('https://'))).toBe(true);
    });

    it('keeps the official project counts and update date', () => {
        expect(RIGI_INVESTMENTS).toMatchObject({
            approved: { projects: 21 },
            underEvaluation: { projects: 22 },
            updatedAt: '2026-07-31',
        });
    });
});

describe('non-RIGI investments source', () => {
    it('moves investments from announced to confirmed without duplicating amounts', () => {
        const april2025 = RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-04-01');
        const may2025 = RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2025-05-01');

        expect(april2025).toMatchObject({ anunciadas: 1085, confirmadas: 4869 });
        expect(may2025).toMatchObject({ anunciadas: 660, confirmadas: 5294 });
        expect(Number(april2025?.anunciadas) + Number(april2025?.confirmadas)).toBe(Number(may2025?.anunciadas) + Number(may2025?.confirmadas));
    });

    it('keeps every announcement and confirmation traceable', () => {
        expect(NON_RIGI_INVESTMENTS).toHaveLength(27);
        expect(NON_RIGI_INVESTMENTS.every(investment => investment.announcement.url.startsWith('https://'))).toBe(true);
        expect(NON_RIGI_INVESTMENTS.filter(investment => investment.confirmation).every(investment => investment.confirmation!.url.startsWith('https://'))).toBe(true);
    });

    it('applies amount revisions in their publication month', () => {
        const june2024 = RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2024-06-01');
        const july2024 = RIGI_INVESTMENT_CHART_DATA.find(row => row.iso_fecha === '2024-07-01');

        expect(Number(july2024?.confirmadas) - Number(june2024?.confirmadas)).toBe(870);
        expect(Number(july2024?.anunciadas) - Number(june2024?.anunciadas)).toBe(-400);
    });
});
