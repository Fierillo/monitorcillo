import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchBufferFromUrl: vi.fn() }));
vi.mock('@/lib/sync/http-client', () => ({ fetchBufferFromUrl: mocks.fetchBufferFromUrl }));

import { fetchTableSeries, parseTableSeries, type TableSeriesSpec } from '@/lib/protocols';

const IPIM_LIKE: TableSeriesSpec<'ipim'> = {
    url: 'https://example.test/indice_ipim.csv',
    date: { column: 'periodo', format: 'iso' },
    numberFormat: 'es-AR',
    where: { nivel_general_aperturas: 'ng_nivel_general' },
    fields: { ipim: { column: 'indice_ipim' } },
};

describe('parseTableSeries', () => {
    it('reads the declared date and value columns by header, keeping only rows that pass the filter, sorted by fecha', () => {
        expect(parseTableSeries([
            ['periodo', 'nivel_general_aperturas', 'indice_ipim'],
            ['2026-09-01', 'ng_nivel_general', '17104,0233294799'],
            ['2026-09-01', 'n_productos_nacionales', '16000,5'],
            ['2026-08-01', 'ng_nivel_general', '16580,3281440822'],
            ['', 'ng_nivel_general', '1'],
        ], IPIM_LIKE)).toEqual([
            { fecha: '2026-08-01', ipim: 16580.3281440822 },
            { fecha: '2026-09-01', ipim: 17104.0233294799 },
        ]);
    });

    it('fails naming the column when a declared column is missing, instead of returning an empty series', () => {
        const rows = [['periodo', 'nivel_general_aperturas', 'indice_ipim'], ['2026-09-01', 'ng_nivel_general', '1']];
        expect(() => parseTableSeries(rows, { ...IPIM_LIKE, date: { column: 'indice_tiempo', format: 'iso' } })).toThrow(/indice_tiempo/);
        expect(() => parseTableSeries(rows, { ...IPIM_LIKE, fields: { ipim: { column: 'valor' } } })).toThrow(/valor/);
        expect(() => parseTableSeries(rows, { ...IPIM_LIKE, where: { region: 'Nacional' } })).toThrow(/region/);
    });
});

describe('parseTableSeries long tables', () => {
    it('fills each field only from the rows its own filter selects, one row per period with null for fields not found', () => {
        const spec: TableSeriesSpec<'general' | 'nucleo'> = {
            url: 'https://example.test/ipc.csv',
            date: { column: 'Periodo', format: 'yyyymm' },
            numberFormat: 'es-AR',
            where: { Region: 'Nacional' },
            fields: {
                general: { column: 'v_m_IPC', where: { Descripcion: 'Nivel general' } },
                nucleo: { column: 'v_m_IPC', where: { Codigo: 'Núcleo' } },
            },
        };

        expect(parseTableSeries([
            ['Codigo', 'Descripcion', 'Periodo', 'v_m_IPC', 'Region'],
            ['0', 'NIVEL GENERAL', '202609', '1,9', 'Nacional'],
            ['Núcleo', '', '202609', '1,7', 'Nacional'],
            ['Núcleo', '', '202609', '9,9', 'GBA'],
            ['Regulados', '', '202609', '2,3', 'Nacional'],
            ['Núcleo', '', '202610', '1,5', 'Nacional'],
        ], spec)).toEqual([
            { fecha: '2026-09-01', general: 1.9, nucleo: 1.7 },
            { fecha: '2026-10-01', general: null, nucleo: 1.5 },
        ]);
    });
});

describe('parseTableSeries empty values', () => {
    it('skips periods whose declared fields are all blank or not numbers, so they never count as data', () => {
        expect(parseTableSeries([
            ['periodo', 'nivel_general_aperturas', 'indice_ipim'],
            ['2026-07-01', 'ng_nivel_general', 'NA'],
            ['2026-08-01', 'ng_nivel_general', ''],
            ['2026-09-01', 'ng_nivel_general', '17104,02'],
        ], IPIM_LIKE)).toEqual([{ fecha: '2026-09-01', ipim: 17104.02 }]);
    });
});

describe('fetchTableSeries', () => {
    it('downloads the declared CSV, refusing HTML error pages, and parses it with the spec', async () => {
        mocks.fetchBufferFromUrl.mockResolvedValue(Buffer.from('periodo;nivel_general_aperturas;indice_ipim\r\n2026-09-01;ng_nivel_general;17104,0233294799\r\n2026-09-01;e_energia_electrica;9,5\r\n', 'latin1'));

        await expect(fetchTableSeries(IPIM_LIKE)).resolves.toEqual([{ fecha: '2026-09-01', ipim: 17104.0233294799 }]);

        const [url, options] = mocks.fetchBufferFromUrl.mock.calls[0];
        expect(url).toBe(IPIM_LIKE.url);
        expect(options.expectedContentType.test('application/octet-stream')).toBe(true);
        expect(options.expectedContentType.test('text/html; charset=utf-8')).toBe(false);
    });
});
