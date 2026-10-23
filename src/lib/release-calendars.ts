import { join } from 'node:path';
import { PNG } from 'pngjs';
import { MONTH_NAMES_ES, isoDate } from './normalize/dates';
import { readPdfLayout, type PdfLayout } from './protocols/pdf-layout';
import { fetchBufferFromUrl, fetchTextFromUrl } from './sync/http-client';

export const UTDT_ICG_CALENDAR_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=25418&id_item_menu=41666';

export type IcgDiffusionEntry = {
    period: string;
    publishedOn: string;
};

export function parseIcgDiffusionSchedule(text: string): IcgDiffusionEntry[] {
    const yearMatch = text.match(/Cronograma de difusi[oó]n(?:\s+ICG)?\s+(\d{4})/i);
    if (!yearMatch) return [];
    const year = Number(yearMatch[1]);
    const entries: IcgDiffusionEntry[] = [];

    for (const match of text.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b[^\n\d]*(\d{1,2})\b/gi)) {
        const month = MONTH_NAMES_ES.indexOf(match[1].toLowerCase()) + 1;
        const day = Number(match[2]);
        if (!month || day < 1 || day > 31) continue;
        entries.push({
            period: isoDate(year, month, 1),
            publishedOn: isoDate(year, month, day),
        });
    }

    if (entries.length === 12) return entries;

    const weekdayDays = [...text.matchAll(/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes)\s+(\d{1,2})\b/gi)]
        .map(match => Number(match[1]))
        .filter(day => day >= 1 && day <= 31);
    if (weekdayDays.length >= 12) {
        return weekdayDays.slice(-12).map((day, index) => ({
            period: isoDate(year, index + 1, 1),
            publishedOn: isoDate(year, index + 1, day),
        }));
    }

    return entries;
}

function upscaleGrayscalePng(buffer: Buffer, scale: number): Buffer {
    const source = PNG.sync.read(buffer);
    const width = source.width * scale;
    const height = source.height * scale;
    const destination = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
        const sourceY = Math.floor(y / scale);
        for (let x = 0; x < width; x++) {
            const sourceX = Math.floor(x / scale);
            const sourceIndex = (source.width * sourceY + sourceX) << 2;
            const gray = Math.round(source.data[sourceIndex] * 0.299 + source.data[sourceIndex + 1] * 0.587 + source.data[sourceIndex + 2] * 0.114);
            const index = (width * y + x) << 2;
            destination.data[index] = gray;
            destination.data[index + 1] = gray;
            destination.data[index + 2] = gray;
            destination.data[index + 3] = 255;
        }
    }
    return PNG.sync.write(destination);
}

function cropRightHalfPng(buffer: Buffer): Buffer {
    const source = PNG.sync.read(buffer);
    const width = Math.floor(source.width / 2);
    const destination = new PNG({ width, height: source.height });
    for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < width; x++) {
            const sourceIndex = (source.width * y + x + source.width - width) << 2;
            const index = (width * y + x) << 2;
            destination.data[index] = source.data[sourceIndex];
            destination.data[index + 1] = source.data[sourceIndex + 1];
            destination.data[index + 2] = source.data[sourceIndex + 2];
            destination.data[index + 3] = 255;
        }
    }
    return PNG.sync.write(destination);
}

export async function readIcgCalendarImageText(buffer: Buffer): Promise<string> {
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const prepared = upscaleGrayscalePng(buffer, 3);
    const worker = await createWorker('spa', OEM.LSTM_ONLY, {
        langPath: join(process.cwd(), 'assets'),
        cacheMethod: 'none',
    });
    try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const full = await worker.recognize(prepared);
        const column = await worker.recognize(cropRightHalfPng(prepared));
        return `${full.data.text ?? ''}\n${column.data.text ?? ''}`;
    } finally {
        await worker.terminate();
    }
}

