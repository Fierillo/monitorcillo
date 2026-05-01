import { describe, expect, it } from 'vitest';
import { buildIndicatorsCatalog } from '../lib/catalog';
import { buildCurrentIndicatorsCatalog } from '../lib/catalog-service';
import type { CatalogIndicatorRow } from '@/types';

const baseCatalogRow: CatalogIndicatorRow = {
    id: '',
    indicador: '',
    referencia: '',
    dato: '-',
    fecha: '-',
    fuente: '',
    trend: 'neutral',
    category: 'default',
    has_details: true,
    source_url: null,
};

describe('buildIndicatorsCatalog', () => {
    it('uses the latest non-empty raw BMA date and clarifies PBI percentage values', () => {
        const catalog = [{ ...baseCatalogRow, id: 'bma' }];

        const result = buildIndicatorsCatalog(catalog, {
            bma: [
                { iso_fecha: '2026-04-01', BMAmplia: 6.7 },
                { iso_fecha: '2026-05-01', BMAmplia: null },
            ],
        }, {
            bma: [
                { fecha: '2026-04-01', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-04-22', base_monetaria: 10, pases: 2 },
                { fecha: '2026-04-23', depositos_tesoro: 4 },
                { fecha: '2026-04-24', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-05-01', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-05-02', base_monetaria: 12 },
                { fecha: '2026-05-03', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
            ],
        });

        expect(result[0].fecha).toBe('2 MAY 26');
        expect(result[0].dato).toBe('6,7% del PBI');
    });

    it('applies raw-date selection and PBI percentage formatting to other indicators', () => {
        const catalog = [{ ...baseCatalogRow, id: 'recaudacion' }];

        const result = buildIndicatorsCatalog(catalog, {
            reca: [
                { iso_fecha: '2026-03-01', pctPbi: null },
                { iso_fecha: '2026-04-01', pctPbi: 4.2 },
            ],
        }, {
            reca: [
                { fecha: '2026-04-01', recaudacion_total: 100, pbi_trimestral: 200 },
                { fecha: '2026-05-01', pbi_trimestral: 200, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-05-02', recaudacion_total: 120 },
            ],
        });

        expect(result[0].fecha).toBe('2 MAY 26');
        expect(result[0].dato).toBe('4,2% del PBI');
    });

    it('derives persisted catalog rows from raw and normalized data for the table source', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{
                ...baseCatalogRow,
                id: 'bma',
                fecha: '1 ABR 26',
                dato: '6,7%',
            }],
            getNormalizedRows: async (type) => type === 'bma'
                ? [
                    { iso_fecha: '2026-04-01', BMAmplia: 6.7 },
                    { iso_fecha: '2026-05-01', BMAmplia: null },
                ]
                : null,
            getRawRows: async (type) => type === 'bma'
                ? [
                    { fecha: '2026-04-01', pbi_trimestral: 100 },
                    { fecha: '2026-05-02', base_monetaria: 12 },
                ]
                : null,
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({
            fecha: '2 MAY 26',
            dato: '6,7% del PBI',
        });
    });
});
