import type { SipaRawRow } from '@/types';
import { SIPA_PAGE_URL, SIPA_VALUE_KEYS } from './sipa-schema';
import { readWorkbook, sheetRows } from './protocols';
import { normalizeText } from './normalize/text';
import { parsePeriod } from './normalize/dates';
import { parseNumber } from './normalize/numbers';
import { fetchBufferFromUrl, fetchLastModifiedDate, fetchTextFromUrl } from './sync/http-client';

type SipaSourceReport = {
    rows: SipaRawRow[];
    publishedAt: string | null;
};

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';
const SIPA_WORKBOOK_PATTERN = /trabajoregistrado[_%5F](\d{4})[_%5F]estadisticas\.xlsx/i;
const SIPA_WORKBOOK_TIMEOUT_MS = 120_000;

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url.replace(/^blank:#/, ''), ARGENTINA_GOB_BASE_URL).toString();
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
        const raw = String(row[0] ?? '').trim();
        const fecha = parsePeriod(raw, 'mmm-yy');
        if (!fecha) return [];
        return [{
            fecha,
            privado: parseNumber(row[indexes.privado], 'en'),
            publico: parseNumber(row[indexes.publico], 'en'),
            casas_particulares: parseNumber(row[indexes.casas_particulares], 'en'),
            autonomos: parseNumber(row[indexes.autonomos], 'en'),
            monotributo: parseNumber(row[indexes.monotributo], 'en'),
            monotributo_social: parseNumber(row[indexes.monotributo_social], 'en'),
            total: parseNumber(row[indexes.total], 'en'),
            provisional: raw.endsWith('*'),
        }];
    });
}

export async function fetchSipaRawReport(): Promise<SipaSourceReport> {
    const [html, pagePublishedAt] = await Promise.all([fetchTextFromUrl(SIPA_PAGE_URL), fetchLastModifiedDate(SIPA_PAGE_URL)]);
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
