import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { fetchIcgRawReport, parseIcgWorkbook, parseIcgWorkbookUrl } from '../lib/icg-source';

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

    it('uses the cronograma date of the latest observation as publishedAt', async () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            ['Título'],
            [null, null, 'Feb-27', 'Mar-27'],
            [null, 'ICG ', 1.1, 1.2],
        ]), 'Actual');

        const report = await fetchIcgRawReport({
            fetchDataPage: async () => '<a href="/download.php?fname=_123.xls">Evolución Mensual del ICG, 2001 - Presente (Excel)</a>',
            fetchWorkbook: async (url) => {
                expect(url).toBe('https://www.utdt.edu/download.php?fname=_123.xls');
                return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
            },
            fetchCalendarSchedule: async () => [
                { period: '2027-02-01', publishedOn: '2027-02-22' },
                { period: '2027-03-01', publishedOn: '2027-03-23' },
            ],
        });

        expect(report.publishedAt).toBe('2027-03-23');
        expect(report.rows.at(-1)).toEqual({ fecha: '2027-03-01', icg: 1.2 });
    });

    it('loads those dates from the UTDT cronograma page image', async () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            ['Título'],
            [null, null, 'Feb-27', 'Mar-27'],
            [null, 'ICG ', 1.1, 1.2],
        ]), 'Actual');

        const report = await fetchIcgRawReport({
            fetchDataPage: async () => '<a href="/download.php?fname=_123.xls">Evolución Mensual del ICG, 2001 - Presente (Excel)</a>',
            fetchWorkbook: async () => XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }),
            fetchCalendarPage: async () => `
                <h2>Cronograma de difusión 2027</h2>
                <img src="https://www.utdt.edu/imagen/_111.png">
            `,
            fetchCalendarImage: async (url) => {
                expect(url).toBe('https://www.utdt.edu/imagen/_111.png');
                return Buffer.from('image');
            },
            readCalendarImageText: async (buffer) => {
                expect(buffer.toString()).toBe('image');
                return 'Cronograma de difusión ICG 2027\nMARZO MARTES 23';
            },
        });

        expect(report.publishedAt).toBe('2027-03-23');
    });

    it('includes the next cronograma date after today', async () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            ['Título'],
            [null, null, 'Feb-27', 'Mar-27'],
            [null, 'ICG ', 1.1, 1.2],
        ]), 'Actual');

        const report = await fetchIcgRawReport({
            fetchDataPage: async () => '<a href="/download.php?fname=_123.xls">Evolución Mensual del ICG, 2001 - Presente (Excel)</a>',
            fetchWorkbook: async () => XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }),
            fetchCalendarSchedule: async () => [
                { period: '2027-02-01', publishedOn: '2027-02-22' },
                { period: '2027-03-01', publishedOn: '2027-03-23' },
            ],
            today: '2027-02-10',
        });

        expect(report.nextPublishedAt).toBe('2027-02-22');
    });
});
