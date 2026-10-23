import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchText: vi.fn(), fetchBuffer: vi.fn(), parsePdf: vi.fn(), fetchTimeSeries: vi.fn() }));

vi.mock('@/lib/sync/http-client', () => ({ fetchTextFromUrl: mocks.fetchText, fetchBufferFromUrl: mocks.fetchBuffer }));
vi.mock('@/lib/sync/time-series-client', () => ({ fetchTimeSeries: mocks.fetchTimeSeries }));
vi.mock('@/lib/protocols/pdf', () => ({ parsePdf: mocks.parsePdf, fetchPdf: vi.fn() }));

const api = {
    general: [{ fecha: '2026-07-01', valor: 12076.3937 }, { fecha: '2026-08-01', valor: 12276.766 }],
    nucleo: [{ fecha: '2026-07-01', valor: 12224.3648 }, { fecha: '2026-08-01', valor: 12445.7973 }],
};

describe('fetchIndecIpcVariations', () => {
    beforeEach(() => vi.resetAllMocks());

    it('uses the API when it already has the expected month, without downloading INDEC files', async () => {
        mocks.fetchText.mockResolvedValue('');
        const { fetchIndecIpcVariations } = await import('@/lib/inflacion-source');
        const rows = await fetchIndecIpcVariations(api.general, api.nucleo, '2026-09-20');

        expect(rows.at(-1)).toMatchObject({ fecha: '2026-08-01' });
        expect(rows.at(-1)?.ipc_indec).toBeCloseTo(1.66, 2);
        expect(mocks.fetchBuffer).not.toHaveBeenCalled();
        expect(mocks.fetchText).not.toHaveBeenCalledWith(expect.stringContaining('/Nivel4/'));
    });

    it('falls back from a stale API through a page without workbook and a failing CSV to the press release linked from the page', async () => {
        mocks.fetchText.mockResolvedValue('<a href="/ftp/cuadros/economia/sh_ipc_aperturas.xls">x</a><a href="/uploads/informesdeprensa/ipc_10_26ABC.pdf">Informe</a>');
        mocks.fetchBuffer.mockImplementation(async (url: string) => {
            if (url.endsWith('.csv')) throw new Error('Unexpected content type text/html');
            if (url.endsWith('ipc_10_26ABC.pdf')) return Buffer.from('pdf');
            throw new Error(`unexpected ${url}`);
        });
        mocks.parsePdf.mockResolvedValue({ text: 'registró un alza mensual de 1,9% en septiembre de 2026. IPC Núcleo (1,7%)', pages: 1 });
        const { fetchIndecIpcVariations } = await import('@/lib/inflacion-source');

        const rows = await fetchIndecIpcVariations(api.general, api.nucleo, '2026-10-22');

        expect(rows).toEqual([{ fecha: '2026-09-01', ipc_indec: 1.9, ipc_nucleo_indec: 1.7 }]);
    });
});

const rssItem = (mes: string, value: string) => `<item><title>IPC mensual ${mes} 2026</title><link>https://equilibra.ar/ipc-mensual-${mes}-2026/</link><pubDate>Wed, 02 Sep 2026 17:38:47 +0000</pubDate><content:encoded><![CDATA[<p>Según nuestros relevamientos de precios, en ${mes} de 2026 la inflación Nacional fue ${value}%, descendiendo 0,3 p.p.</p>]]></content:encoded></item>`;

