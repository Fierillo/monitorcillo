import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMonthlyPbiSeries, parseLatestPbiWorkbookUrl, parsePbiWorkbook } from '../lib/pbi-source';

function workbookBuffer(rows: unknown[][]): Buffer {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'desestacionalizado n');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('PBI official source parsing', () => {
    it('parses the latest INDEC PBI workbook URL', () => {
        const html = '<a href="/ftp/cuadros/economia/sh_oferta_demanda_desest_03_26.xls">Series trimestrales desestacionalizadas de oferta y demanda globales</a>';

        expect(parseLatestPbiWorkbookUrl(html)).toBe('https://www.indec.gob.ar/ftp/cuadros/economia/sh_oferta_demanda_desest_03_26.xls');
    });

    it('parses seasonally adjusted constant-price PBI quarters as publication-month anchors in Ene-17 pesos', () => {
        const anchors = parsePbiWorkbook(workbookBuffer([
            ['Oferta y demanda globales: series desestacionalizadas en millones de pesos, a precios de 2004'],
            [],
            ['Período', null, 'Oferta y demanda globales'],
            ['Año', 'Trimestre', 'PIB'],
            [],
            ['2025', 'I', '736,261'],
            [null, 'II', '735,534'],
            [null, 'III', '739,904'],
            [null, 'IV', '744,528'],
        ]));

        expect(anchors).toHaveLength(4);
        expect(anchors[0]).toEqual({ fecha: '2025-06-01', pbi: 736261 * 13.5236902916533 });
        expect(anchors[3]).toEqual({ fecha: '2026-03-01', pbi: 744528 * 13.5236902916533 });
    });

    it('uses each real PBI month as anchor and adjusts the following months with EMAE', () => {
        const monthlyPbi = buildMonthlyPbiSeries([
            { fecha: '2026-03-01', pbi: 1000 },
            { fecha: '2026-06-01', pbi: 1300 },
        ], [
            { fecha: '2026-03-01', emae_desestacionalizado: 100 },
            { fecha: '2026-04-01', emae_desestacionalizado: 110 },
            { fecha: '2026-05-01', emae_desestacionalizado: 120 },
            { fecha: '2026-06-01', emae_desestacionalizado: 130 },
            { fecha: '2026-07-01', emae_desestacionalizado: 143 },
        ], ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01']);

        expect(monthlyPbi.get('2026-03-01')).toBe(1000);
        expect(monthlyPbi.get('2026-04-01')).toBe(1100);
        expect(monthlyPbi.get('2026-05-01')).toBe(1200);
        expect(monthlyPbi.get('2026-06-01')).toBe(1300);
        expect(monthlyPbi.get('2026-07-01')).toBeCloseTo(1430, 6);
    });
});
