import { describe, expect, it } from 'vitest';
import type { ChartViewConfig } from '@/types/chart';
import {
    clampChartRange,
    formatBaseDate,
    paddedAxisDomain,
    parsePersistedChartConfig,
    pickViewId,
    rebaseChartRows,
    restoreBaseDateByView,
    restoreHighlightedAreasByView,
    selectBaseRow,
    sortChartRows,
} from './chart-view-state';

const views = [
    { id: 'general', modes: [{ id: 'normal' }] },
    { id: 'sectores', modes: [{ id: 'normal' }] },
] as ChartViewConfig[];

describe('chart view memory', () => {
    it('ignores a stored config that is not an object', () => {
        expect(parsePersistedChartConfig(null)).toBeNull();
        expect(parsePersistedChartConfig('{')).toBeNull();
        expect(parsePersistedChartConfig('null')).toBeNull();
        expect(parsePersistedChartConfig('"emae"')).toBeNull();
        expect(parsePersistedChartConfig('{"selectedViewId":"sectores"}')).toEqual({ selectedViewId: 'sectores' });
    });

    it('keeps the requested view ahead of the stored one', () => {
        expect(pickViewId(views, 'sectores', 'general')).toBe('sectores');
        expect(pickViewId(views, 'missing', 'sectores')).toBe('sectores');
        expect(pickViewId(views, 'missing', 'also-missing')).toBe('general');
        expect(pickViewId(undefined, undefined, 'default')).toBe('default');
        expect(pickViewId(undefined, undefined, 'other')).toBe('default');
    });

    it('restores a base date saved under the legacy view:mode key', () => {
        expect(restoreBaseDateByView({ 'sectores:normal': '2024-01-01' }, views)).toEqual({ sectores: '2024-01-01' });
        expect(restoreBaseDateByView({ sectores: '2025-01-01', 'sectores:normal': '2024-01-01' }, views)).toEqual({ sectores: '2025-01-01' });
        expect(restoreBaseDateByView(undefined, views)).toEqual({});
    });

    it('drops highlighted series that belong to a view the chart no longer has', () => {
        const restored = restoreHighlightedAreasByView({
            sectores: ['pesca_mm12'],
            'general:normal': ['total'],
            removed: ['gone'],
        }, views);

        expect([...(restored.sectores ?? [])]).toEqual(['pesca_mm12']);
        expect([...(restored.general ?? [])]).toEqual(['total']);
        expect(restored.removed).toBeUndefined();
    });
});

describe('chart range and scale', () => {
    it('keeps a stored range inside the rows that are still loaded', () => {
        expect(clampChartRange(undefined, 10)).toEqual([0, 10]);
        expect(clampChartRange([-4, 80], 10)).toEqual([0, 10]);
        expect(clampChartRange([8, 2], 10)).toEqual([8, 8]);
        expect(clampChartRange([0, 0], 0)).toEqual([0, 0]);
    });

    it('sorts months by their ISO date when the Spanish label would not', () => {
        expect(sortChartRows([
            { fecha: 'OCT 26', iso_fecha: '2026-10-01' },
            { fecha: 'SEPT 26', iso_fecha: '2026-09-01' },
        ]).map(row => row.iso_fecha)).toEqual(['2026-09-01', '2026-10-01']);
    });

    it('anchors a positive auto scale at zero and pads a flat series', () => {
        expect(paddedAxisDomain('auto', [])).toEqual([0, 10]);
        expect(paddedAxisDomain('auto', [2, 4])).toEqual([0, 4.1]);
        expect(paddedAxisDomain('auto', [-5, 5])[0]).toBeLessThan(-5);
        expect(paddedAxisDomain('auto-pad', [10, 10])).toEqual([9, 11]);
    });

    it('formats the base-100 label with the chart month abbreviation', () => {
        expect(formatBaseDate('2026-01-01')).toBe('ENE-26');
    });

    it('rebases to 100 on the chosen month and skips a zero base', () => {
        const rows = [
            { iso_fecha: '2026-01-01', salario: 0, nota: 'cero' },
            { iso_fecha: '2026-02-01', salario: 50, nota: 'a' },
            { iso_fecha: '2026-03-01', salario: 80, nota: 'b' },
        ];
        const base = selectBaseRow(rows, ['salario'], '2026-01-01', '2026-02-01');

        expect(base?.iso_fecha).toBe('2026-02-01');
        expect(rebaseChartRows([
            ...rows,
            { iso_fecha: '2026-04-01', salario: 'no', nota: 'c' },
        ], base!, ['salario'])).toEqual([
            { iso_fecha: '2026-01-01', salario: 0, nota: 'cero' },
            { iso_fecha: '2026-02-01', salario: 100, nota: 'a' },
            { iso_fecha: '2026-03-01', salario: 160, nota: 'b' },
            { iso_fecha: '2026-04-01', salario: null, nota: 'c' },
        ]);
    });
});
