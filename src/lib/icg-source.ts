import * as XLSX from 'xlsx';
import type { IcgRawRow } from '@/types';
import { fetchBufferFromUrl } from './sync/http-client';

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
};

function absoluteUtdtUrl(url: string): string {
    return url.startsWith('http') ? url : `${UTDT_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function isoDateFromHttpDate(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

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
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rowsByDate = new Map<string, IcgRawRow>();

    for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: null });
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
    const match = html.match(/href=["']([^"']*download\.php\?fname=[^"']+\.xls)["'][^>]*>[^<]*Excel/i);
    return match ? absoluteUtdtUrl(match[1].replace(/&amp;/g, '&')) : null;
}

async function fetchPublishedAt(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok ? isoDateFromHttpDate(response.headers.get('last-modified')) : null;
    } catch {
        return null;
    }
}

export async function fetchIcgRawReport(): Promise<IcgSourceReport> {
    const pageResponse = await fetch(UTDT_ICG_DATA_PAGE_URL);
    if (!pageResponse.ok) throw new Error(`Failed to download ${UTDT_ICG_DATA_PAGE_URL}. Status ${pageResponse.status}`);
    const pagePublishedAt = isoDateFromHttpDate(pageResponse.headers.get('last-modified'));
    const html = await pageResponse.text();
    const workbookUrl = parseIcgWorkbookUrl(html);
    if (!workbookUrl) throw new Error(`Failed to find the UTDT ICG Excel download at ${UTDT_ICG_DATA_PAGE_URL}. Verify the page format.`);
    const [buffer, publishedAt] = await Promise.all([fetchBufferFromUrl(workbookUrl), fetchPublishedAt(workbookUrl)]);
    const rows = parseIcgWorkbook(buffer);
    if (rows.length === 0) throw new Error(`Failed to parse ICG observations from ${workbookUrl}. Verify the workbook format.`);
    return { rows, publishedAt: publishedAt ?? pagePublishedAt };
}

export async function fetchIcgRaw(): Promise<IcgRawRow[]> {
    return (await fetchIcgRawReport()).rows;
}
