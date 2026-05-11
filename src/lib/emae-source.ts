import * as XLSX from 'xlsx';
import type { EmaeRawRow, NumericValue } from '@/types';
import { EMAE_SECTORS } from './emae/schema';

const MONTHS_ES: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
};

function normalizeText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizedIncludes(value: unknown, expected: string): boolean {
    return normalizeText(value).includes(normalizeText(expected));
}

function parseMonth(value: unknown): string | null {
    return MONTHS_ES[normalizeText(value)] ?? null;
}

function parseNumber(value: unknown): NumericValue {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(numericValue) ? numericValue : null;
}

export function parseEmaeWorkbook(buffer: Buffer): EmaeRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets.EMAE ?? workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
    const parsedRows: EmaeRawRow[] = [];
    let year: number | null = null;

    for (const row of rows) {
        const yearValue = String(row[0] ?? '').trim();
        if (/^\d{4}$/.test(yearValue)) year = Number(yearValue);

        const month = parseMonth(row[1]);
        if (!year || !month) continue;

        const emae = parseNumber(row[2]);
        const emaeDesestacionalizado = parseNumber(row[4]);
        const emaeTendencia = parseNumber(row[6]);

        if (emae == null && emaeDesestacionalizado == null && emaeTendencia == null) continue;

        parsedRows.push({
            fecha: `${year}-${month}-01`,
            emae,
            emae_desestacionalizado: emaeDesestacionalizado,
            emae_tendencia: emaeTendencia,
        });
    }

    return parsedRows.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseEmaeSectorWorkbook(buffer: Buffer): EmaeRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Tabla Letras'];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
    const headerRow = rows.find(row => EMAE_SECTORS.some(sector => row.some(cell => normalizedIncludes(cell, sector.header))));
    if (!headerRow) return [];

    const columnByKey = new Map<string, number>();
    for (const sector of EMAE_SECTORS) {
        const index = headerRow.findIndex(cell => normalizedIncludes(cell, sector.header));
        if (index >= 0) columnByKey.set(sector.key, index);
    }

    const parsedRows: EmaeRawRow[] = [];
    let year: number | null = null;

    for (const row of rows) {
        const yearValue = String(row[0] ?? '').trim();
        if (/^\d{4}$/.test(yearValue)) year = Number(yearValue);

        const month = parseMonth(row[1]);
        if (!year || !month) continue;

        const parsedRow: EmaeRawRow = { fecha: `${year}-${month}-01` };
        for (const sector of EMAE_SECTORS) {
            const column = columnByKey.get(sector.key);
            if (column == null) continue;
            parsedRow[sector.key] = parseNumber(row[column]);
        }

        if (EMAE_SECTORS.some(sector => parsedRow[sector.key] != null)) parsedRows.push(parsedRow);
    }

    return parsedRows.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseEmaePublicationDate(html: string): string | null {
    const match = html.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\.\s*Estimador mensual de actividad/i);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const parsedYear = Number(match[3]);
    if (!day || !month || Number.isNaN(parsedYear)) return null;

    const year = match[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
