import type { IcgRawRow } from '@/types';
import { extractFileLinks, readWorkbook, sheetRows } from './protocols';
import { fetchBufferFromUrl } from './sync/http-client';
import { UTDT_ICG_CALENDAR_URL, decodeUtdtPageHtml, fetchIcgCalendarSchedule, icgNextPublicationFromSchedule, icgPublicationDateFromSchedule, readIcgCalendarImageText, type IcgDiffusionEntry } from './icg-schedule';

const UTDT_ICG_DATA_PAGE_URL = 'https://www.utdt.edu/listado_contenidos.php?id_item_menu=28756';
const UTDT_ORIGIN = 'https://www.utdt.edu';
const MONTHS: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};

type IcgSourceReport = {
    rows: IcgRawRow[];
    publishedAt: string | null;
    nextPublishedAt: string | null;
};

type IcgRawReportIo = {
    fetchDataPage?: () => Promise<string>;
    fetchWorkbook?: (url: string) => Promise<Buffer>;
    fetchCalendarSchedule?: () => Promise<IcgDiffusionEntry[]>;
    fetchCalendarPage?: () => Promise<string>;
    fetchCalendarImage?: (url: string) => Promise<Buffer>;
    readCalendarImageText?: (buffer: Buffer) => Promise<string>;
    today?: string;
};

function parseMonth(value: unknown): string | null {
    const match = String(value ?? '').trim().match(/^([A-Za-z]{3})-(\d{2}|\d{4})$/);
    if (!match) return null;
    const month = MONTHS[match[1].toLowerCase()];
    if (!month) return null;
    const yearToken = Number(match[2]);
    const year = match[2].length === 2 ? (yearToken >= 80 ? 1900 : 2000) + yearToken : yearToken;
    return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function parseIcgWorkbook(buffer: Buffer): IcgRawRow[] {
    const workbook = readWorkbook(buffer);
    const rowsByDate = new Map<string, IcgRawRow>();

    for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook.Sheets[sheetName]);
        const dateRowIndex = rows.findIndex(row => row.filter(value => parseMonth(value)).length >= 2);
        if (dateRowIndex < 0) continue;
        const valueRow = rows.slice(dateRowIndex + 1).find(row => row.some(value => /^ICG\s*$/i.test(String(value ?? '').trim())));
        if (!valueRow) continue;

        rows[dateRowIndex].forEach((value, index) => {
            const fecha = parseMonth(value);
            const icg = Number(String(valueRow[index] ?? '').replace(',', '.'));
            if (fecha && Number.isFinite(icg) && icg >= 0 && icg <= 5) rowsByDate.set(fecha, { fecha, icg });
        });
    }

    return Array.from(rowsByDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseIcgWorkbookUrl(html: string): string | null {
    const link = extractFileLinks(html, { origin: UTDT_ORIGIN, extensions: ['xls'] })
        .find(candidate => /excel/i.test(candidate.label));
    return link?.href ?? null;
}

async function fetchIcgCalendarPageHtml(): Promise<string> {
    return decodeUtdtPageHtml(await fetchBufferFromUrl(UTDT_ICG_CALENDAR_URL));
}

async function fetchIcgDataPageHtml(): Promise<string> {
    const pageResponse = await fetch(UTDT_ICG_DATA_PAGE_URL);
    if (!pageResponse.ok) throw new Error(`Failed to download ${UTDT_ICG_DATA_PAGE_URL}. Status ${pageResponse.status}`);
    return pageResponse.text();
}

async function loadIcgCalendarSchedule(io: IcgRawReportIo): Promise<IcgDiffusionEntry[]> {
    if (io.fetchCalendarSchedule) return io.fetchCalendarSchedule();
    return fetchIcgCalendarSchedule({
        fetchPage: io.fetchCalendarPage ?? fetchIcgCalendarPageHtml,
        fetchImage: io.fetchCalendarImage ?? fetchBufferFromUrl,
        readImageText: io.readCalendarImageText ?? readIcgCalendarImageText,
    });
}

export async function fetchIcgRawReport(io: IcgRawReportIo = {}): Promise<IcgSourceReport> {
    const html = await (io.fetchDataPage ?? fetchIcgDataPageHtml)();
    const workbookUrl = parseIcgWorkbookUrl(html);
    if (!workbookUrl) throw new Error(`Failed to find the UTDT ICG Excel download at ${UTDT_ICG_DATA_PAGE_URL}. Verify the page format.`);
    const buffer = await (io.fetchWorkbook ?? fetchBufferFromUrl)(workbookUrl);
    const rows = parseIcgWorkbook(buffer);
    if (rows.length === 0) throw new Error(`Failed to parse ICG observations from ${workbookUrl}. Verify the workbook format.`);
    const latestPeriod = rows.at(-1)?.fecha;
    const schedule = await loadIcgCalendarSchedule(io);
    const today = io.today ?? new Date().toISOString().split('T')[0];
    return {
        rows,
        publishedAt: latestPeriod ? icgPublicationDateFromSchedule(schedule, latestPeriod) : null,
        nextPublishedAt: icgNextPublicationFromSchedule(schedule, today),
    };
}
