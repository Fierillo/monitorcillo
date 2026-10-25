import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIndicatorCatalogItem, CATALOG_INDICATOR_SPECS } from '@/lib/catalog';
import { baseCatalogRow } from './catalog-test-utils';

describe('gasto público catalog row', () => {
    afterEach(() => vi.useRealTimers());

    it('shows the stored partial year as accumulated to its cut, not compared with a full year, next cut three months later', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-24T15:00:00Z'));
        const partial = { iso_fecha: '2026-01-01', total: 22.668, kind: 'partial', as_of: '2026-10-21', partial_quarters: 2 };
        const previous = { iso_fecha: '2025-01-01', total: 34, kind: 'estimate' };
        const item = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'gasto-publico' }, CATALOG_INDICATOR_SPECS['gasto-publico'], partial, null, '2026-10-21', previous, [previous, partial]);
        expect(item.dato.length).toBeLessThanOrEqual(50); // indicators_catalog.dato is VARCHAR(50)
        expect(item).toMatchObject({ dato: '22,7% del PBI acum. (Nac. 21/10, Prov. 30/06)', referencia: '-', fecha: '21 OCT 26', trend: 'neutral', proxima_fecha: '21 ENE 27' });
    });

    it('compares a closed year with the previous one', () => {
        const estimate = { iso_fecha: '2025-01-01', total: 33, kind: 'estimate' };
        const previous = { iso_fecha: '2024-01-01', total: 35.6, kind: 'preliminary' };
        const item = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'gasto-publico' }, CATALOG_INDICATOR_SPECS['gasto-publico'], estimate, null, null, previous, [previous, estimate]);
        expect(item).toMatchObject({ dato: '33,0% del PBI', referencia: '35,6% del PBI', reference_description: 'Año anterior', trend: 'up' });
    });

    it('defaults its source to the official MECON executions', async () => {
        const { DEFAULT_CATALOG } = await import('@/lib/catalog');
        expect(DEFAULT_CATALOG.find(row => row.id === 'gasto-publico')?.fuente).toBe('MECON (DGSIAF y APNF)');
    });
});
