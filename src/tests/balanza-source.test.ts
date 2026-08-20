import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { mergeLatestIcaReport, parseIcaPublicationDate, parseIcaWorkbookUrls, parseLatestIcaReport } from '../lib/balanza-source';

function workbook(rows: unknown[][], sheetName: string): Buffer {
    const result = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(result, XLSX.utils.aoa_to_sheet(rows), sheetName);
    return XLSX.write(result, { type: 'buffer', bookType: 'xls' }) as Buffer;
}

describe('ICA official source parsing', () => {
    it('parses the ICA report publication date from the INDEC page', () => {
        const html = '<div>21/08/26. Intercambio comercial argentino. Datos de julio de 2026</div>';

        expect(parseIcaPublicationDate(html)).toBe('2026-08-21');
    });

    it('finds the current breakdown workbooks', () => {
        const html = `
            <a href="/ftp/cuadros/economia/expo_grandes_rubros_2025_2026.xls">Exportaciones</a>
            <a href="https://www.indec.gob.ar/ftp/cuadros/economia/impo_uso_economico_2025_2026.xls">Importaciones</a>
        `;

        expect(parseIcaWorkbookUrls(html)).toEqual({
            exports: 'https://www.indec.gob.ar/ftp/cuadros/economia/expo_grandes_rubros_2025_2026.xls',
            imports: 'https://www.indec.gob.ar/ftp/cuadros/economia/impo_uso_economico_2025_2026.xls',
        });
    });

    it('parses and combines the latest official aggregate and breakdown values', () => {
        const shiftedWorkbook = (rows: unknown[][], sheetName: string) => workbook(rows.map(row => [null, ...row]), sheetName);
        const aggregate = shiftedWorkbook([
            ['Período', null, 'Exportaciones', null, null, null, null, 'Importaciones', null, null, null, 'Saldo'],
            ['2026*', 'Junio', '9,112', null, null, null, null, '6,877', null, null, null, '2,235'],
            [null, 'Julioe', '8,854', null, null, null, null, '6,739', null, null, null, '2,115'],
        ], 'FOB-CIF');
        const exports = shiftedWorkbook([
            [null, 'Exportaciones mensuales por grandes rubros. Enero-julio de 2026 y año 2025'],
            [null, null, 'Total', null, null, null, 'Productos primarios (PP)', null, null, null, 'Manufacturas de origen agropecuario (MOA)', null, null, null, 'Manufacturas de origen industrial (MOI)', null, null, null, 'Combustibles y energía (CyE)'],
            [null, null, 'Año 2026e', 'Año 2025*', null, null, 'Año 2026e', 'Año 2025*', null, null, 'Año 2026e', 'Año 2025*', null, null, 'Año 2026e', 'Año 2025*', null, null, 'Año 2026e'],
            [null, 'Jul', '8,854', null, null, null, '2,110', null, null, null, '3,068', null, null, null, '2,170', null, null, null, '1,506'],
            [null, 'Ago', null, '7,903', null, null, null, '2,019'],
        ], 'expo_gr');
        const imports = shiftedWorkbook([
            [null, 'Importaciones mensuales por usos económicos. Enero-julio de 2026 y año 2025'],
            [null, 'Período', 'Total', null, null, null, 'Bienes de capital (BK)', null, null, null, 'Bienes intermedios (BI)', null, null, null, 'Combustibles y lubricantes básicos y elaborados (CyL)', null, null, null, 'Piezas y accesorios para bienes de capital (PyA)', null, null, null, 'Bienes de consumo (BC)', null, null, null, 'Vehículos automotores de pasajeros (VA)', null, null, null, 'Resto'],
            [null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*', 'Año 2025*', null, null, 'Año 2026*'],
            [null, 'Jul', '6,739', null, null, null, '1,167', null, null, null, '2,426', null, null, null, '614', null, null, null, '1,083', null, null, null, '889', null, null, null, '448', null, null, null, '112'],
            [null, 'Ago', null, '6,463', null, null, null, '1,271'],
        ], 'impo_uso');

        expect(parseLatestIcaReport(aggregate, exports, imports)).toEqual([{
            fecha: '2026-07-01',
            exportaciones: 8854,
            importaciones: 6739,
            saldo: 2115,
            expo_pp: 2110,
            expo_moa: 3068,
            expo_moi: 2170,
            expo_combustibles: 1506,
            impo_bienes_capital: 1167,
            impo_bienes_intermedios: 2426,
            impo_combustibles: 614,
            impo_piezas: 1083,
            impo_bienes_consumo: 889,
            impo_vehiculos: 448,
            impo_resto: 112,
        }]);
    });

    it('gives the latest official row priority when merging', () => {
        expect(mergeLatestIcaReport(
            [{ fecha: '2026-06-01', exportaciones: 9112 }, { fecha: '2026-07-01', exportaciones: 8800 }],
            [{ fecha: '2026-07-01', exportaciones: 8854, saldo: 2115 }],
        )).toEqual([
            { fecha: '2026-06-01', exportaciones: 9112 },
            { fecha: '2026-07-01', exportaciones: 8854, saldo: 2115 },
        ]);
    });
});
