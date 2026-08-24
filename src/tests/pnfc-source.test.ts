import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { PNFC_BREAKDOWNS } from '../lib/morosidad/schema';
import { parsePnfcWorkbook } from '../lib/pnfc-source';

describe('parsePnfcWorkbook', () => {
    it('parses irregularity ratios for every public breakdown', () => {
        const workbook = XLSX.utils.book_new();
        for (const breakdown of PNFC_BREAKDOWNS) {
            const sheet = XLSX.utils.aoa_to_sheet([[]]);
            const first = breakdown.series[0];
            sheet[XLSX.utils.encode_cell({ r: breakdown.dateRow - 1, c: 1 })] = { t: 'n', v: 46081 };
            sheet[XLSX.utils.encode_cell({ r: first.financingRow - 1, c: 1 })] = { t: 'n', v: 1000 };
            sheet[XLSX.utils.encode_cell({ r: first.ratioRow - 1, c: 1 })] = { t: 'n', v: 0.25 };
            sheet['!ref'] = `A1:B${Math.max(breakdown.dateRow, first.ratioRow)}`;
            XLSX.utils.book_append_sheet(workbook, sheet, breakdown.sheet);
        }

        const rows = parsePnfcWorkbook(Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })));

        expect(rows).toEqual([{
            fecha: '2026-02-01',
            mora_pnfc_hasta_29_pct: 25,
            mora_pnfc_cooperativas_pct: 25,
            mora_pnfc_tarjetas_pct: 25,
        }]);
    });
});
