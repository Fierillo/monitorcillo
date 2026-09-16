import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseLatestSipaWorkbookUrl, parseSipaWorkbook } from '../lib/sipa-source';

function workbook(rows: unknown[][], sheetName: string): Buffer {
    const result = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(result, XLSX.utils.aoa_to_sheet(rows), sheetName);
    return XLSX.write(result, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('SIPA registered employment source parsing', () => {
    it('picks the latest SIPA statistics workbook and ignores EIL anexos', () => {
        const html = `
            <td data-label=Anexo><a href="https://www.argentina.gob.ar/sites/default/files/trabajoregistrado_2602_estadisticas.xlsx">ver</a></td>
            <td data-label=Anexo><a href="blank:#https://www.argentina.gob.ar/sites/default/files/eil_2607_estadisticas.xlsx">ver</a></td>
            <td data-label=Anexo><a href="/sites/default/files/trabajoregistrado_2606_estadisticas.xlsx">ver</a></td>
        `;

        expect(parseLatestSipaWorkbookUrl(html)).toBe(
            'https://www.argentina.gob.ar/sites/default/files/trabajoregistrado_2606_estadisticas.xlsx',
        );
    });

    it('parses seasonally-adjusted modality breakdown from sheet T.2.2', () => {
        const buffer = workbook([
            ['T.2.2. Personas con trabajo registrado según modalidad ocupacional principal. Sin estacionalidad.'],
            [
                'Período',
                'Empleo asalariado en el sector privado',
                'Empleo asalariado en el sector público',
                'Empleo en casas particulares',
                'Trabajo Independientes Autónomos',
                'Trabajo Independientes Monotributo',
                'Trabajo Independientes Monotributo Social',
                'Total',
            ],
            ['Jan-12', '6,068.2', '2,549.9', '389.7', '408.2', '1,314.7', '167.8', '10,898.5'],
            ['jun-26*', '6,126.4', '3,380.0', '444.1', '388.9', '2,206.8', '227.3', '12,773.4'],
        ], 'T.2.2');

        expect(parseSipaWorkbook(buffer)).toEqual([
            {
                fecha: '2012-01-01',
                privado: 6068.2,
                publico: 2549.9,
                casas_particulares: 389.7,
                autonomos: 408.2,
                monotributo: 1314.7,
                monotributo_social: 167.8,
                total: 10898.5,
                provisional: false,
            },
            {
                fecha: '2026-06-01',
                privado: 6126.4,
                publico: 3380,
                casas_particulares: 444.1,
                autonomos: 388.9,
                monotributo: 2206.8,
                monotributo_social: 227.3,
                total: 12773.4,
                provisional: true,
            },
        ]);
    });
});
