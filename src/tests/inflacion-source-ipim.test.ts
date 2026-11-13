import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchTimeSeries: vi.fn(),
    fetchBufferFromUrl: vi.fn(),
    fetchTextFromUrl: vi.fn(),
}));

vi.mock('@/lib/sync/time-series-client', () => ({ fetchTimeSeries: mocks.fetchTimeSeries }));
vi.mock('@/lib/sync/http-client', () => ({
    fetchBufferFromUrl: mocks.fetchBufferFromUrl,
    fetchTextFromUrl: mocks.fetchTextFromUrl,
}));
vi.mock('next/cache', () => ({
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { fetchInflacionRawReport } from '../lib/inflacion-source';

describe('fetchInflacionRawReport IPIM', () => {
    beforeEach(() => {
        mocks.fetchTimeSeries.mockReset();
        mocks.fetchBufferFromUrl.mockReset();
        mocks.fetchTextFromUrl.mockReset();
        mocks.fetchBufferFromUrl.mockRejectedValue(new Error('workbook unavailable'));
        mocks.fetchTextFromUrl.mockRejectedValue(new Error('http unavailable'));
        mocks.fetchTimeSeries.mockImplementation(async ({ ids }: { ids: string[] }) => {
            const seriesId = ids[0] ?? '';
            if (seriesId.includes('INGNAC') || seriesId.includes('INUCLEO')) {
                return { data: [['2026-01-01', 100], ['2026-02-01', 102]] };
            }
            return { data: [['2026-01-01', 100], ['2026-02-01', 101.7]] };
        });
    });

    it('merges IPIM index levels into raw rows', async () => {
        const { rows } = await fetchInflacionRawReport();
        expect(rows.find(row => row.fecha === '2026-01-01')?.ipim).toBe(100);
        expect(rows.find(row => row.fecha === '2026-02-01')?.ipim).toBe(101.7);
    });

    it('dates the report by the official INDEC release that published its newest month, not by the REM forecast', async () => {
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => {
            if (url.includes('/Calendario/') && url.includes('Marzo-2026')) {
                return '<div class="nro-dia">12</div><div class="cal-content text-calendario">&#205;ndice de precios al consumidor (IPC). Cobertura nacional</div>';
            }
            if (url.includes('/Calendario/')) return '';
            throw new Error('http unavailable');
        });

        const { publishedAt } = await fetchInflacionRawReport('2026-03-20');

        expect(publishedAt).toBe('2026-03-12');
    });

    it('completes IPIM from the INDEC CSV when the API lags behind the month INDEC already published', async () => {
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => {
            if (url.includes('/Calendario/') && url.includes('Octubre-2026')) {
                return '<div class="nro-dia">15</div><div class="cal-content text-calendario">Sistema de &#237;ndices de precios mayoristas (SIPM). Septiembre de 2026</div>';
            }
            if (url.includes('/Calendario/')) return '';
            throw new Error('http unavailable');
        });
        mocks.fetchBufferFromUrl.mockImplementation(async (url: string) => {
            if (url === 'https://www.indec.gob.ar/ftp/cuadros/economia/indice_ipim.csv') {
                return Buffer.from('periodo;nivel_general_aperturas;indice_ipim\r\n2026-08-01;ng_nivel_general;16580,3281440822\r\n2026-09-01;ng_nivel_general;17104,0233294799\r\n2026-09-01;e_energia_electrica;9,5\r\n');
            }
            throw new Error('workbook unavailable');
        });
        mocks.fetchTimeSeries.mockImplementation(async ({ ids }: { ids: string[] }) => (ids[0] === '448.1_NIVEL_GENERAL_0_0_13_46'
            ? { data: [['2026-07-01', 16233.7149476425], ['2026-08-01', 16580.3281440822]] }
            : { data: [] }));

        const { rows } = await fetchInflacionRawReport('2026-10-20');

        expect(rows.filter(row => row.ipim != null).map(row => [row.fecha, row.ipim])).toEqual([
            ['2026-08-01', 16580.3281440822],
            ['2026-09-01', 17104.0233294799],
        ]);
    });
});
