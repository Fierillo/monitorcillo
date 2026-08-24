import * as XLSX from 'xlsx';
import type { DepositosPrestamosRawRow } from '@/types';
import { fetchBufferFromUrl, fetchTextFromUrl } from './sync/http-client';

const BANK_REPORT_CATALOG_URL = 'https://www.bcra.gob.ar/wp-json/bcra/v1/publicaciones?category=informe-sobre-bancos&lang=es&action=total';
const BANK_REPORT_TITLE = 'Informe sobre Bancos';

function normalizeLabel(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

function monthFromCell(cell: XLSX.CellObject | undefined): string | null {
    if (cell?.v instanceof Date) return `${cell.v.getUTCFullYear()}-${String(cell.v.getUTCMonth() + 1).padStart(2, '0')}-01`;
    if (typeof cell?.v !== 'number') return null;
    const date = XLSX.SSF.parse_date_code(cell.v);
    if (!date || date.y < 1990 || date.y > 2100) return null;
    return `${date.y}-${String(date.m).padStart(2, '0')}-01`;
}

function addDebtorSectorRatios(sheet: XLSX.WorkSheet, groupName: string, rawKey: 'mora_familias_pct' | 'mora_empresas_pct', rows: Map<string, DepositosPrestamosRawRow>): void {
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    let groupRow = -1;
    let dateRow = -1;
    let ratioRow = -1;
    for (let row = range.s.r; row <= range.e.r; row++) {
        const label = normalizeLabel(sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v);
        if (groupRow < 0 && label === normalizeLabel(groupName)) groupRow = row;
        if (groupRow < 0 || row > groupRow + 12) continue;
        if (label === 'carterairregulartotal') ratioRow = row;
        if (dateRow < 0) {
            for (let column = range.s.c; column <= range.e.c; column++) {
                if (!monthFromCell(sheet[XLSX.utils.encode_cell({ r: row, c: column })])) continue;
                dateRow = row;
                break;
            }
        }
        if (dateRow >= 0 && ratioRow >= 0) break;
    }
    if (groupRow < 0 || dateRow < 0 || ratioRow < 0) throw new Error(`Failed to parse the BCRA bank report annex. Debtor sector "${groupName}" was not found.`);

    for (let column = range.s.c; column <= range.e.c; column++) {
        const fecha = monthFromCell(sheet[XLSX.utils.encode_cell({ r: dateRow, c: column })]);
        const value = Number(sheet[XLSX.utils.encode_cell({ r: ratioRow, c: column })]?.v);
        if (!fecha || !Number.isFinite(value) || value < 0 || value > 100) continue;
        const row = rows.get(fecha) ?? { fecha };
        row[rawKey] = value;
        rows.set(fecha, row);
    }
}

export function parseLatestBankReportPageUrl(text: string): string {
    let response: unknown;
    try {
        response = JSON.parse(text);
    } catch {
        throw new Error('Failed to find the latest BCRA bank report. The publication catalog returned invalid JSON.');
    }

    const data = response && typeof response === 'object' && 'data' in response ? (response as { data?: unknown }).data : null;
    const publications = data && typeof data === 'object' && 'publicaciones' in data ? (data as { publicaciones?: unknown }).publicaciones : null;
    if (!Array.isArray(publications)) throw new Error('Failed to find the latest BCRA bank report. The publication catalog has no publication list.');

    const report = publications.find(publication => publication
        && typeof publication === 'object'
        && (publication as { titulo?: unknown }).titulo === BANK_REPORT_TITLE
        && typeof (publication as { url?: unknown }).url === 'string');
    if (!report) throw new Error('Failed to find the latest BCRA bank report. No report publication was listed.');
    return (report as { url: string }).url;
}

export function parseBankReportAnnexUrl(html: string, pageUrl: string): string {
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+\.xlsx(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const label = match[2].replace(/<[^>]+>/g, ' ');
        if (!/\banexo\b/i.test(label)) continue;
        return new URL(match[1].replaceAll('&amp;', '&'), pageUrl).toString();
    }
    throw new Error(`Failed to find the BCRA bank report annex at ${pageUrl}. Verify whether the publication page changed.`);
}

export function parseBankReportMorosidadWorkbook(buffer: Buffer): DepositosPrestamosRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets.Indicadores;
    if (!sheet) throw new Error('Failed to parse the BCRA bank report annex. Sheet "Indicadores" was not found.');
    const debtorSectorSheet = workbook.Sheets['Calidad de Cartera (por líneas)'];
    if (!debtorSectorSheet) throw new Error('Failed to parse the BCRA bank report annex. Sheet "Calidad de Cartera (por líneas)" was not found.');

    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    let groupRow = -1;
    let ratioRow = -1;
    for (let row = range.s.r; row <= range.e.r; row++) {
        const label = normalizeLabel(sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v);
        if (groupRow < 0 && label === 'sistemafinanciero') groupRow = row;
        else if (groupRow >= 0 && label.includes('irregularidaddecarteraprivada')) {
            ratioRow = row;
            break;
        }
    }
    if (groupRow < 0 || ratioRow < 0) throw new Error('Failed to parse the BCRA bank report annex. The system-wide private portfolio irregularity row was not found.');

    let dateRow = -1;
    let dateCount = 0;
    for (let row = groupRow + 1; row < ratioRow; row++) {
        let count = 0;
        for (let column = range.s.c; column <= range.e.c; column++) {
            if (monthFromCell(sheet[XLSX.utils.encode_cell({ r: row, c: column })])) count++;
        }
        if (count <= dateCount) continue;
        dateRow = row;
        dateCount = count;
    }
    if (dateRow < 0) throw new Error('Failed to parse the BCRA bank report annex. The indicator date row was not found.');

    const rows = new Map<string, DepositosPrestamosRawRow>();
    for (let column = range.s.c; column <= range.e.c; column++) {
        const fecha = monthFromCell(sheet[XLSX.utils.encode_cell({ r: dateRow, c: column })]);
        const value = Number(sheet[XLSX.utils.encode_cell({ r: ratioRow, c: column })]?.v);
        if (!fecha || !Number.isFinite(value) || value < 0 || value > 100) continue;
        rows.set(fecha, { fecha, mora_irregular_total_pct: value });
    }
    if (rows.size === 0) throw new Error('Failed to parse the BCRA bank report annex. No private portfolio irregularity observations were found.');
    addDebtorSectorRatios(debtorSectorSheet, '2. Familias - Total', 'mora_familias_pct', rows);
    addDebtorSectorRatios(debtorSectorSheet, '3. Empresas - Total', 'mora_empresas_pct', rows);
    return [...rows.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchBankReportMorosidadRaw(): Promise<DepositosPrestamosRawRow[]> {
    const pageUrl = parseLatestBankReportPageUrl(await fetchTextFromUrl(BANK_REPORT_CATALOG_URL));
    const annexUrl = parseBankReportAnnexUrl(await fetchTextFromUrl(pageUrl), pageUrl);
    return parseBankReportMorosidadWorkbook(await fetchBufferFromUrl(annexUrl));
}
