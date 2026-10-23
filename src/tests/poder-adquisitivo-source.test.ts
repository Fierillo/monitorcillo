import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchTextFromUrl: vi.fn(),
    fetchTimeSeries: vi.fn(),
    parseSalaryPublicationDate: vi.fn(),
    fetchIpcNucleoSeries: vi.fn(),
}));

vi.mock('@/lib/sync/http-client', () => ({ fetchTextFromUrl: mocks.fetchTextFromUrl }));
vi.mock('@/lib/sync/time-series-client', () => ({ fetchTimeSeries: mocks.fetchTimeSeries }));
vi.mock('@/lib/sync/cache', () => ({ fetchIpcNucleoSeries: mocks.fetchIpcNucleoSeries }));
vi.mock('@/lib/salary-source', () => ({ parseSalaryPublicationDate: mocks.parseSalaryPublicationDate }));

import { fetchPoderAdquisitivoRawReport, parseOfficialSalaryCsvRows, parseRipteCsvRows } from '../lib/sync/poder-adquisitivo';

const RIPTE_CSV = `indice_tiempo,remuneracion_imponible_promedio_trabajadores_estables
2026-01-01,1856432.71
2026-02-01,1923004.15`;

describe('parseOfficialSalaryCsvRows', () => {
    it('reads quoted semicolon-delimited salaries while preserving dates, decimal commas and missing values', () => {
        const rows = parseOfficialSalaryCsvRows([
            'periodo;privado;publico;registrado;no_registrado;nota',
            '"1/3/2026";"8935,48";"NA";"8341,11";"";"dato; provisional"',
        ].join('\r\n'));

        expect(rows.get('2026-03-01')).toEqual({
            salario_registrado: 8341.11,
            salario_no_registrado: null,
            salario_privado: 8935.48,
            salario_publico: null,
        });
    });

    it('parses official INDEC salary CSV rows', () => {
        const rows = parseOfficialSalaryCsvRows(`periodo;IS_sector_privado_registrado;IS_sector_publico;IS_total_registrado;IS_sector_no_registrado;IS_indice_total
1/3/2026;8935,48;7344,33;8341,11;9916,02;8654,99`);

        expect(rows.get('2026-03-01')).toEqual({
            salario_registrado: 8341.11,
            salario_no_registrado: 9916.02,
            salario_privado: 8935.48,
            salario_publico: 7344.33,
        });
    });
});

describe('parseRipteCsvRows', () => {
    it('reads quoted monthly indices and skips quoted empty values', () => {
        const csv = [
            'indice_tiempo,remuneracion',
            '"2026-01-01","1856432.71"',
            '"2026-02-01",""',
        ].join('\r\n');

        expect(Array.from(parseRipteCsvRows(csv))).toEqual([['2026-01-01', 1856432.71]]);
    });

    it('parses the monthly RIPTE series and skips the header', () => {
        expect(Array.from(parseRipteCsvRows(RIPTE_CSV))).toEqual([
            ['2026-01-01', 1856432.71],
            ['2026-02-01', 1923004.15],
        ]);
    });

    it('ignores rows without a usable date or value', () => {
        const csv = `indice_tiempo,remuneracion
2026-01-01,1856432.71
2026-02-01,NA
sin-fecha,123
2026-03-01,`;

        expect(Array.from(parseRipteCsvRows(csv).keys())).toEqual(['2026-01-01']);
    });
});

describe('fetchPoderAdquisitivoRawReport', () => {
    beforeEach(() => {
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.fetchTimeSeries.mockResolvedValue({ data: [['2026-01-01', 100]] });
        mocks.parseSalaryPublicationDate.mockReturnValue('2026-03-20');
        mocks.fetchIpcNucleoSeries.mockResolvedValue({ data: [['2026-01-01', 100]] });
    });

    it('takes core IPC from the shared series that extends the stale API with INDEC fallbacks', async () => {
        mocks.fetchIpcNucleoSeries.mockResolvedValue({ data: [['2026-01-01', 100], ['2026-09-01', 150]] });
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => (url.includes('ripte') ? RIPTE_CSV : 'periodo;a;b;c;d\n1/1/2026;1;2;3;4'));

        const { rows } = await fetchPoderAdquisitivoRawReport();

        expect(rows.find(row => row.fecha === '2026-09-01')?.ipc_nucleo).toBe(150);
    });

    it('reports the RIPTE values published for each month', async () => {
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => (url.includes('ripte') ? RIPTE_CSV : 'periodo;a;b;c;d\n1/1/2026;1;2;3;4'));

        const { rows } = await fetchPoderAdquisitivoRawReport();

        expect(rows.find(row => row.fecha === '2026-01-01')?.ripte).toBe(1856432.71);
    });

    it('fails instead of reporting every month without a RIPTE value', async () => {
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => {
            if (url.includes('ripte')) throw new Error('Failed to download RIPTE. Status 503');
            return 'periodo;a;b;c;d\n1/1/2026;1;2;3;4';
        });

        await expect(fetchPoderAdquisitivoRawReport()).rejects.toThrow('Failed to download RIPTE');
    });
});