export async function fetchIcgCalendarSchedule(options: {
    fetchPage: () => Promise<string>;
    fetchImage: (url: string) => Promise<Buffer>;
    readImageText: (buffer: Buffer) => Promise<string>;
}): Promise<IcgDiffusionEntry[]> {
    const html = await options.fetchPage();
    const imageUrl = parseIcgCalendarImageUrl(html);
    if (!imageUrl) {
        throw new Error(`Failed to find the ICG cronograma image at ${UTDT_ICG_CALENDAR_URL}. Verify the calendar page.`);
    }
    const image = await options.fetchImage(imageUrl);
    const heading = html.match(/Cronograma de difusi[oó]n(?:\s+ICG)?\s+\d{4}/i)?.[0] ?? '';
    const schedule = parseIcgDiffusionSchedule(`${heading}\n${await options.readImageText(image)}`);
    if (schedule.length === 0) {
        throw new Error(`Failed to parse ICG publication dates from ${imageUrl}. Verify the cronograma image.`);
    }
    return schedule;
}

export function decodeUtdtPageHtml(buffer: Buffer): string {
    return buffer.toString('latin1');
}

export function parseIcgCalendarImageUrl(html: string): string | null {
    const section = html.match(/Cronograma de difusi[oó]n[\s\S]{0,2000}?<img[^>]+src=["']([^"']+)["']/i);
    const src = section?.[1];
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `https://www.utdt.edu${src.startsWith('/') ? '' : '/'}${src}`;
}

export function icgPublicationDateFromSchedule(schedule: IcgDiffusionEntry[], periodIso: string): string | null {
    const period = periodIso.slice(0, 10);
    return schedule.find(entry => entry.period === period)?.publishedOn ?? null;
}

export function icgNextPublicationFromSchedule(schedule: IcgDiffusionEntry[], today: string): string | null {
    return nextOnOrAfter(schedule.map(entry => entry.publishedOn), today) ?? null;
}

/** How many upcoming releases each calendar source keeps, so a passed date gives way to the next without a sync. */
const UPCOMING_RELEASES = 3;

/** The first dates on or after today (Argentina): the «next release» rule of every official calendar. */
function upcomingOnOrAfter(dates: string[], today: string): string[] {
    return [...new Set(dates.filter(date => date >= today))].sort().slice(0, UPCOMING_RELEASES);
}

function nextOnOrAfter(dates: string[], today: string): string | undefined {
    return upcomingOnOrAfter(dates, today)[0];
}

type Release = { date: string; title: string };

const INDEC_MONTHS_AHEAD = 12;

/** Publication id of each of our INDEC next-release events → title prefix of its report in INDEC's release calendar. */
const INDEC_CALENDAR_REPORTS: Record<string, string> = {
    'indec-salarios': 'Índice de salarios.',
    'indec-emae': 'Estimador mensual de actividad económica',
    'indec-ipc': 'Índice de precios al consumidor',
    'indec-ica': 'Intercambio comercial argentino',
    'indec-pobreza': 'Incidencia de la pobreza',
    'indec-canasta': 'Valorización mensual de la canasta básica alimentaria',
};

function decodeHtml(text: string): string {
    return text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&amp;/g, '&');
}

/** Releases of one INDEC month page, read from each entry's «add to calendar» link (title and start date). */
export function parseIndecCalendar(html: string): Release[] {
    return [...decodeHtml(html).matchAll(/[?&]text=([^&]+)&dates=(\d{4})(\d{2})(\d{2})T/g)]
        .map(([, title, year, month, day]) => ({ date: `${year}-${month}-${day}`, title: decodeURIComponent(title.replace(/\+/g, ' ')) }));
}

/** Next calendar date of each of our INDEC events. */
export function nextIndecReleases(releases: Release[], today: string): Record<string, string> {
    return Object.fromEntries(Object.entries(upcomingIndecReleases(releases, today)).map(([id, dates]) => [id, dates[0]]));
}

