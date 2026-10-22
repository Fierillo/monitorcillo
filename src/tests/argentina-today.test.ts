import { afterEach, describe, expect, it, vi } from 'vitest';
import { argentinaToday } from '@/lib/normalize/dates';
import { buildIndicatorCatalogItem, CATALOG_INDICATOR_SPECS } from '@/lib/catalog';
import { baseCatalogRow } from './catalog-test-utils';

describe('argentinaToday', () => {
    afterEach(() => vi.useRealTimers());

    it('still says the Argentine day at 21:30 in Buenos Aires, when UTC is already tomorrow', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-22T00:30:00Z'));
        expect(argentinaToday()).toBe('2026-10-21');
    });

    it('drives the catalog next date, so a release due tomorrow in Argentina is not skipped at 21:30', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-22T00:30:00Z'));
        const item = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'deuda' }, CATALOG_INDICATOR_SPECS.deuda, { iso_fecha: '2026-09-01', stock_usd: 1 }, '2026-09-01', null, null, [], [], { 'deuda-boletin': '2026-09-22' });
        expect(item.proxima_fecha).toBe('22 OCT 26');
    });
});
