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
    it('uses the exact latest raw BMA date and clarifies PBI percentage values', () => {
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

    it('shows the latest recaudacion period without an artificial day', () => {
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

        expect(result[0].fecha).toBe('MAY 26');
        expect(result[0].dato).toBe('4,2% del PBI');
    });

    it('shows the latest EMAE period without an artificial day', () => {
        const catalog = [{ ...baseCatalogRow, id: 'emae' }];

        const result = buildIndicatorsCatalog(catalog, {
            emae: [
                { iso_fecha: '2026-05-01', emae_desestacionalizado: 108.2 },
            ],
        }, {
            emae: [
                { fecha: '2026-05-01', emae_desestacionalizado: 108.2 },
            ],
        });

        expect(result[0].fecha).toBe('MAY 26');
        expect(result[0].dato).toBe('108,2');
    });

    it('shows the latest poder adquisitivo period without an artificial day', () => {
        const catalog = [{ ...baseCatalogRow, id: 'poder-adquisitivo' }];

        const result = buildIndicatorsCatalog(catalog, {
            poder: [
                { iso_fecha: '2026-05-01', blanco: 88.8 },
            ],
        }, {
            poder: [
                { fecha: '2026-05-01', salario_registrado: 100 },
            ],
        });

        expect(result[0].fecha).toBe('MAY 26');
        expect(result[0].dato).toBe('88,8');
    });

    it('keeps day labels for daily emission data', () => {
        const catalog = [{ ...baseCatalogRow, id: 'emision' }];

        const result = buildIndicatorsCatalog(catalog, {
            emision: [
                { iso_fecha: '2026-05-01', ACUMULADO: 100 },
            ],
        }, {
            emision: [
                { fecha: '2026-05-02', bcra: 12 },
            ],
        });

        expect(result[0].fecha).toBe('2 MAY 26');
        expect(result[0].dato).toBe('$100M');
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

    it('uses latest-row data sources without loading full raw and normalized tables', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{
                ...baseCatalogRow,
                id: 'bma',
                fecha: '1 ABR 26',
                dato: '6,7%',
            }],
            getLatestNormalizedRow: async (type, valueColumn) => {
                if (type !== 'bma') return null;
                expect(valueColumn).toBe('bma_amplia');
                return { iso_fecha: '2026-04-01', BMAmplia: 6.7 };
            },
            getLatestRawDate: async (type, fields) => {
                if (type !== 'bma') return null;
                expect(fields).toContain('base_monetaria');
                return '2026-05-02';
            },
            getNormalizedRows: async () => {
                throw new Error('Full normalized table should not be loaded');
            },
            getRawRows: async () => {
                throw new Error('Full raw table should not be loaded');
            },
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({
            fecha: '2 MAY 26',
            dato: '6,7% del PBI',
        });
    });

    it('uses publication date metadata for EMAE in the current catalog', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{
                ...baseCatalogRow,
                id: 'emae',
            }],
            getLatestNormalizedRow: async (type, valueColumn) => {
                if (type !== 'emae') return null;
                expect(valueColumn).toBe('emae_desestacionalizado');
                return { iso_fecha: '2026-02-01', emae_desestacionalizado: 105.2 };
            },
            getLatestRawDate: async (type, fields) => {
                if (type !== 'emae') return null;
                expect(fields).toContain('emae_desestacionalizado');
                return '2026-02-01';
            },
            getPublicationDate: async (id) => id === 'emae' ? '2026-04-22' : null,
            getNormalizedRows: async () => {
                throw new Error('Full normalized table should not be loaded');
            },
            getRawRows: async () => {
                throw new Error('Full raw table should not be loaded');
            },
        });

        expect(result.find(row => row.id === 'emae')).toMatchObject({
            fecha: '22 ABR 26',
            dato: '105,2',
        });
    });
});
