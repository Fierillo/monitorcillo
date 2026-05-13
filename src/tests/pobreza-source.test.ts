import { describe, expect, it } from 'vitest';
import { extractUtdtChartData, getUtdtNowcastValues } from '../lib/pobreza-ocr';

describe('pobreza OCR extraction', () => {
    it('extracts chart data and filters nowcast values after INDEC', async () => {
        // Simulated OCR data matching what we expect from the chart
        const chartData = {
            'Abr25Sep25': 29.4,
            'May25Oct25': 28.8,
            'Jun25Nov25': 28.5,
            'Jul25Dic25': 28.2,
            'Ago25Ene26': 28.5,
            'Sep25Feb26': 28.7,
            'Oct25Mar26': 29.0,
        };

        const nowcastValues = getUtdtNowcastValues(chartData, 'Jul25Dic25');

        expect(nowcastValues).toEqual([
            { fecha: '2026-01-01', value: 28.5, period: 'Ago25Ene26' },
            { fecha: '2026-02-01', value: 28.7, period: 'Sep25Feb26' },
            { fecha: '2026-03-01', value: 29.0, period: 'Oct25Mar26' },
        ]);
    });

    it('returns empty array when no periods after INDEC', () => {
        const chartData = {
            'Jul25Dic25': 28.2,
        };

        const nowcastValues = getUtdtNowcastValues(chartData, 'Jul25Dic25');
        expect(nowcastValues).toEqual([]);
    });
});
