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
        expect(preview.series).toHaveLength(1);
        expect(preview.series[0].color).toBe('#FFD700');
        expect(preview.series[0].path.startsWith('M')).toBe(true);
        expect(preview.series[0].path).toContain(' L');
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
        expect(preview.series[0].color).toBe('#00BFFF');
    });
});
