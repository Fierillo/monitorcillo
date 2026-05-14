import { describe, expect, it } from 'vitest';
import { buildCurrentIndicatorsCatalog } from '../lib/catalog-service';
import type { DataRow, IndicatorType } from '@/types';
import { baseCatalogRow } from './catalog-test-utils';

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

function addMonthsFromDate(date: string, months: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().split('T')[0];
}

function futureMonthly(baseDate: string): string {
    const today = new Date().toISOString().split('T')[0];
    let date = addMonthsFromDate(baseDate, 1);
    while (date <= today) date = addMonthsFromDate(date, 1);
    return date;
}

function formatDay(date: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

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
        await expectPublishedDate('emae', 'emae', 'emae_desestacionalizado', { iso_fecha: '2026-02-01', emae_desestacionalizado: 105.2 }, '2026-04-22', { fecha: '22 ABR 26', dato: '105,2', proxima_fecha: formatDay(futureMonthly('2026-04-22')) });
        await expectPublishedDate('recaudacion', 'reca', 'pct_pbi', { iso_fecha: '2026-04-01', pctPbi: 2.2 }, '2026-05-04', { fecha: '4 MAY 26', dato: '2,2% del PBI real', proxima_fecha: formatDay(futureMonthly('2026-05-04')) });
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

        expect(result.find(row => row.id === 'poder-adquisitivo')).toMatchObject({ fecha: '17 ABR 26', referencia: 'PA blanco: 91,2', reference_description: 'Mes anterior', dato: 'PA blanco: 88,8', trend: 'down', proxima_fecha: formatDay(futureMonthly('2026-04-17')) });
    });

    it('uses publication date metadata for inflation', async () => {
        await expectPublishedDate('inflacion', 'inflacion', 'ipc', { iso_fecha: '2026-03-01', ipc: 6.1 }, '2026-04-15', { fecha: '15 ABR 26', dato: '6,1%', reference_description: 'Mes anterior', trend: 'down', proxima_fecha: formatDay(futureMonthly('2026-04-15')) }, ['ipc_equilibra', 'ipc_online', 'ipc_indec', 'ipc_nucleo_indec'], { iso_fecha: '2026-02-01', ipc: 5.5 });
    });

    it('uses INDEC publication date and nearest inflation source for next date', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'inflacion' }],
            getLatestNormalizedRow: async (type) => type === 'inflacion' ? { iso_fecha: '2026-04-01', ipc: 2.6 } : null,
            getLatestRawDate: async () => '2026-04-01',
            getPublicationDate: async (id) => id === 'inflacion' ? '2026-05-14' : null,
            getPublicationDates: async () => ({
                'inflacion-indec': '2026-05-14',
                'inflacion-equilibra': '2026-05-10',
                'inflacion-ipc-online': '2026-05-03',
            }),
            getNormalizedRowByDate: async (type, date) => type === 'inflacion' && date === '2026-03-01' ? { iso_fecha: '2026-03-01', ipc: 3.4 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => [],
            getRawRows: async () => [{ fecha: '2026-04-01', ipc_indec_general: 1, ipc_equilibra: 1, ipc_online: 1 }],
        });

        expect(result.find(row => row.id === 'inflacion')).toMatchObject({
            fecha: '14 MAY 26',
            proxima_fecha: formatDay(futureMonthly('2026-05-03')),
            proxima_fecha_description: 'IPC Online',
        });
    });

    it('uses UTDT publication date and nowcast source for poverty', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'pobreza' }],
            getLatestNormalizedRow: async (type) => type === 'pobreza' ? { iso_fecha: '2026-03-01', pobreza_utdt: 29 } : null,
            getLatestRawDate: async () => '2026-03-01',
            getPublicationDate: async (id) => id === 'pobreza' ? '2026-05-14' : null,
            getPublicationDates: async () => ({ 'pobreza-utdt': '2026-05-14' }),
            getNormalizedRowByDate: async (type, date) => type === 'pobreza' && date === '2025-03-01' ? { iso_fecha: '2025-03-01', pobreza_indec: 38.1 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => [],
            getRawRows: async () => [{ fecha: '2026-03-01', pobreza_utdt: 29 }, { fecha: '2026-01-01', pobreza_indec: 28.2 }],
        });

        expect(result.find(row => row.id === 'pobreza')).toMatchObject({
            fecha: '14 MAY 26',
            proxima_fecha: formatDay(futureMonthly('2026-05-14')),
            proxima_fecha_description: 'Nowcast UTDT',
        });
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
