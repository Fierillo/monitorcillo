import * as XLSX from 'xlsx';

export function readWorkbook(data: Buffer | ArrayBuffer | Uint8Array): XLSX.WorkBook {
    return XLSX.read(data, { type: Buffer.isBuffer(data) ? 'buffer' : 'array' });
}

export function sheetRows(sheet: XLSX.WorkSheet | undefined): unknown[][] {
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
}
