import { describe, expect, it, vi } from 'vitest';
import { buildCurrentIndicatorsCatalog } from '../lib/catalog-service';
import type { DataRow, IndicatorType } from '@/types';
import { baseCatalogRow, formatDay, futureMonthly } from './catalog-test-utils';

describe('buildCurrentIndicatorsCatalog', () => {
    it('refreshes persisted catalog references from indicator specs', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma', referencia: 'Referencia vieja' }],
            getLatestNormalizedRow: async (type, valueColumn) => {
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

    it('ignores daily series as date candidates when loaded rows also have non-daily ones', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            loadedRowsAreAuthoritative: true,
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma' }],
            getNormalizedRows: async (type) => type === 'bma' ? [{ iso_fecha: '2026-10-01', BMAmplia: 4.8 }] : [],
            getRawRows: async (type) => type === 'bma' ? [
                { fecha: '2026-10-08', depositos_tesoro: 3 },
                { fecha: '2026-10-15', depositos_tesoro: 4 },
                { fecha: '2026-10-16', base_monetaria: 10 },
                { fecha: '2026-10-19', base_monetaria: 12 },
                { fecha: '2026-10-20', base_monetaria: 13 },
            ] : [],
            getLatestNormalizedRow: async () => null,
            getLatestRawDate: async () => null,
            getNormalizedRowByDate: async () => null,
            getRawRowByDate: async () => null,
        });
        expect(result.find(row => row.id === 'bma')?.fecha).toBe('15 OCT 26');
    });

    it('dates by finite values only: an empty raw cell does not count as a newer observation', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            loadedRowsAreAuthoritative: true,
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'emae' }],
            getNormalizedRows: async (type) => type === 'emae' ? [{ iso_fecha: '2026-07-01', emae_desestacionalizado: 101 }] : [],
            getRawRows: async (type) => type === 'emae' ? [{ fecha: '2026-07-01', emae: 100 }, { fecha: '2026-08-01', emae: '' }] : [],
            getLatestNormalizedRow: async () => null,
            getLatestRawDate: async () => null,
            getNormalizedRowByDate: async () => null,
            getRawRowByDate: async () => null,
        });
        expect(result.find(row => row.id === 'emae')?.fecha).toBe('JUL 26');
    });

    it('logs a failed row load instead of swallowing it, then falls back to single queries', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'icg' }],
            getNormalizedRows: async () => { throw new Error('Neon timeout'); },
            getRawRows: async () => [],
            getLatestNormalizedRow: async () => ({ iso_fecha: '2026-09-01', icg: 2.1 }),
            getLatestRawDate: async () => '2026-09-01',
            getNormalizedRowByDate: async () => null,
            getRawRowByDate: async () => null,
        });
        expect(result[0].dato).toBe('2,1 puntos');
        expect(logged).toHaveBeenCalledWith(expect.stringContaining('icg'), expect.objectContaining({ message: 'Neon timeout' }));
        logged.mockRestore();
    });

    it('derives latest and reference rows from loaded tables without duplicate queries', async () => {
        let latestQueries = 0;
        let referenceQueries = 0;
        let rawDateQueries = 0;
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma' }],
            getNormalizedRows: async () => [
                { iso_fecha: '2026-03-01', BMAmplia: 5.8 },
                { iso_fecha: '2026-04-01', BMAmplia: 6.7 },
            ],
            getRawRows: async () => [{ fecha: '2026-05-02', base_monetaria: 12 }],
            getLatestNormalizedRow: async () => {
                latestQueries += 1;
                return null;
            },
            getLatestRawDate: async () => {
                rawDateQueries += 1;
                return null;
            },
            getNormalizedRowByDate: async () => {
                referenceQueries += 1;
                return null;
            },
            getRawRowByDate: async () => null,
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({ dato: '6,7% del PBI real', referencia: '5,8% del PBI real', fecha: '2 MAY 26' });
        expect({ latestQueries, referenceQueries, rawDateQueries }).toEqual({ latestQueries: 0, referenceQueries: 0, rawDateQueries: 0 });
    });

    it('does not amplify a failed authoritative table read with more database queries', async () => {
        let duplicateQueries = 0;
        await buildCurrentIndicatorsCatalog({
            loadedRowsAreAuthoritative: true,
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma' }],
            getNormalizedRows: async () => null,
            getRawRows: async () => null,
            getLatestNormalizedRow: async () => {
                duplicateQueries += 1;
                return null;
            },
            getLatestRawDate: async () => {
                duplicateQueries += 1;
                return null;
            },
            getNormalizedRowByDate: async () => {
                duplicateQueries += 1;
                return null;
            },
            getRawRowByDate: async () => {
                duplicateQueries += 1;
                return null;
            },
        });

        expect(duplicateQueries).toBe(0);
    });

    it('uses latest-row data sources without loading full tables', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'bma', fecha: '1 ABR 26', dato: '6,7%' }],
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
            getNormalizedRows: async () => { throw new Error('Full normalized table should not be loaded'); },
            getRawRows: async () => { throw new Error('Full raw table should not be loaded'); },
        });

        expect(result.find(row => row.id === 'bma')).toMatchObject({ fecha: '2 MAY 26', dato: '6,7% del PBI real' });
    });

    it('uses publication date metadata for monthly indicators', async () => {
        await expectPublishedDate('emae', 'emae', 'emae_desestacionalizado', { iso_fecha: '2026-02-01', emae_desestacionalizado: 105.2 }, '2026-04-22', { fecha: '22 ABR 26', dato: '105,2', proxima_fecha: undefined });
        await expectPublishedDate('recaudacion', 'reca', 'pct_pbi', { iso_fecha: '2026-04-01', pctPbi: 2.2 }, '2026-05-04', { fecha: '4 MAY 26', dato: '2,2% del PBI real', proxima_fecha: undefined });
    });

    it('uses publication date metadata and previous-month reference for poder adquisitivo', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'poder-adquisitivo' }],
            getLatestNormalizedRow: async (type, valueColumn) => {
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

        expect(result.find(row => row.id === 'poder-adquisitivo')).toMatchObject({ fecha: '17 ABR 26', referencia: 'PA blanco: 91,2', reference_description: 'Mes anterior', dato: 'PA blanco: 88,8', trend: 'down', proxima_fecha: undefined });
    });

    const CALENDAR_ROWS: Record<string, { normalized: DataRow; raw: DataRow }> = {
        poder: { normalized: { iso_fecha: '2026-08-01', blanco: 73 }, raw: { fecha: '2026-10-01', ripte: 1, jubilacion_minima: 1 } },
        emae: { normalized: { iso_fecha: '2026-08-01', emae_desestacionalizado: 150 }, raw: { fecha: '2026-08-01', emae_desestacionalizado: 150 } },
        balanza: { normalized: { iso_fecha: '2026-09-01', saldo: 900 }, raw: { fecha: '2026-09-01', saldo: 900 } },
        inflacion: { normalized: { iso_fecha: '2026-09-01', ipc: 2.1 }, raw: { fecha: '2026-10-01', ipc_equilibra: 2, rem: 2 } },
        emision: { normalized: { iso_fecha: '2026-10-16', ACUMULADO: 5 }, raw: { fecha: '2026-10-14', licitado: 9, vencimientos: 8, resultado_fiscal: 1 } },
        reca: { normalized: { iso_fecha: '2026-09-01', pctPbi: 1 }, raw: { fecha: '2026-09-01', recaudacion_total: 1 } },
        pobreza: { normalized: { iso_fecha: '2026-03-01', pobreza_utdt: 29 }, raw: { fecha: '2026-03-01', pobreza_utdt: 29, pobreza_indec: 28.2 } },
    };

    it.each([
        ['INDEC EMAE', 'emae', { 'indec-emae': '2026-11-24' }, { proxima_fecha: '24 NOV 26', proxima_fecha_description: null }],
        ['INDEC ICA', 'balanza-comercial', { 'indec-ica': '2026-11-19' }, { proxima_fecha: '19 NOV 26' }],
        ['no INDEC calendar: never estimated', 'emae', {}, { proxima_fecha: undefined }],
        ['jubilación by INDEC IPC, before salarios', 'poder-adquisitivo', { 'indec-ipc': '2026-11-12', 'indec-salarios': '2026-11-13' }, { proxima_fecha: '12 NOV 26', proxima_fecha_description: 'Jubilación mínima', proxima_estimada: false }],
        ['RIPTE has no calendar: no estimate either', 'poder-adquisitivo', {}, { proxima_fecha: undefined }],
        ['BCRA REM beats the sooner-estimated Equilibra', 'inflacion', { 'bcra-rem': '2026-11-05' }, { proxima_fecha: '5 NOV 26', proxima_fecha_description: 'REM', proxima_estimada: false }],
        ['Finanzas auction', 'emision', { 'tesoro-licitacion': '2026-10-28', 'mecon-resultado-fiscal': '2026-11-16' }, { proxima_fecha: '28 OCT 26', proxima_fecha_description: 'Licitación del Tesoro' }],
        ['MECON resultado fiscal', 'emision', { 'mecon-resultado-fiscal': '2026-11-16' }, { proxima_fecha: '16 NOV 26', proxima_fecha_description: 'Resultado fiscal', proxima_estimada: false }],
        ['MECON recaudación', 'recaudacion', { 'mecon-recaudacion': '2026-11-02' }, { proxima_fecha: '2 NOV 26', proxima_estimada: false }],
        ['UTDT nowcast anchored to INDEC canasta, sooner than INDEC pobreza', 'pobreza', { 'indec-canasta': '2026-11-12', 'indec-pobreza': '2027-03-31' }, { proxima_fecha: '12 NOV 26', proxima_fecha_description: 'Nowcast UTDT', proxima_estimada: true }],
    ] as [string, IndicatorType | string, Record<string, string>, Record<string, unknown>][])('takes Próxima from the official calendars: %s', async (_, id, calendar, expected) => {
        vi.useFakeTimers({ now: new Date('2026-10-22T15:00:00Z'), toFake: ['Date'] });
        const [row] = await buildCurrentIndicatorsCatalog({
            loadedRowsAreAuthoritative: true,
            getCatalogRows: async () => [{ ...baseCatalogRow, id }],
            getNormalizedRows: async (type) => CALENDAR_ROWS[type] ? [CALENDAR_ROWS[type].normalized] : [],
            getRawRows: async (type) => CALENDAR_ROWS[type] ? [CALENDAR_ROWS[type].raw] : [],
            getLatestNormalizedRow: async () => null,
            getLatestRawDate: async () => null,
            getPublicationDates: async (ids) => Object.fromEntries(ids.map(key => [key, calendar[key] ?? null])),
        });
        vi.useRealTimers();
        expect(row).toMatchObject(expected);
    });

    it('uses publication date metadata for inflation', async () => {
        await expectPublishedDate('inflacion', 'inflacion', 'ipc', { iso_fecha: '2026-03-01', ipc: 6.1 }, '2026-04-15', { fecha: '15 ABR 26', dato: '6,1%', reference_description: 'Mes anterior', trend: 'down', proxima_fecha: undefined }, ['ipc_equilibra', 'rem', 'ipc_indec', 'ipc_nucleo_indec'], { iso_fecha: '2026-02-01', ipc: 5.5 });
    });

    it('uses INDEC publication date and nearest inflation source for next date', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'inflacion' }],
            getLatestNormalizedRow: async (type) => type === 'inflacion' ? { iso_fecha: '2026-04-01', ipc: 2.6 } : null,
            getLatestRawDate: async () => '2026-04-01',
            getPublicationDate: async (id) => id === 'inflacion' ? '2026-05-14' : null,
            getPublicationDates: async () => ({
                'indec-ipc': futureMonthly('2026-05-14'),
                'inflacion-equilibra': '2026-05-10',
                'bcra-rem': futureMonthly('2026-05-03'),
            }),
            getNormalizedRowByDate: async (type, date) => type === 'inflacion' && date === '2026-03-01' ? { iso_fecha: '2026-03-01', ipc: 3.4 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => [],
            getRawRows: async () => [{ fecha: '2026-04-01', ipc_indec_general: 1, ipc_equilibra: 1, rem: 1 }],
        });

        const nextInflationSource = [
            { date: futureMonthly('2026-05-14'), label: 'INDEC' },
            { date: futureMonthly('2026-05-10'), label: 'Equilibra' },
            { date: futureMonthly('2026-05-03'), label: 'REM' },
        ].sort((a, b) => a.date.localeCompare(b.date))[0];

        expect(result.find(row => row.id === 'inflacion')).toMatchObject({
            fecha: '14 MAY 26',
            proxima_fecha: formatDay(nextInflationSource.date),
            proxima_fecha_description: nextInflationSource.label,
        });
    });

    it('uses ICG publication date and the persisted cronograma next date', async () => {
        const result = await buildCurrentIndicatorsCatalog({
            getCatalogRows: async () => [{ ...baseCatalogRow, id: 'icg' }],
            getLatestNormalizedRow: async (type) => type === 'icg' ? { iso_fecha: '2026-08-01', icg: 2.4 } : null,
            getLatestRawDate: async () => '2026-08-01',
            getPublicationDate: async (id) => id === 'icg' ? '2026-08-24' : null,
            getPublicationDates: async () => ({ 'icg-next': '2027-03-23' }),
            getNormalizedRowByDate: async (type, date) => type === 'icg' && date === '2026-07-01' ? { iso_fecha: '2026-07-01', icg: 2.3 } : null,
            getRawRowByDate: async () => null,
            getNormalizedRows: async () => [],
            getRawRows: async () => [{ fecha: '2026-08-01', icg: 2.4 }],
        });

        expect(result.find(row => row.id === 'icg')).toMatchObject({
            fecha: '24 AGO 26',
            dato: '2,4 puntos',
            proxima_fecha: formatDay('2027-03-23'),
            proxima_fecha_description: null,
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
