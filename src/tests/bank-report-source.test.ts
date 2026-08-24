import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseBankReportAnnexUrl, parseBankReportMorosidadWorkbook, parseLatestBankReportPageUrl } from '../lib/bank-report-source';

describe('BCRA bank report source', () => {
    it('finds the latest report and its annex', () => {
        const pageUrl = parseLatestBankReportPageUrl(JSON.stringify({
            success: true,
            data: { publicaciones: [{ titulo: 'Informe sobre Bancos', url: 'https://www.bcra.gob.ar/publicaciones/informe-sobre-bancos-junio-de-2026/' }] },
        }));
        const annexUrl = parseBankReportAnnexUrl(`
            <a href="/archivos/serie.xlsx">Serie de datos</a>
            <a href="/archivos/informe-bancos-anexo-2026-06.xlsx">Anexo (XLSX)</a>
        `, pageUrl);

        expect(pageUrl).toContain('junio-de-2026');
        expect(annexUrl).toBe('https://www.bcra.gob.ar/archivos/informe-bancos-anexo-2026-06.xlsx');
    });

    it('parses system-wide private portfolio irregularity ratios', () => {
        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([
            [],
            [],
            ['Sistema financiero'],
            [],
            [null, 46113, 46143, 46174],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            ['6.- Irregularidad de cartera privada', 7.2973284544, 7.7002017407, 7.6306476839],
        ]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Indicadores');
        const debtorSectorSheet = XLSX.utils.aoa_to_sheet([
            ['2. Familias - Total'],
            [null, 46113, 46143, 46174],
            ['Cartera irregular total', 12.1, 12.8, 12.8],
            [],
            ['3. Empresas - Total'],
            [null, 46113, 46143, 46174],
            ['Cartera irregular total', 3.3, 3.5, 3.5],
        ]);
        XLSX.utils.book_append_sheet(workbook, debtorSectorSheet, 'Calidad de Cartera (por líneas)');

        const rows = parseBankReportMorosidadWorkbook(Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })));

        expect(rows).toEqual([
            { fecha: '2026-04-01', mora_irregular_total_pct: 7.2973284544, mora_familias_pct: 12.1, mora_empresas_pct: 3.3 },
            { fecha: '2026-05-01', mora_irregular_total_pct: 7.7002017407, mora_familias_pct: 12.8, mora_empresas_pct: 3.5 },
            { fecha: '2026-06-01', mora_irregular_total_pct: 7.6306476839, mora_familias_pct: 12.8, mora_empresas_pct: 3.5 },
        ]);
    });
});
