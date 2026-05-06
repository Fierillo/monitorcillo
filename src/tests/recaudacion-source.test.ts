import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { mergeRecaudacionOfficialReport, parseLatestRecaudacionWorkbookUrl, parseRecaudacionWorkbook } from '../lib/recaudacion-source';

function workbookBuffer(rows: unknown[][]): Buffer {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, '2026-Abril');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('Recaudacion official source parsing', () => {
    it('parses the latest Hacienda workbook URL from the recaudacion page', () => {
        const html = '<a href="/sites/default/files/2026-abril-1.xlsx"><div><h3>Último: abril 2026</h3></div></a>';

        expect(parseLatestRecaudacionWorkbookUrl(html)).toBe('https://www.argentina.gob.ar/sites/default/files/2026-abril-1.xlsx');
    });

    it('parses the published report from the Hacienda workbook', () => {
        const report = parseRecaudacionWorkbook(workbookBuffer([
            [null, null, null, null, null, null, null, '04-May-2026'],
            ['RECAUDACION TRIBUTARIA. ABRIL DE 2026. (1) '],
            [],
            ['Concepto', "Abr. '26"],
            [' Ganancias', '3,136,961 '],
            [' Total recursos tributarios', '17,400,833 '],
        ]));

        expect(report).toEqual({
            publishedAt: '2026-05-04',
            row: {
                fecha: '2026-04-01',
                mes: '04',
                year: 2026,
                recaudacion_total: 17400833,
            },
        });
    });

    it('adds or overrides the official workbook row without dropping existing macro fields', () => {
        const rows = mergeRecaudacionOfficialReport([
            {
                fecha: '2026-04-01',
                mes: '04',
                year: 2026,
                recaudacion_total: 17000000,
                pbi_trimestral: 100,
                emae_desestacionalizado: 150,
                ipc_nucleo: 200,
            },
        ], {
            publishedAt: '2026-05-04',
            row: {
                fecha: '2026-04-01',
                mes: '04',
                year: 2026,
                recaudacion_total: 17400833,
            },
        });

        expect(rows).toEqual([
            {
                fecha: '2026-04-01',
                mes: '04',
                year: 2026,
                recaudacion_total: 17400833,
                pbi_trimestral: 100,
                emae_desestacionalizado: 150,
                ipc_nucleo: 200,
            },
        ]);
    });
});
