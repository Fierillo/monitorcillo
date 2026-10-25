import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Indicator } from '@/types';

const storage = vi.hoisted(() => ({ getIndicatorData: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('../lib/db', () => ({ getRawData: vi.fn() }));
vi.mock('../lib/storage', () => storage);

import { getIndicatorDetailConfig } from '../lib/indicator-detail-configs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChartTooltip from '../components/chart/ChartTooltip';

const indicator: Indicator = { id: 'gasto-publico', fecha: '2026', fuente: 'MECON', indicador: 'Gasto público consolidado', referencia: '-', dato: '-' };
const stored = [
    { fecha: '2025', iso_fecha: '2025-01-01', nation: 15, provinces: 15, municipalities: 3, interest: 1, total: 34, kind: 'estimate', as_of: null, partial_quarters: null, bridge_year: null },
    { fecha: '2026', iso_fecha: '2026-01-01', nation: 15.22, provinces: 14.9, municipalities: 2.975, interest: 1.85, total: 34.945, kind: 'partial', as_of: '2026-10-21', partial_quarters: 2, bridge_year: 2024, interest_subnational: 0.15 },
];

describe('gasto público detail config', () => {
    beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-24T12:00:00Z') }));
    afterEach(() => vi.useRealTimers());

    it('charts the rows stored in Neon, partial year included', async () => {
        storage.getIndicatorData.mockResolvedValue(stored);
        const config = await getIndicatorDetailConfig(indicator);
        expect(storage.getIndicatorData).toHaveBeenCalledWith('gasto-publico');
        expect(config?.data.at(-1)).toMatchObject({ fecha: '2026', nationPartial: 15.22, totalPartial: 34.945, partial: true, partialAsOf: '2026-10-21' });
        expect(config?.subtitle).not.toContain('último dato guardado');
        const texts = JSON.stringify([config?.areas, config?.methodology, config?.subtitle]);
        expect(texts).toContain('2026 parcial: Nación al 21/10/2026, provincias al 30/06/2026');
        expect(config?.subtitle).toContain('2026 acumulado (Nación al 21/10/2026, provincias al 30/06/2026)');
        expect(config?.methodology.find(item => item.title === 'Parcial 2026')?.description).toContain('Nación (DGSIAF) al 21/10/2026; provincias (APNF) al 30/06/2026');
        expect(config?.methodology.find(item => item.title === 'Anualizado 2026')?.description).toContain('×4/2 desde el 30/06/2026');
        expect(texts).not.toMatch(/acumulado al 21\/10/);
        expect(config?.areas.filter(area => /^municipalities(Estimate|Partial)$/.test(area.key)).map(area => area.name)).toEqual(['Municipios (estimado)', 'Municipios (estimado)']);
        expect(config?.methodology.find(item => item.title === 'Municipios: estimado')?.description).toContain('relación municipios/provincias 2024');
        expect(texts).not.toMatch(/Econviews/i);
        expect(config?.data.at(-1)?.totalAnnualized).toBeGreaterThan(34.945);
        const names = config?.areas.map(area => area.name) ?? [];
        expect(names).toContain('Nación');
        const tooltipNames = config?.areas.filter(area => !area.hideInTooltip).map(area => area.name) ?? [];
        expect(Math.max(...tooltipNames.map(name => name.length))).toBeLessThanOrEqual(22);
        expect(config?.data.at(-1)?.tooltipHeader).toBe('2026 · Nación al 21/10, provincias al 30/06');
        expect(config?.data.at(-2)?.tooltipHeader).toBeUndefined();
        const annualizedArea = (key: string) => config?.areas.find(area => area.key === key);
        expect(annualizedArea('nationAnnualized')).toMatchObject({ name: 'Nación', color: 'transparent', tooltipColor: '#8B5CF6', tooltipSection: '2026 estimado' });
        expect(annualizedArea('municipalitiesAnnualized')).toMatchObject({ name: 'Municipios', tooltipColor: '#7DD3FC', tooltipSection: '2026 estimado' });
        expect(annualizedArea('totalProjected')).toMatchObject({ name: 'Total', tooltipSection: '2026 estimado' });
        expect(annualizedArea('totalAnnualized')).toMatchObject({ hideInTooltip: true });
        expect(config?.areas.find(area => area.key === 'totalAnnualized')).toMatchObject({ name: 'Total anualizado', type: 'line', dash: [2, 3] });
        expect(config?.areas.find(area => area.key === 'annualizedGap')).toMatchObject({ type: 'bar', stackId: 'spending', fill: false, dash: [3, 3], hideInTooltip: true, openBottom: true, preliminaryBlink: true });
        expect(config?.areas.find(area => area.key === 'nationAnnualized')).toMatchObject({ name: 'Nación' });
        const projection = config?.methodology.find(item => item.title === 'Anualizado 2026');
        expect(projection?.description).toContain('proyección lineal, no un pronóstico');
        expect(projection?.description).toContain('aguinaldo');
    });

    it('lists the projection only in the partial year tooltip, while the dotted line starts at 2025', async () => {
        const config = (await getIndicatorDetailConfig(indicator))!;
        const tooltip = (label: string) => renderToStaticMarkup(createElement(ChartTooltip, { chartData: config.data, areaConfigs: config.areas, valueFormat: 'percent', showTotal: config.showTooltipTotal, tooltipProps: { active: true, label } }));
        expect(config.data.at(-2)?.totalAnnualized).toBe(34);
        expect(tooltip('2025')).not.toMatch(/estimado<|anualizado/);
        expect(tooltip('2026')).toContain('2026 estimado');
        expect(config.methodology.find(item => item.title === 'Lectura')?.description).toContain('el tramo punteado llega al total anualizado');
        const last = config.data.at(-1)!;
        expect(config.areas.filter(area => area.type === 'line' && area.dash && last[area.key] != null).map(area => area.key)).toEqual(['totalAnnualized']);
        expect(tooltip('2026').split('2026 estimado')[0]).toContain('Total: 34,9%');
        expect(tooltip('2026').split('2026 estimado')[1]).toContain('Total:');
    });

    it('keeps showing the last stored year with a stale warning when the current year is missing', async () => {
        storage.getIndicatorData.mockResolvedValue(stored.slice(0, 1));
        const config = await getIndicatorDetailConfig(indicator);
        expect(config?.data).toHaveLength(1);
        expect(config?.subtitle).toContain('Sin datos de 2026: se muestra el último dato guardado (2025)');
    });
});
