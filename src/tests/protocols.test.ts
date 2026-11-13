import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { excelSerialToIsoMonth, extractFileLinks, firstSheetRows, parseJson, readWorkbook, sheetRows } from '../lib/protocols';

describe('ingest protocols', () => {
    it('parses JSON payloads', () => {
        expect(parseJson('{"ok":true}')).toEqual({ ok: true });
        expect(() => parseJson('{')).toThrow('The payload is not valid JSON');
    });

    function buildWorkbook(): XLSX.WorkBook {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['fecha', 'valor'], ['2026-01-01', 1.2], [null, 3]]), 'Serie');
        return workbook;
    }

    it('turns a sheet into rows, keeping blanks addressable by column', () => {
        const buffer = Buffer.from(XLSX.write(buildWorkbook(), { type: 'buffer', bookType: 'xlsx' }));
        const workbook = readWorkbook(buffer);

        expect(workbook.SheetNames).toEqual(['Serie']);
        expect(sheetRows(workbook.Sheets.Serie)).toEqual([
            ['fecha', 'valor'],
            ['2026-01-01', '1.2'],
            [null, '3'],
        ]);
    });

    it('reports no rows for a sheet the workbook does not have', () => {
        const buffer = Buffer.from(XLSX.write(buildWorkbook(), { type: 'buffer', bookType: 'xlsx' }));

        expect(sheetRows(readWorkbook(buffer).Sheets['Hoja inexistente'])).toEqual([]);
    });

    it('reads the rows of the first sheet, including semicolon CSV files in Latin-1 like INDEC publishes them', () => {
        expect(firstSheetRows(Buffer.from('Codigo;Descripcion;v_m_IPC\r\nNúcleo;;1,7\r\n', 'latin1'))).toEqual([
            ['Codigo', 'Descripcion', 'v_m_IPC'],
            ['Núcleo', null, '1,7'],
        ]);
    });

    it('reads workbooks downloaded as raw bytes', () => {
        const bytes = new Uint8Array(XLSX.write(buildWorkbook(), { type: 'array', bookType: 'xlsx' }));

        expect(readWorkbook(bytes).SheetNames).toEqual(['Serie']);
    });

    it('reads the month of an Excel serial as YYYY-MM-01', () => {
        expect(excelSerialToIsoMonth(46266)).toBe('2026-09-01');
        expect(excelSerialToIsoMonth(40000)).toBe('2009-07-01');
        expect(excelSerialToIsoMonth(-1)).toBeNull();
    });

    it('extracts file links from HTML', () => {
        const html = `
            <a href="/download.php?fname=nowcast.pdf">Mar26Ago26</a>
            <a href="https://www.indec.gob.ar/ftp/sh_ipc.xls">IPC</a>
            <a href="/about">Ignore</a>
        `;

        expect(extractFileLinks(html, { origin: 'https://www.utdt.edu', extensions: ['pdf', 'xls'] })).toEqual([
            { href: 'https://www.utdt.edu/download.php?fname=nowcast.pdf', label: 'Mar26Ago26' },
            { href: 'https://www.indec.gob.ar/ftp/sh_ipc.xls', label: 'IPC' },
        ]);
    });
});
