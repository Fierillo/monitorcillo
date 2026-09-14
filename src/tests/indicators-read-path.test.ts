import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalogService = vi.hoisted(() => ({ buildCurrentIndicatorsCatalog: vi.fn() }));
const db = vi.hoisted(() => ({
    getIndicatorsCatalog: vi.fn(),
    saveIndicatorsCatalog: vi.fn(),
}));

vi.mock('../lib/catalog-service', () => catalogService);
vi.mock('../lib/db', () => db);

describe('getIndicators', () => {
    beforeEach(() => {
        catalogService.buildCurrentIndicatorsCatalog.mockReset();
        db.getIndicatorsCatalog.mockReset();
    });

    it('surfaces a catalog failure instead of reporting that no indicators exist', async () => {
        catalogService.buildCurrentIndicatorsCatalog.mockRejectedValue(new Error('connect ECONNREFUSED'));
        const { getIndicators } = await import('../lib/indicators');

        await expect(getIndicators()).rejects.toThrow('ECONNREFUSED');
    });

    it('exposes the stored catalog columns under their view names', async () => {
        catalogService.buildCurrentIndicatorsCatalog.mockResolvedValue([{
            id: 'icg',
            indicador: 'Confianza en el Gobierno',
            referencia: '2,29',
            reference_description: 'Mes anterior',
            dato: '2,41',
            fecha: 'DIC 25',
            fuente: 'UTDT',
            trend: 'up',
            category: 'expectativas',
            has_details: true,
            source_url: 'https://www.utdt.edu',
            proxima_fecha: '2026-02-10',
        }]);
        const { getIndicators } = await import('../lib/indicators');

        await expect(getIndicators()).resolves.toEqual([{
            id: 'icg',
            indicador: 'Confianza en el Gobierno',
            referencia: '2,29',
            referenceDescription: 'Mes anterior',
            dato: '2,41',
            fecha: 'DIC 25',
            fuente: 'UTDT',
            trend: 'up',
            category: 'expectativas',
            hasDetails: true,
            sourceUrl: 'https://www.utdt.edu',
            proximaFecha: '2026-02-10',
            proximaFechaDescription: undefined,
        }]);
    });
});

describe('getStoredIndicator', () => {
    beforeEach(() => {
        db.getIndicatorsCatalog.mockReset();
        catalogService.buildCurrentIndicatorsCatalog.mockReset();
    });

    it('reads a single indicator from the stored catalog without rebuilding series', async () => {
        db.getIndicatorsCatalog.mockResolvedValue([{
            id: 'icg',
            indicador: 'Confianza en el Gobierno',
            referencia: '2,29',
            dato: '2,41',
            fecha: 'DIC 25',
            fuente: 'UTDT',
            trend: 'up',
            category: 'expectativas',
            has_details: true,
            source_url: 'https://www.utdt.edu',
        }]);
        const { getStoredIndicator } = await import('../lib/indicators');

        await expect(getStoredIndicator('icg')).resolves.toMatchObject({
            id: 'icg',
            hasDetails: true,
            indicador: 'Confianza en el Gobierno',
        });
        expect(catalogService.buildCurrentIndicatorsCatalog).not.toHaveBeenCalled();
    });
});
