import { describe, expect, it } from 'vitest';
import { extractUtdtChartData, extractUtdtChartDataFromText, getUtdtNowcastValues } from '../lib/pobreza-ocr';
import { parseLatestUtdtNowcastRow, parseUtdtChartImageUrl, parseUtdtNowcastRowsFromChartData } from '../lib/pobreza-source';

describe('pobreza UTDT source parsing', () => {
    it('finds the current nowcast chart image in the page', () => {
        const html = '<p>El siguiente gráfico describe la evolución</p><img src="/imagen/_177879597705772700.png" class="">';
        expect(parseUtdtChartImageUrl(html)).toBe('https://www.utdt.edu/imagen/_177879597705772700.png');
    });

    it('extracts the latest nowcast from HTML text', () => {
        const html = 'El nowcast estima una tasa de pobreza de 29.2% para el semestre Nov25Abr26 con un intervalo';
        expect(parseLatestUtdtNowcastRow(html)).toEqual({ fecha: '2026-04-01', pobreza_utdt: 29.2 });
    });

    it('keeps the whole OCR nowcast series from October', () => {
        expect(parseUtdtNowcastRowsFromChartData({
            May25Oct25: 28.8,
            Jun25Nov25: 28.5,
            Jul25Dic25: 28.2,
            Ago25Ene26: 28.5,
            Sep25Feb26: 28.7,
            Oct25Mar26: 29,
            Nov25Abr26: 29.2,
        })).toEqual([
            { fecha: '2025-10-01', pobreza_utdt: 28.8 },
            { fecha: '2025-11-01', pobreza_utdt: 28.5 },
            { fecha: '2025-12-01', pobreza_utdt: 28.2 },
            { fecha: '2026-01-01', pobreza_utdt: 28.5 },
            { fecha: '2026-02-01', pobreza_utdt: 28.7 },
            { fecha: '2026-03-01', pobreza_utdt: 29 },
            { fecha: '2026-04-01', pobreza_utdt: 29.2 },
        ]);
    });
});

describe('pobreza OCR extraction', () => {
    it('normalizes OCR errors in the current chart value line', () => {
        const text = `
30% 28.8% 28.5% 28.2% 28.5% 28.7% 20% 292%
May250ct25 Jun25Nov25 Jul25Dic25 Ago25Ene26 Sep25Feb26 Oct25Mar26 Nov25Abr26
        `;

        expect(extractUtdtChartDataFromText(text)).toEqual({
            May25Oct25: 28.8,
            Jun25Nov25: 28.5,
            Jul25Dic25: 28.2,
            Ago25Ene26: 28.5,
            Sep25Feb26: 28.7,
            Oct25Mar26: 29,
            Nov25Abr26: 29.2,
        });
    });

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
