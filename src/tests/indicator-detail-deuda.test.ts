import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Indicator } from '@/types';

const storage = vi.hoisted(() => ({ getIndicatorData: vi.fn() }));
const deudaDb = vi.hoisted(() => ({ getDeudaVencimientos: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('../lib/db', () => ({ getRawData: vi.fn() }));
vi.mock('../lib/storage', () => storage);
vi.mock('../lib/db/deuda', () => deudaDb);

import { getIndicatorDetailConfig } from '../lib/indicator-detail-configs';
import { contrastRatio } from '../lib/color-contrast';

const deuda: Indicator = { id: 'deuda', fecha: 'SEPT 26', fuente: 'Secretaría de Finanzas', indicador: 'Perfil de deuda pública', referencia: 'USD 454.037 M', dato: 'USD 486.628 M' };

beforeEach(() => {
    storage.getIndicatorData.mockReset();
    storage.getIndicatorData.mockResolvedValue([
        { fecha: 'DIC 25', iso_fecha: '2025-12-01', stock_usd: 455076.7, deuda_pbi_oficial: 78.1, total: 1 },
        { fecha: 'JUN 26', iso_fecha: '2026-06-01', stock_usd: 474198, deuda_pbi_oficial: 71.4, total: 1 },
        { fecha: 'SEPT 26', iso_fecha: '2026-09-01', stock_usd: 486627.5, deuda_pbi_oficial: null, total: 1 },
        { fecha: 'DIC 35', iso_fecha: '2035-12-01', stock_usd: null, deuda_pbi_oficial: null, total: -0.2 },
    ]);
    deudaDb.getDeudaVencimientos.mockResolvedValue({
        corte: '2026-06-30',
        fuenteUrl: 'https://www.argentina.gob.ar/sites/default/files/deuda_publica_30-06-2026_0.xlsx',
        anuales: [{ periodo: '2026', capital: 80717.06, interes: 5432.72 }, { periodo: '2027', capital: 90128.26, interes: 10438.59 }, { periodo: '2036-2089', capital: 43013.47, interes: 9034.17 }],
        proximos12m: { capital: 137211.79, interes: 10717.9 },
    });
});

describe('deuda detail config', () => {
    it('states the next-12-month maturities and offers stock and maturities in USD or % of GDP', async () => {
        const config = await getIndicatorDetailConfig(deuda);
        expect(config?.subtitle).toContain('Vencen USD 147.930 M en los próximos 12 meses (jul-26 a jun-27)');
        const [stock, vencimientos] = config?.views ?? [];
        expect([stock?.id, vencimientos?.id]).toEqual(['stock', 'vencimientos']);
        for (const view of [stock, vencimientos]) expect(view?.modes?.map(mode => mode.label)).toEqual(['Millones de USD', '% del PBI']);
        expect(stock?.modes?.[0].data.map(row => row.stock_usd)).toEqual([455076.7, 474198, 486627.5]);
        expect(stock?.modes?.[1].data.map(row => row.deuda_pbi_oficial)).toEqual([78.1, 71.4]);
    });

    it('stacks capital and interest per year, labels the partial year and divides by the implied GDP in USD', async () => {
        const config = await getIndicatorDetailConfig(deuda);
        const vencimientos = config?.views?.find(view => view.id === 'vencimientos');
        expect(vencimientos?.areas.filter(area => area.type === 'bar').map(area => [area.key, area.stackId])).toEqual([['capital', 'vencimientos'], ['interes', 'vencimientos']]);
        const [usd, pbi] = vencimientos?.modes ?? [];
        expect(usd.data.map(row => row.fecha)).toEqual(['2026 (jul-dic)', '2027', '2036-2089']);
        // Year-dated rows let the shared chart order and label every bar.
        expect(usd.data.map(row => row.iso_fecha)).toEqual(['2026-01-01', '2027-01-01', '2036-01-01']);
        expect(usd.data[0]).toMatchObject({ capital: 80717.06, interes: 5432.72 });
        const gdpUsd = 474198 / 0.714;
        expect(pbi.data[0].capital).toBeCloseTo(80717.06 / gdpUsd * 100, 6);
        const text = (vencimientos?.methodology ?? []).map(item => item.description).join(' ');
        expect(text).toContain('A.4.7');
        expect(text).toContain('A.3.6');
    });

    it('draws the new series with enough contrast on the chart background', async () => {
        const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
        const background = css.match(/--color-imperial-blue:\s*(#[0-9A-Fa-f]{6})/i)?.[1] ?? '';
        const config = await getIndicatorDetailConfig(deuda);
        for (const view of (config?.views ?? []).filter(view => view.id !== 'flujos')) {
            for (const area of [...view.areas, ...(view.modes ?? []).flatMap(mode => mode.areas ?? [])]) {
                expect(contrastRatio(area.color, background), `${view.id}.${area.key}`).toBeGreaterThanOrEqual(3);
            }
        }
    });
});
