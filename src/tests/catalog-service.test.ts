import { describe, expect, it } from 'vitest';
import { buildCurrentIndicatorsCatalog } from '../lib/catalog-service';
import type { DataRow, IndicatorType } from '@/types';
import { baseCatalogRow } from './catalog-test-utils';

describe('buildCurrentIndicatorsCatalog', () => {
    it('refreshes persisted catalog references from indicator specs', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma', referencia: 'Referencia vieja' }],
            getLatestNormalizedRow: async (type, valueColumn, fallbackColumns) => {
                if (type !== 'bma') return null;
                expect(valueColumn).toBe('bma_amplia');
                return { iso_fecha: '2026-04-01', BMAmplia: 6.7 };
            },
            getLatestRawDate: async (type) => type === 'bma' ? '2026-05-02' : null,
            getNormalizedRowByDate: async (type, date) => type === 'bma' && date === '2026-03-01' ? { iso_fecha: '2026-03-01', BMAmplia: 5.8 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => { throw new Error('Full normalized table should not be loaded'); },
            getRawRows: async () => { throw new Error('Full raw table should not be loaded'); },
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({ referencia: '5,8% del PBI real', reference_description: 'Mes anterior', dato: '6,7% del PBI real', trend: 'down' });
    });

    it('derives persisted catalog rows from raw and normalized data for the table source', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma', fecha: '1 ABR 26', dato: '6,7%' }],
            getNormalizedRows: async (type) => type === 'bma' ? [{ iso_fecha: '2026-04-01', BMAmplia: 6.7 }, { iso_fecha: '2026-05-01', BMAmplia: null }] : null,
            getRawRows: async (type) => type === 'bma' ? [{ fecha: '2026-04-01', pbi_trimestral: 100 }, { fecha: '2026-05-02', base_monetaria: 12 }] : null,
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({ fecha: '2 MAY 26', dato: '6,7% del PBI real' });
    });

    it('uses latest-row data sources without loading full tables', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma', fecha: '1 ABR 26', dato: '6,7%' }],
            getLatestNormalizedRow: async (type, valueColumn, fallbackColumns) => {
                if (type !== 'bma') return null;
                expect(valueColumn).toBe('bma_amplia');
                return { iso_fecha: '2026-04-01', BMAmplia: 6.7 };
            },
            getLatestRawDate: async (type, fields) => {
                if (type !== 'bma') return null;
                expect(fields).toContain('base_monetaria');
                return '2026-05-02';
            },
            getNormalizedRows: async () => { throw new Error('Full normalized table should not be loaded'); },
            getRawRows: async () => { throw new Error('Full raw table should not be loaded'); },
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({ fecha: '2 MAY 26', dato: '6,7% del PBI real' });
    });

    it('uses publication date metadata for monthly indicators', async () => {
        await expectPublishedDate('emae', 'emae', 'emae_desestacionalizado', { iso_fecha: '2026-02-01', emae_desestacionalizado: 105.2 }, '2026-04-22', { fecha: '22 ABR 26', dato: '105,2', proxima_fecha: '22 MAY 26' });
        await expectPublishedDate('recaudacion', 'reca', 'pct_pbi', { iso_fecha: '2026-04-01', pctPbi: 2.2 }, '2026-05-04', { fecha: '4 MAY 26', dato: '2,2% del PBI real', proxima_fecha: '4 JUN 26' });
    });

    it('uses publication date metadata and previous-month reference for poder adquisitivo', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'poder-adquisitivo' }],
            getLatestNormalizedRow: async (type, valueColumn, fallbackColumns) => {
                if (type !== 'poder') return null;
                expect(valueColumn).toBe('blanco');
                return { iso_fecha: '2026-02-01', blanco: 88.8 };
            },
            getLatestRawDate: async () => '2026-02-01',
            getPublicationDate: async (id) => id === 'poder-adquisitivo' ? '2026-04-17' : null,
            getNormalizedRowByDate: async (type, date) => type === 'poder' && date === '2026-01-01' ? { iso_fecha: '2026-01-01', blanco: 91.2 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => { throw new Error('Full normalized table should not be loaded'); },
            getRawRows: async () => { throw new Error('Full raw table should not be loaded'); },
        });

        expect(result.find(row => row.id === 'poder-adquisitivo')).toMatchObject({ fecha: '17 ABR 26', referencia: 'PA blanco: 91,2', reference_description: 'Mes anterior', dato: 'PA blanco: 88,8', trend: 'down', proxima_fecha: '17 MAY 26' });
    });

    it('uses publication date metadata for inflation', async () => {
        await expectPublishedDate('inflacion', 'inflacion', 'ipc', { iso_fecha: '2026-03-01', ipc: 6.1 }, '2026-04-15', { fecha: '15 ABR 26', dato: '6,1%', reference_description: 'Mes anterior', trend: 'down', proxima_fecha: '15 MAY 26' }, ['ipc_equilibra', 'ipc_online', 'ipc_indec', 'ipc_nucleo_indec'], { iso_fecha: '2026-02-01', ipc: 5.5 });
    });
});

async function expectPublishedDate(id: string, type: IndicatorType, valueColumn: string, row: DataRow, publicationDate: string, expected: object, expectedFallbackColumns?: string[], referenceRow?: DataRow) {
    const result = await buildCurrentIndicatorsCatalog({
        getCatalogRows: async () => [{ ...baseCatalogRow, id }],
            getLatestNormalizedRow: async (candidateType, candidateValueColumn, candidateFallbackColumns) => {
                if (candidateType !== type) return null;
                expect(candidateValueColumn).toBe(valueColumn);
                expect(candidateFallbackColumns ?? []).toEqual(expectedFallbackColumns ?? []);
                return row;
            },
        getLatestRawDate: async () => String(row.iso_fecha ?? row.fecha ?? ''),
        getPublicationDate: async (candidateId) => candidateId === id ? publicationDate : null,
        getNormalizedRowByDate: async (candidateType, date) => candidateType === type && referenceRow && date === (referenceRow.iso_fecha ?? referenceRow.fecha) ? referenceRow : null,
        getRawRowByDate: async () => null,
        getNormalizedRows: async () => { throw new Error('Full normalized table should not be loaded'); },
        getRawRows: async () => { throw new Error('Full raw table should not be loaded'); },
    });

    expect(result.find(candidate => candidate.id === id)).toMatchObject(expected);
}
