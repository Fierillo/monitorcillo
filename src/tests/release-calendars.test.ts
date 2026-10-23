import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ fetchTextFromUrl: vi.fn(), fetchBufferFromUrl: vi.fn() }));
const db = vi.hoisted(() => ({ saveIndicatorPublication: vi.fn() }));
const pdfLayout = vi.hoisted(() => ({ readPdfLayout: vi.fn() }));
vi.mock('@/lib/sync/http-client', () => http);
vi.mock('@/lib/db', () => db);
vi.mock('@/lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('@/lib/protocols/pdf-layout', () => pdfLayout);

/** readPdfLayout of the real Finanzas «Cronograma de Licitaciones 2026» (calendario_prensa_0.pdf), trimmed to the legend and September–December. */
import FINANZAS from './fixtures/finanzas-cronograma-2026.json';

/** Trimmed from https://www.indec.gob.ar/Calendario/FiltrosCalendario/mes/Noviembre-2026/1 */
const NOVEMBER = `
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=&#205;ndice+de+precios+al+consumidor+(IPC).+Cobertura+nacional.+Octubre+de+2026&amp;dates=20261112T160000/20261112T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=&#205;ndice+de+salarios.+Septiembre+de+2026&amp;dates=20261113T160000/20261113T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=Valorizaci&#243;n+mensual+de+la+canasta+b&#225;sica+alimentaria+(CBA)+y+de+la+canasta+b&#225;sica+total+(CBT).+Octubre+de+2026&amp;dates=20261112T160000/20261112T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=Intercambio+comercial+argentino+(ICA).+Bienes.+Octubre+de+2026&amp;dates=20261119T160000/20261119T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=Estimador+mensual+de+actividad+econ&#243;mica+(EMAE).+Septiembre+de+2026&amp;dates=20261124T160000/20261124T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>`;
const OCTOBER = `
<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=&#205;ndice+de+salarios.+Agosto+de+2026&amp;dates=20261021T160000/20261021T163000&amp;ctz=America/Argentina/Buenos_Aires" target='_blank'>`;

/** Trimmed from https://www.bcra.gob.ar/calendario-de-informes/ */
const BCRA = `<table><tr>    <td>Relevamiento de Expectativas de Mercado (REM)</td>    <td>06 oct 2026</td>    </tr>
<tr>    <td>Informe Monetario Mensual</td>    <td>07 oct 2026</td>    </tr>
<tr>    <td>Relevamiento de Expectativas de Mercado (REM)</td>    <td>05 nov 2026</td>    </tr>
<tr>    <td>Relevamiento de Expectativas de Mercado (REM)</td>    <td>04 dic 2026</td>    </tr></table>`;

/** Trimmed from https://www.argentina.gob.ar/economia/sechacienda/calendariodepublicacion (2026). */
const HACIENDA = `<script>var events = [
    { "date": "16/10/2026", "label": "Resultado fiscal de septiembre", "type": "Resultado Fiscal" },
    { "date": "16/11/2026", "label": "Resultado fiscal de octubre", "type": "Resultado Fiscal" },
    { "date": "01/10/2026", "label": "Recaudación de septiembre", "type": "Recaudación" },
    { "date": "02/11/2026", "label": "Recaudación de octubre", "type": "Recaudación" },
];</script>`;

describe('official release calendars', () => {
    beforeEach(() => { vi.resetModules(); [http.fetchTextFromUrl, http.fetchBufferFromUrl, db.saveIndicatorPublication, pdfLayout.readPdfLayout].forEach(mock => mock.mockReset()); });

    it('parses each INDEC release title and date from a month page', async () => {
        const { parseIndecCalendar } = await import('@/lib/release-calendars');
        expect(parseIndecCalendar(OCTOBER)).toEqual([{ date: '2026-10-21', title: 'Índice de salarios. Agosto de 2026' }]);
    });

    it('maps the next INDEC release on or after today to each of our INDEC events', async () => {
        const { nextIndecReleases, parseIndecCalendar } = await import('@/lib/release-calendars');
        const entries = [...parseIndecCalendar(OCTOBER), ...parseIndecCalendar(NOVEMBER)];
        expect(nextIndecReleases(entries, '2026-10-22')).toEqual({ 'indec-ipc': '2026-11-12', 'indec-canasta': '2026-11-12', 'indec-salarios': '2026-11-13', 'indec-ica': '2026-11-19', 'indec-emae': '2026-11-24' });
        expect(nextIndecReleases(entries, '2026-10-21')['indec-salarios']).toBe('2026-10-21');
    });

    it('reads the BCRA calendar rows as dated releases', async () => {
        const { parseBcraCalendar } = await import('@/lib/release-calendars');
        expect(parseBcraCalendar(BCRA)).toContainEqual({ date: '2026-11-05', title: 'Relevamiento de Expectativas de Mercado (REM)' });
        expect(parseBcraCalendar(BCRA)).toHaveLength(4);
    });

    it('reads the Tesoro auction days from the cells coloured like the «Licitación» legend', async () => {
        const { licitacionDates } = await import('@/lib/release-calendars');
        expect(licitacionDates(FINANZAS)).toEqual(['2026-09-11', '2026-09-28', '2026-10-14', '2026-10-28', '2026-11-11', '2026-11-26', '2026-12-11']);
    });

    it('reads the MECON calendar of fiscal results and tax collection', async () => {
        const { parseHaciendaCalendar } = await import('@/lib/release-calendars');
        expect(parseHaciendaCalendar(HACIENDA)).toContainEqual({ date: '2026-11-02', title: 'Recaudación' });
        expect(parseHaciendaCalendar(HACIENDA)).toContainEqual({ date: '2026-11-16', title: 'Resultado Fiscal' });
        expect(parseHaciendaCalendar(HACIENDA)).toHaveLength(4);
    });

    it('syncs the next INDEC releases, REM and Tesoro auction as publications in one step', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-22T15:00:00Z'), toFake: ['Date'] });
        http.fetchTextFromUrl.mockImplementation(async (url: string) => url.includes('bcra') ? BCRA : url.includes('sechacienda') ? HACIENDA : url.includes('/Noviembre-2026/') ? NOVEMBER : url.includes('/Octubre-2026/') ? OCTOBER : '');
        http.fetchBufferFromUrl.mockResolvedValue(Buffer.from('pdf'));
        pdfLayout.readPdfLayout.mockResolvedValue(FINANZAS);
        const { syncOfficialCalendars } = await import('@/lib/sync/tasks');

        await syncOfficialCalendars();

        expect(http.fetchTextFromUrl).toHaveBeenCalledWith('https://www.indec.gob.ar/Calendario/FiltrosCalendario/mes/Octubre-2026/1');
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('indec-salarios', '2026-11-13', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('bcra-rem', '2026-11-05', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('tesoro-licitacion', '2026-10-28', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('mecon-recaudacion', '2026-11-02', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('mecon-resultado-fiscal', '2026-11-16', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('bcra-rem#2', '2026-12-04', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('tesoro-licitacion#2', '2026-11-11', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('tesoro-licitacion#3', '2026-11-26', null);
        expect(db.saveIndicatorPublication).toHaveBeenCalledTimes(12); // 9 soonest + REM #2 + auctions #2, #3
        vi.useRealTimers();
    });
});

describe('parseIndecCalendarDays', () => {
    it('reads already-published releases, which have no add-to-calendar link, from the day blocks of a month page', async () => {
        const { parseIndecCalendarDays } = await import('@/lib/release-calendars');
        const html = `
            <div class="nro-dia">9</div><div class="dia">VIERNES</div>
            <div class="cal-content text-calendario">Índice de salarios. Agosto de 2026</div>
            <div class="nro-dia">13</div><div class="dia">MARTES</div>
            <a href=/uploads/informesdeprensa/ipc_10_26.pdf><div class="cal-content text-calendario">
            &#205;ndice de precios al consumidor (IPC). Cobertura nacional. Septiembre de 2026
            </div></a>`;

        expect(parseIndecCalendarDays(html, 2026, 10)).toEqual([
            { date: '2026-10-09', title: 'Índice de salarios. Agosto de 2026' },
            { date: '2026-10-13', title: 'Índice de precios al consumidor (IPC). Cobertura nacional. Septiembre de 2026' },
        ]);
    });
});
