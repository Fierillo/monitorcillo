import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseIcgWorkbook, parseIcgWorkbookUrl } from '../lib/icg-source';

describe('ICG UTDT source parsing', () => {
    it('finds the monthly Excel download', () => {
        const html = '<a href="/download.php?fname=_123.xls">Evolución Mensual del ICG, 2001 - Presente (Excel)</a>';
        expect(parseIcgWorkbookUrl(html)).toBe('https://www.utdt.edu/download.php?fname=_123.xls');
    });

    it('combines the historical and current workbook sheets', () => {
        const workbook = XLSX.utils.book_new();
        const historical = XLSX.utils.aoa_to_sheet([
            ['Título'],
            [null, null, 'Nov-01', 'Dec-01'],
            [null, 'ICG ', 1.04, 0.76],
        ]);
        const current = XLSX.utils.aoa_to_sheet([
            ['Título'],
            [null, null, 'Jan-23', 'Feb-23'],
            [null, 'ICG ', 1.27, 1.17],
        ]);
        XLSX.utils.book_append_sheet(workbook, historical, 'Histórico');
        XLSX.utils.book_append_sheet(workbook, current, 'Actual');

        expect(parseIcgWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }))).toEqual([
            { fecha: '2001-11-01', icg: 1.04 },
            { fecha: '2001-12-01', icg: 0.76 },
            { fecha: '2023-01-01', icg: 1.27 },
            { fecha: '2023-02-01', icg: 1.17 },
        ]);
    });
});