function upcomingIndecReleases(releases: Release[], today: string): Record<string, string[]> {
    return upcomingByReport(releases, INDEC_CALENDAR_REPORTS, today, (title, prefix) => title.startsWith(prefix));
}

function upcomingByReport(releases: Release[], reports: Record<string, string>, today: string, matches: (title: string, report: string) => boolean): Record<string, string[]> {
    const upcoming: Record<string, string[]> = {};
    for (const [id, report] of Object.entries(reports)) {
        const dates = upcomingOnOrAfter(releases.filter(release => matches(release.title, report)).map(release => release.date), today);
        if (dates.length > 0) upcoming[id] = dates;
    }
    return upcoming;
}

/** INDEC's release calendar from today's month through the next twelve. */
async function fetchIndecCalendar(today: string): Promise<Release[]> {
    const [year, month] = today.split('-').map(Number);
    const pages = await Promise.all(Array.from({ length: INDEC_MONTHS_AHEAD + 1 }, (_, offset) => fetchTextFromUrl(indecCalendarPageUrl(year, month - 1 + offset))));
    return pages.flatMap(parseIndecCalendar);
}

/** INDEC calendar page of a month given as a 0-based index from January of `year` (may be negative or > 11). */
function indecCalendarPageUrl(year: number, monthIndex: number): string {
    const name = MONTH_NAMES_ES[((monthIndex % 12) + 12) % 12];
    return `https://www.indec.gob.ar/Calendario/FiltrosCalendario/mes/${name[0].toUpperCase()}${name.slice(1)}-${year + Math.floor(monthIndex / 12)}/1`;
}

