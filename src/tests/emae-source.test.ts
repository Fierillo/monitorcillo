import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseEmaePublicationDate, parseEmaeWorkbook } from '../lib/emae-source';

function workbookBuffer(rows: unknown[][]): Buffer {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'EMAE');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('EMAE official source parsing', () => {
    it('parses EMAE rows from the INDEC workbook', () => {
        const rows = parseEmaeWorkbook(workbookBuffer([
            ['Período', null, 'Índice Serie Original', null, 'Índice Serie Desestacionalizada', null, 'Índice Serie Tendencia-Ciclo'],
            ['2026', 'Enero', '148.8', null, '155.7', null, '152.7'],
            [null, 'Febrero', '138.2', null, '151.7', null, '152.8'],
        ]));

        expect(rows).toEqual([
            {
                fecha: '2026-01-01',
                emae: 148.8,
                emae_desestacionalizado: 155.7,
                emae_tendencia: 152.7,
            },
            {
                fecha: '2026-02-01',
                emae: 138.2,
                emae_desestacionalizado: 151.7,
                emae_tendencia: 152.8,
            },
        ]);
    });

    it('parses the EMAE report publication date from the INDEC page', () => {
        const html = '<div>22/04/26. Estimador mensual de actividad económica. Estimación preliminar de febrero de 2026</div>';

        expect(parseEmaePublicationDate(html)).toBe('2026-04-22');
    });
});
