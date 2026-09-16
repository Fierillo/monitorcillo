import type { SipaRawRow } from '@/types';
import { SIPA_PAGE_URL, SIPA_VALUE_KEYS } from './sipa-schema';
import { readWorkbook, sheetRows } from './protocols';
import { fetchBufferFromUrl, fetchLastModifiedDate, isoDateFromHttpDate } from './sync/http-client';

type SipaSourceReport = {
    rows: SipaRawRow[];
    publishedAt: string | null;
};

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';
const SIPA_WORKBOOK_PATTERN = /trabajoregistrado[_%5F](\d{4})[_%5F]estadisticas\.xlsx/i;
const SIPA_WORKBOOK_TIMEOUT_MS = 120_000;

const MONTHS: Record<string, string> = {
    jan: '01',
    ene: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    abr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    ago: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
    dic: '12',
};

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url.replace(/^blank:#/, ''), ARGENTINA_GOB_BASE_URL).toString();
}

function normalizeText(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parsePeriod(value: unknown): { fecha: string; provisional: boolean } | null {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^([A-Za-z]{3})-(\d{2})(\*)?$/);
    if (!match) return null;
    const month = MONTHS[match[1].toLowerCase()];
    if (!month) return null;
    const year = Number(match[2]) >= 80 ? `19${match[2]}` : `20${match[2]}`;
    return { fecha: `${year}-${month}-01`, provisional: match[3] === '*' };
}

function parseNumber(value: unknown): number | null {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    if (!normalized || normalized === '-') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function columnIndex(header: unknown[], matcher: (text: string) => boolean): number {
    return header.findIndex(cell => matcher(normalizeText(cell)));
}

export function parseLatestSipaWorkbookUrl(html: string): string | null {
    const candidates = Array.from(
        html.matchAll(/href=["'](?:blank:#)?([^"']*trabajoregistrado[_%5F]\d{4}[_%5F]estadisticas\.xlsx)["']/gi),
    ).map(match => {
        const href = match[1];
        const period = href.match(SIPA_WORKBOOK_PATTERN)?.[1] ?? '';
        return { url: absoluteArgentinaGobUrl(href), period };
    });

    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.period.localeCompare(a.period))[0].url;
}

export function parseSipaWorkbook(buffer: Buffer): SipaRawRow[] {
    const rows = sheetRows(readWorkbook(buffer).Sheets['T.2.2']);
    const headerIndex = rows.findIndex(row => normalizeText(row[0]) === 'periodo');
    if (headerIndex < 0) {
        throw new Error('Failed to find SIPA T.2.2 header row. Verify the workbook sheet layout.');
    }

    const header = rows[headerIndex];
    const indexes = {
        privado: columnIndex(header, text => text.includes('sector privado')),
        publico: columnIndex(header, text => text.includes('sector publico')),
        casas_particulares: columnIndex(header, text => text.includes('casas particulares')),
        autonomos: columnIndex(header, text => text.includes('autonomos')),
        monotributo_social: columnIndex(header, text => text.includes('monotributo') && text.includes('social')),
        monotributo: columnIndex(header, text => text.includes('monotributo') && !text.includes('social')),
        total: columnIndex(header, text => text === 'total'),
    };

    if (Object.values(indexes).some(index => index < 0)) {
        throw new Error('Failed to map SIPA T.2.2 modality columns. Verify the workbook header labels.');
    }

    return rows.slice(headerIndex + 1).flatMap(row => {
        const period = parsePeriod(row[0]);
        if (!period) return [];
        return [{
            fecha: period.fecha,
            privado: parseNumber(row[indexes.privado]),
            publico: parseNumber(row[indexes.publico]),
            casas_particulares: parseNumber(row[indexes.casas_particulares]),
            autonomos: parseNumber(row[indexes.autonomos]),
            monotributo: parseNumber(row[indexes.monotributo]),
            monotributo_social: parseNumber(row[indexes.monotributo_social]),
            total: parseNumber(row[indexes.total]),
            provisional: period.provisional,
        }];
    });
}

export async function fetchSipaRawReport(): Promise<SipaSourceReport> {
    const pageResponse = await fetch(SIPA_PAGE_URL);
    if (!pageResponse.ok) {
        throw new Error(`Failed to download ${SIPA_PAGE_URL}. Status ${pageResponse.status}. Verify the Secretaría de Trabajo statistics page.`);
    }

    const pagePublishedAt = isoDateFromHttpDate(pageResponse.headers.get('last-modified'));
    const html = await pageResponse.text();
    const workbookUrl = parseLatestSipaWorkbookUrl(html);
    if (!workbookUrl) {
        throw new Error(`Failed to find the SIPA statistics workbook at ${SIPA_PAGE_URL}. Verify the anexo links.`);
    }

    const [buffer, publishedAt] = await Promise.all([
        fetchBufferFromUrl(workbookUrl, { timeoutMs: SIPA_WORKBOOK_TIMEOUT_MS }),
        fetchLastModifiedDate(workbookUrl),
    ]);
    const rows = parseSipaWorkbook(buffer);
    if (rows.length === 0 || !SIPA_VALUE_KEYS.every(key => rows.some(row => row[key] != null))) {
        throw new Error(`Failed to parse SIPA modality series from ${workbookUrl}. Verify sheet T.2.2.`);
    }

    return { rows, publishedAt: publishedAt ?? pagePublishedAt };
}