/** Day blocks of an INDEC month page; unlike the add-to-calendar links, they include already-published releases. */
export function parseIndecCalendarDays(html: string, year: number, month: number): Release[] {
    return decodeHtml(html).split('class="nro-dia">').slice(1).flatMap(block => {
        const date = `${year}-${String(month).padStart(2, '0')}-${block.match(/^\d+/)![0].padStart(2, '0')}`;
        return [...block.matchAll(/text-calendario">([^<]+)</g)]
            .map(([, title]) => ({ date, title: title.replace(/\s+/g, ' ').trim() }))
            .filter(release => release.title);
    });
}

/** Most recent official release date (<= today) of one of our INDEC events, read from this and last month's calendar pages. */
export async function fetchLastIndecRelease(id: keyof typeof INDEC_CALENDAR_REPORTS | string, today: string): Promise<string | null> {
    const report = INDEC_CALENDAR_REPORTS[id];
    if (!report) return null;
    const [year, month] = today.split('-').map(Number);
    const months = [month - 2, month - 1].map(index => new Date(Date.UTC(year, index, 1)));
    const pages = await Promise.all(months.map(async date => parseIndecCalendarDays(
        await fetchTextFromUrl(indecCalendarPageUrl(date.getUTCFullYear(), date.getUTCMonth())), date.getUTCFullYear(), date.getUTCMonth() + 1)));
    return pages.flat()
        .filter(release => release.title.startsWith(report) && release.date <= today)
        .map(release => release.date)
        .sort()
        .at(-1) ?? null;
}

const BCRA_CALENDAR_URL = 'https://www.bcra.gob.ar/calendario-de-informes/';
const TESORO_CALENDAR_URL = 'https://www.argentina.gob.ar/sites/default/files/calendario_prensa_0.pdf';
const MONTH_COLUMN_HALF_WIDTH = 150; // two month blocks per row on the A4 page

/** Publication id → BCRA report title of each release we show as Próxima. */
const BCRA_CALENDAR_REPORTS: Record<string, string> = { 'bcra-rem': 'Relevamiento de Expectativas de Mercado (REM)' };

/** Rows «<td>report</td><td>dd mmm yyyy</td>» of the BCRA «Calendario de informes». */
export function parseBcraCalendar(html: string): Release[] {
    const abbreviations = MONTH_NAMES_ES.map(name => name.slice(0, 3));
    return [...html.matchAll(/<td>([^<]+)<\/td>\s*<td>(\d{2}) ([a-z]{3}) (\d{4})<\/td>/g)]
        .map(([, title, day, month, year]) => ({ date: isoDate(Number(year), abbreviations.indexOf(month) + 1, Number(day)), title: title.trim() }));
}

/** Days of the Finanzas auction calendar painted with the colour of its «Licitación» legend swatch. */
export function licitacionDates({ texts, rects }: PdfLayout): string[] {
    const label = texts.find(text => text.str.trim() === 'Licitación');
    const year = texts.map(text => /Cronograma de Licitaciones (\d{4})/.exec(text.str)?.[1]).find(Boolean);
    if (!label || !year) return [];
    const legend = rects.find(rect => label.y >= rect.y && label.y <= rect.y + rect.h && Math.abs(rect.x + rect.w - label.x) < 5);
    const headers = texts.flatMap(text => {
        const month = MONTH_NAMES_ES.indexOf(text.str.trim().toLowerCase());
        return month >= 0 ? [{ month, x: text.x, y: text.y }] : [];
    });
    return rects.filter(rect => rect !== legend && rect.fill === legend?.fill).flatMap(rect => {
        const day = texts.find(text => /^\d{1,2}$/.test(text.str) && text.x >= rect.x && text.x <= rect.x + rect.w && text.y >= rect.y && text.y <= rect.y + rect.h);
        const header = headers.filter(item => item.y > rect.y && Math.abs(item.x - rect.x) < MONTH_COLUMN_HALF_WIDTH).sort((a, b) => a.y - b.y)[0];
        return day && header ? [isoDate(Number(year), header.month + 1, Number(day.str))] : [];
    }).sort();
}

const HACIENDA_CALENDAR_URL = 'https://www.argentina.gob.ar/economia/sechacienda/calendariodepublicacion';

/** Publication id → «type» of each MECON (Secretaría de Hacienda) release we show as Próxima. */
const HACIENDA_CALENDAR_REPORTS: Record<string, string> = { 'mecon-recaudacion': 'Recaudación', 'mecon-resultado-fiscal': 'Resultado Fiscal' };

/** Entries «{ "date": "dd/mm/yyyy", "label": …, "type": … }» of the MECON calendar of fiscal results and tax collection. */
export function parseHaciendaCalendar(html: string): Release[] {
    return [...html.matchAll(/"date":\s*"(\d{2})\/(\d{2})\/(\d{4})",\s*"label":\s*"[^"]*",\s*"type":\s*"([^"]+)"/g)]
        .map(([, day, month, year, type]) => ({ date: `${year}-${month}-${day}`, title: type }));
}

/** Upcoming official releases (soonest first) of every calendar-backed event, keyed by publication id: INDEC reports, the BCRA REM, the Tesoro auction and the MECON fiscal/tax releases. */
export async function fetchNextOfficialReleases(today: string): Promise<Record<string, string[]>> {
    const [indec, bcra, tesoro, hacienda] = await Promise.all([fetchIndecCalendar(today), fetchTextFromUrl(BCRA_CALENDAR_URL), fetchBufferFromUrl(TESORO_CALENDAR_URL).then(readPdfLayout), fetchTextFromUrl(HACIENDA_CALENDAR_URL)]);
    const auctions = upcomingOnOrAfter(licitacionDates(tesoro), today);
    return {
        ...upcomingIndecReleases(indec, today),
        ...upcomingByReport(parseBcraCalendar(bcra), BCRA_CALENDAR_REPORTS, today, (title, report) => title === report),
        ...(auctions.length > 0 ? { 'tesoro-licitacion': auctions } : {}),
        ...upcomingByReport(parseHaciendaCalendar(hacienda), HACIENDA_CALENDAR_REPORTS, today, (title, report) => title === report),
    };
}
