import * as XLSX from 'xlsx';
import type { DepositosPrestamosRawRow } from '@/types';
import { PNFC_BREAKDOWNS } from './morosidad/schema';
import { fetchBufferFromUrl } from './sync/http-client';

const PNFC_ANNEX_URL = 'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/anexo-estadistico-proveedores-no-financieros-credito-junio-2026.xlsx';

function monthFromCell(cell: XLSX.CellObject | undefined): string | null {
    if (typeof cell?.v !== 'number') return null;
    const date = XLSX.SSF.parse_date_code(cell.v);
    if (!date) return null;
    return `${date.y}-${String(date.m).padStart(2, '0')}-01`;
}

function numberFromCell(cell: XLSX.CellObject | undefined): number | null {
    const value = Number(cell?.v);
    return cell?.v == null || !Number.isFinite(value) ? null : value;
}

export function parsePnfcWorkbook(buffer: Buffer): DepositosPrestamosRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = new Map<string, DepositosPrestamosRawRow>();

    for (const breakdown of PNFC_BREAKDOWNS) {
        const sheet = workbook.Sheets[breakdown.sheet];
        if (!sheet) throw new Error(`Failed to parse PNFC annex. Sheet "${breakdown.sheet}" was not found.`);
        const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
        for (let column = 1; column <= range.e.c; column++) {
            const fecha = monthFromCell(sheet[XLSX.utils.encode_cell({ r: breakdown.dateRow - 1, c: column })]);
            if (!fecha) continue;
            const row = rows.get(fecha) ?? { fecha };
            for (const series of breakdown.series) {
                const ratio = numberFromCell(sheet[XLSX.utils.encode_cell({ r: series.ratioRow - 1, c: column })]);
                if (ratio == null) continue;
                row[series.rawKey] = ratio * 100;
            }
            rows.set(fecha, row);
        }
    }
    return [...rows.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchPnfcRaw(): Promise<DepositosPrestamosRawRow[]> {
    return parsePnfcWorkbook(await fetchBufferFromUrl(PNFC_ANNEX_URL));
}
