import { describe, expect, it } from 'vitest';
import { buildOgPreview, downsampleRows } from '../lib/chart-og-preview';

describe('chart OG preview', () => {
    it('downsamples long series while keeping endpoints', () => {
        const rows = Array.from({ length: 11 }, (_, index) => index);
        expect(downsampleRows(rows, 5)).toEqual([0, 3, 5, 8, 10]);
    });

    it('builds a path from the default chart view', () => {
        const preview = buildOgPreview({
            chartTitle: 'Fallback',
            data: [{ valor: 1 }, { valor: 2 }],
            areas: [{ key: 'valor', name: 'Valor', color: '#FFFFFF', type: 'line' }],
            views: [{
                id: 'main',
                label: 'Principal',
                chartTitle: 'EMAE desestacionalizado',
                data: [
                    { fecha: 'ENE 25', emae: 100 },
                    { fecha: 'FEB 25', emae: 110 },
                    { fecha: 'MAR 25', emae: 105 },
                ],
                areas: [
                    { key: 'emae', name: 'EMAE', color: '#FFD700', type: 'line' },
                    { key: 'oculto', name: 'Oculto', color: '#000', type: 'line', hideInLegend: true },
                ],
                methodology: [],
            }],
        });

        expect(preview.chartTitle).toBe('EMAE desestacionalizado');
        expect(preview.lines).toHaveLength(1);
        expect(preview.lines[0].color).toBe('#FFD700');
        expect(preview.lines[0].path.startsWith('M')).toBe(true);
        expect(preview.lines[0].path).toContain(' L');
    });

    it('uses the requested view and mode instead of the default chart', () => {
        const preview = buildOgPreview({
            chartTitle: 'Default',
            data: [{ valor: 1 }, { valor: 2 }],
            areas: [{ key: 'valor', name: 'Valor', color: '#FFFFFF', type: 'line' }],
            views: [
                {
                    id: 'main',
                    label: 'Principal',
                    chartTitle: 'Principal',
                    data: [{ a: 1 }, { a: 2 }],
                    areas: [{ key: 'a', name: 'A', color: '#FFD700', type: 'line' }],
                    methodology: [],
                },
                {
                    id: 'sectores',
                    label: 'Sectores',
                    chartTitle: 'Sectores',
                    areas: [{ key: 'industria', name: 'Industria', color: '#00BFFF', type: 'line' }],
                    methodology: [],
                    modes: [
                        { id: 'normal', label: 'Normal', chartTitle: 'Normal', data: [{ industria: 1 }, { industria: 2 }], yAxisLabel: 'x' },
                        { id: 'per-capita', label: 'Per cápita', chartTitle: 'Per cápita', data: [{ industria: 10 }, { industria: 20 }, { industria: 30 }], yAxisLabel: 'x' },
                    ],
                },
            ],
        }, { viewId: 'sectores', modeId: 'per-capita' });

        expect(preview.chartTitle).toBe('Per cápita');
        expect(preview.lines[0].color).toBe('#00BFFF');
    });

    it('draws stacked bars and overlay lines on one zero baseline', () => {
        const preview = buildOgPreview({
            chartTitle: 'Default',
            data: [],
            areas: [],
            leftYAxisDomain: [0, 'auto'],
            views: [{
                id: 'unidad',
                label: 'Unidad',
                chartTitle: 'Stock',
                areas: [
                    { key: 'pesos', name: 'Pesos', color: '#438FC7', type: 'bar', stackId: 'depositos' },
                    { key: 'dolares', name: 'Dólares', color: '#2F7D16', type: 'bar', stackId: 'depositos' },
                    { key: 'total', name: 'Total', color: '#C99F00', type: 'line' },
                    { key: 'oculto', name: 'Oculto', color: '#FFFFFF', type: 'line', hideInLegend: true },
                ],
                methodology: [],
                modes: [{
                    id: 'pbi',
                    label: '% PBI',
                    chartTitle: 'Stock',
                    yAxisLabel: '% de PBI real',
                    leftYAxisDomain: [0, 'auto'],
                    data: [
                        { pesos: 10, dolares: 20, total: 30, oculto: 1 },
                        { pesos: 20, dolares: 10, total: 30, oculto: 2 },
                    ],
                }],
            }],
        }, { viewId: 'unidad', modeId: 'pbi' });

        expect(preview.modeLabel).toBe('% PBI');
        expect(preview.bars).toHaveLength(4);
        expect(preview.lines).toHaveLength(1);
        expect(preview.legend.map(item => item.name)).toEqual(['Pesos', 'Dólares', 'Total']);
        const [lower, upper] = preview.bars;
        expect(lower.y).toBeCloseTo(upper.y + upper.height, 4);
        expect(preview.lines[0].path.startsWith(`M${(0.5 / 2 * 1100).toFixed(1)} ${upper.y.toFixed(1)}`)).toBe(true);
    });
});