describe('fetchEquilibraIpcRows', () => {
    beforeEach(() => vi.resetAllMocks());

    it('falls back to the category RSS feed (paginated) when wp-json requires login', async () => {
        mocks.fetchText.mockImplementation(async (url: string) => {
            if (url.includes('wp-json')) throw new Error('Failed to download wp-json. Status 401');
            if (url.endsWith('/category/ipc-equilibra/feed/')) return `<rss>${rssItem('agosto', '1,8')}${rssItem('julio', '1,8')}</rss>`;
            if (url.endsWith('/category/ipc-equilibra/feed/?paged=2')) return `<rss>${rssItem('junio', '1,9')}</rss>`;
            throw new Error('Status 404');
        });
        const { fetchEquilibraIpcRows } = await import('@/lib/inflacion-source');

        const rows = await fetchEquilibraIpcRows('2026-09-20');

        expect(rows).toEqual([
            { fecha: '2026-06-01', ipc_equilibra: 1.9 },
            { fecha: '2026-07-01', ipc_equilibra: 1.8 },
            { fecha: '2026-08-01', ipc_equilibra: 1.8 },
        ]);
    });

    it('falls back to the category listing pages and parses each post when wp-json and RSS fail', async () => {
        mocks.fetchText.mockImplementation(async (url: string) => {
            if (url.endsWith('/category/ipc-equilibra/')) return '<a href="https://equilibra.ar/ipc-mensual-agosto-2026/">IPC mensual agosto 2026</a><a href="https://equilibra.ar/anticipo-de-actividad-economica-julio-2026/">x</a>';
            if (url.endsWith('/ipc-mensual-agosto-2026/')) return '<p>en agosto de 2026 la inflación Nacional fue 1,8%, descendiendo</p>';
            throw new Error('Status 401');
        });
        const { fetchEquilibraIpcRows } = await import('@/lib/inflacion-source');

        expect(await fetchEquilibraIpcRows('2026-09-20')).toEqual([{ fecha: '2026-08-01', ipc_equilibra: 1.8 }]);
    });
});

describe('fetchIndecNucleoIndexRows', () => {
    beforeEach(() => vi.resetAllMocks());

    it('extends the stale API core index with the newest core variation from the fallback chain', async () => {
        mocks.fetchTimeSeries.mockImplementation(async ({ ids }: { ids: string[] }) => ({
            data: (ids[0].startsWith('148.3') ? api.nucleo : api.general).map(row => [row.fecha, row.valor]),
        }));
        mocks.fetchText.mockResolvedValue('');
        mocks.fetchBuffer.mockImplementation(async (url: string) => {
            if (!url.endsWith('.csv')) throw new Error('unexpected');
            return Buffer.from('0;NIVEL GENERAL;x;202609;1;1,9;1;Nacional\nNúcleo;;Categorias;202609;1;1,7;1;Nacional', 'latin1');
        });
        const { fetchIndecNucleoIndexRows } = await import('@/lib/inflacion-source');

        const rows = await fetchIndecNucleoIndexRows('2026-10-22');

        expect(rows.at(-2)).toEqual({ fecha: '2026-08-01', valor: 12445.7973 });
        expect(rows.at(-1)?.fecha).toBe('2026-09-01');
        expect(rows.at(-1)?.valor).toBeCloseTo(12445.7973 * 1.017, 4);
    });

    it('fails loudly when the API has no core index to extend', async () => {
        mocks.fetchTimeSeries.mockResolvedValue({ data: [] });
        mocks.fetchText.mockRejectedValue(new Error('offline'));
        mocks.fetchBuffer.mockRejectedValue(new Error('offline'));
        const { fetchIndecNucleoIndexRows } = await import('@/lib/inflacion-source');

        await expect(fetchIndecNucleoIndexRows('2026-10-22')).rejects.toThrow('core IPC index');
    });
});

describe('fetchIndecIpcVariations staleness from the official INDEC calendar', () => {
    const calendarEntry = (date: string) => `<div class="nro-dia">${date.slice(8)}</div><div class="cal-content text-calendario">&#205;ndice de precios al consumidor (IPC). Cobertura nacional</div>`;

    beforeEach(() => {
        vi.resetAllMocks();
        mocks.fetchText.mockImplementation(async (url: string) => {
            if (url.includes('/Calendario/')) return url.includes('Septiembre-2026') ? calendarEntry('2026-09-10') : url.includes('Octubre-2026') ? calendarEntry('2026-10-13') : '';
            return '';
        });
        mocks.fetchBuffer.mockRejectedValue(new Error('offline'));
    });

    it('does not warn before the official release when the newest stored month is the previous one', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { fetchIndecIpcVariations } = await import('@/lib/inflacion-source');

        await fetchIndecIpcVariations(api.general, api.nucleo, '2026-10-10');

        expect(warn).not.toHaveBeenCalled();
    });

    it('warns the day after the official release when no source has the released month', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { fetchIndecIpcVariations } = await import('@/lib/inflacion-source');

        const rows = await fetchIndecIpcVariations(api.general, api.nucleo, '2026-10-14');

        expect(rows.at(-1)?.fecha).toBe('2026-08-01');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('2026-09-01'));
    });
});
