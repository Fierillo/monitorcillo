import * as XLSX from 'xlsx';
import type { EmaeRawRow, PbiAnchorRow } from '@/types';

const INDEC_BASE_URL = 'https://www.indec.gob.ar';
const PBI_DESEASONALIZED_SHEET = 'desestacionalizado n';
const PBI_2004_TO_ENE_2017_IPC_FACTOR = 13.5236902916533;
const QUARTER_RELEASE_MONTHS: Record<number, string> = {
    1: '06',
    2: '09',
    3: '12',
    4: '03',
};

function normalizeText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function absoluteIndecUrl(url: string): string {
    return new URL(url, INDEC_BASE_URL).toString();
}

function parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;

    const raw = String(value).trim().replace(/\s/g, '');
    const normalized = raw.includes('.') && raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value: unknown): number | null {
    const match = String(value ?? '').match(/(\d{4})/);
    return match ? Number(match[1]) : null;
}

function parseQuarter(value: unknown): number | null {
    const normalized = normalizeText(value);
    const romanQuarters: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
    if (romanQuarters[normalized]) return romanQuarters[normalized];

    const match = normalized.match(/^(\d)\D*trimestre$/);
    if (!match) return null;

    const quarter = Number(match[1]);
    return quarter >= 1 && quarter <= 4 ? quarter : null;
}

function anchorDate(year: number, quarter: number): string {
    const releaseYear = quarter === 4 ? year + 1 : year;
    return `${releaseYear}-${QUARTER_RELEASE_MONTHS[quarter]}-01`;
}

function emaeValueAtOrBefore(rows: Array<{ fecha: string; valor: number }>, targetDate: string): number | null {
    let value: number | null = null;

    for (const row of rows) {
        if (row.fecha > targetDate) break;
        value = row.valor;
    }

    return value;
}

export function parseLatestPbiWorkbookUrl(html: string): string | null {
    const match = html.match(/(?:href=["']|\()([^"')]+sh_oferta_demanda_desest_\d+_\d+\.xls)/i);
    return match ? absoluteIndecUrl(match[1]) : null;
}

export function parsePbiWorkbook(buffer: Buffer): PbiAnchorRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[PBI_DESEASONALIZED_SHEET] ?? workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
    const anchors: PbiAnchorRow[] = [];
    let currentYear: number | null = null;

    for (const row of rows) {
        currentYear = parseYear(row[0]) ?? currentYear;
        const quarter = parseQuarter(row[1]);
        const pbi = parseNumber(row[2]);
        if (!currentYear || !quarter || pbi === null) continue;

        anchors.push({
            fecha: anchorDate(currentYear, quarter),
            pbi: pbi * PBI_2004_TO_ENE_2017_IPC_FACTOR,
        });
    }

    return anchors.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function buildMonthlyPbiSeries(
    anchors: PbiAnchorRow[],
    emaeRows: EmaeRawRow[],
    targetDates: string[],
): Map<string, number> {
    const sortedAnchors = [...anchors].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const sortedEmae = emaeRows
        .map(row => ({ fecha: row.fecha, valor: parseNumber(row.emae_desestacionalizado) }))
        .filter((row): row is { fecha: string; valor: number } => row.valor !== null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const sortedTargets = Array.from(new Set(targetDates)).sort((a, b) => a.localeCompare(b));
    const result = new Map<string, number>();
    let anchorIndex = -1;

    for (const targetDate of sortedTargets) {
        while (anchorIndex + 1 < sortedAnchors.length && sortedAnchors[anchorIndex + 1].fecha <= targetDate) {
            anchorIndex += 1;
        }

        const anchor = sortedAnchors[anchorIndex];
        if (!anchor) continue;

        const anchorEmae = emaeValueAtOrBefore(sortedEmae, anchor.fecha);
        const targetEmae = emaeValueAtOrBefore(sortedEmae, targetDate);
        const monthlyPbi = targetDate === anchor.fecha || !anchorEmae || !targetEmae
            ? anchor.pbi
            : anchor.pbi * (targetEmae / anchorEmae);

        result.set(targetDate, monthlyPbi);
    }

    return result;
}
