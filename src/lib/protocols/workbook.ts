import * as XLSX from 'xlsx';
import { isoDate } from '../normalize/dates';

/** First day of the month of an Excel serial date; null when it is not a date. */
export function excelSerialToIsoMonth(serial: number): string | null {
    const date = XLSX.SSF.parse_date_code(serial);
    return date ? isoDate(date.y, date.m, 1) : null;
}

export function readWorkbook(data: Buffer | ArrayBuffer | Uint8Array): XLSX.WorkBook {
    return XLSX.read(data, { type: Buffer.isBuffer(data) ? 'buffer' : 'array' });
}

export function sheetRows(sheet: XLSX.WorkSheet | undefined): unknown[][] {
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
}

/** Rows of the first sheet of a downloaded workbook or CSV (delimiter and encoding detected). */
export function firstSheetRows(data: Buffer | ArrayBuffer | Uint8Array): unknown[][] {
    const workbook = readWorkbook(data);
    return sheetRows(workbook.Sheets[workbook.SheetNames[0]]);
}
