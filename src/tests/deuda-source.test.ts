import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseDebtPlacementsWorkbook, parseDebtToGdpWorkbook, parseDeudaMaturitiesWorkbook, parseDeudaMonthlyLoanDisbursementsWorkbook, parseDeudaMonthlyPaymentsWorkbook, parseDeudaMonthlyStockWorkbook, parseDeudaPublicaWorkbook, parseInitialDebtStockWorkbook, parseLatestDeudaPublicaExcelUrl } from '../lib/deuda-source';

describe('deuda source', () => {
    it('finds the latest official quarterly debt Excel URL', () => {
        const html = '<a href="blank:#https://www.argentina.gob.ar/sites/default/files/deuda_publica_31-12-2025.xlsx">Excel</a>';
        expect(parseLatestDeudaPublicaExcelUrl(html)).toBe('https://www.argentina.gob.ar/sites/default/files/deuda_publica_31-12-2025.xlsx');
    });

    it('parses projected national capital and interest maturities', () => {
        const workbook = XLSX.utils.book_new();
        const capital2026 = Array.from({ length: 13 }, () => [] as unknown[]);
        const interest2026 = Array.from({ length: 13 }, () => [] as unknown[]);
        ['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'].forEach((header, index) => { capital2026[8][index + 2] = header; });
        capital2026[12][1] = 'TOTAL';
        capital2026[12][5] = '1';
        interest2026[12][1] = 'TOTAL';
        interest2026[12][5] = '2';
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(capital2026), 'A.3.2');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(interest2026), 'A.3.3');

        const capital2027 = Array.from({ length: 13 }, () => [] as unknown[]);
        const interest2027 = Array.from({ length: 13 }, () => [] as unknown[]);
        ['Jan-27', 'Feb-27', 'Mar-27', 'Apr-27', 'May-27', 'Jun-27'].forEach((header, index) => { capital2027[8][index + 2] = header; });
        capital2027[12][1] = 'TOTAL';
        capital2027[12][2] = '2';
        interest2027[12][1] = 'TOTAL';
        interest2027[12][2] = '3';
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(capital2027), 'A.3.4');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(interest2027), 'A.3.5');

        const annual = Array.from({ length: 13 }, () => [] as unknown[]);
        annual[9][2] = '2028';
        annual[12][1] = 'TOTAL';
        annual[12][2] = '12000';
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(annual), 'A.3.6');

        const result = parseDeudaPublicaWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), '2026-03-01');
        expect(result).toContainEqual({ fecha: '2026-04-01', vencimientos_proyectados: 3 });
        expect(result).toContainEqual({ fecha: '2027-01-01', vencimientos_proyectados: 5 });
        expect(result).toContainEqual({ fecha: '2028-01-01', vencimientos: 1 });
    });

    it('parses monthly debt placements from MECON workbooks', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            ['Title'],
            [],
            ['Nombre del Instrumento', 'Fecha de emisión', 'Vencimiento', 'Cupón', 'Amortización', 'Tipo Moneda (*)', 'Moneda de Origen', 'Fecha colocación/      liquidación', 'Valor Nominal', 'Valor Efectivo'],
            ['BONO', '1/1/25', '1/1/27', null, null, 'MONEDA NACIONAL', 'ARP', '1/17/25', '100', '250'],
            ['LETRA', '1/1/25', '1/1/27', null, null, 'MONEDA NACIONAL', 'ARP', '1/31/25', '100', '350'],
        ]), 'Bonos');

        const result = parseDebtPlacementsWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toContainEqual({ fecha: '2025-01-01', toma_deuda: 600 });
    });

    it('parses monthly international loan disbursements from debt bulletin', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [],
            [],
            [],
            [],
            [],
            ['FLUJOS Y VARIACIONES'],
            [],
            [],
            [],
            [null, null, 'Jan-25', 'Feb-25'],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [null, '1 - Financiamiento, canjes y emisiones'],
            [null, ' Préstamos Organismos Internacionales', '10', '20'],
            [null, 'FMI', '5', '15'],
        ]), 'A.4');

        const result = parseDeudaMonthlyLoanDisbursementsWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toContainEqual({ fecha: '2025-01-01', toma_deuda_usd: 10 });
        expect(result).toContainEqual({ fecha: '2025-02-01', toma_deuda_usd: 20 });
    });

    it('parses initial debt stock from 2016 debt workbook', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [],
            [null, 'II- TOTAL DEUDA PÚBLICA BRUTA (III + IV + V)', '275,446,129'],
        ]), 'A.1.1');

        const result = parseInitialDebtStockWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toEqual([{ fecha: '2017-01-01', stock_inicial_usd: 275446.129, stock_deuda_usd: 275446.129 }]);
    });

    it('parses the monthly gross debt stock from bulletin A.1 row A, including provisional months', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [], [], [], [], [], [], [], [],
            [null, null, 'Aug-26', 'sep-26 (*)', 'en %'],
            [null, 'A- DEUDA BRUTA ( I + II  + III)', '484,917', '486,627.5', '1'],
            [],
            [null, 'B- DEUDA BRUTA (EXCLUIDA LA ELEGIBLE PENDIENTE DE REESTRUCTURACIÓN) ( I + II )', '482,497', '484,229'],
        ]), 'A.1');

        const result = parseDeudaMonthlyStockWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toEqual([{ fecha: '2026-08-01', stock_deuda_usd: 484917 }, { fecha: '2026-09-01', stock_deuda_usd: 486627.5 }]);
    });

    it('splits monthly maturities into paid and projected at the report month and keeps every annual year', () => {
        const workbook = XLSX.utils.book_new();
        const monthly = (headers: string[], capital: string[], interest: string[]) => [
            Array.from({ length: 13 }, () => [] as unknown[]),
            Array.from({ length: 13 }, () => [] as unknown[]),
        ].map((rows, sheet) => {
            headers.forEach((header, index) => { rows[8][index + 2] = header; });
            rows[12][1] = 'TOTAL';
            (sheet === 0 ? capital : interest).forEach((value, index) => { rows[12][index + 2] = value; });
            return rows;
        });
        const [capital26, interest26] = monthly(['Jun-26', 'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26'], ['1', '2'], ['1', '1']);
        const [capital27, interest27] = monthly(['Jan-27', 'Feb-27', 'Mar-27', 'Apr-27', 'May-27', 'Jun-27'], ['4'], ['1']);
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(capital26), 'A.3.2');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(interest26), 'A.3.3');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(capital27), 'A.3.4');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(interest27), 'A.3.5');
        const annual = Array.from({ length: 13 }, () => [] as unknown[]);
        annual[9] = [null, 'TIPO DE ACREEDOR', '2026', '2027', '2036', '2037/2089'];
        annual[12] = [null, 'TOTAL', '1', '1', '24000', '99'];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(annual), 'A.3.6');

        const result = parseDeudaPublicaWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), '2026-06-01');
        expect(result).toContainEqual({ fecha: '2026-06-01', vencimientos: 2 });
        expect(result).toContainEqual({ fecha: '2026-07-01', vencimientos_proyectados: 3 });
        expect(result).toContainEqual({ fecha: '2027-01-01', vencimientos_proyectados: 5 });
        expect(result).toContainEqual({ fecha: '2036-12-01', vencimientos: 2 });
        expect(result.some(row => row.fecha.startsWith('2037'))).toBe(false);
    });

    it('parses bulletin payments for every published month', () => {
        const rows: unknown[][] = Array.from({ length: 14 }, () => []);
        rows[11] = [null, null, 'Mar-26', 'Apr-26', 'sep-26 (*)'];
        rows[13] = [null, 'TOTAL PAGADO POR TIPO DE INSTRUMENTO', '10', '20', '30'];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'A.5');

        const result = parseDeudaMonthlyPaymentsWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result.map(row => row.fecha)).toEqual(['2026-03-01', '2026-04-01', '2026-09-01']);
    });

    it('parses the official gross debt to GDP ratio by year and quarter from A.4.7', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [], [], [], [], [], [], [],
            [null, null, 'INDICADORES ', '2016', '2025 (1)', '1er. Trim. 2026 (1)', '2do. Trim. 2026 (1)'],
            [null, 'Como % del PIB(*)', 'Deuda Bruta de la Administración Central (Excluida la elegible pendiente de reestructuración)', '50.0%', '77.7%', '73.0%', '71.0%'],
            [null, null, 'Deuda Bruta de la Administración Central', '53.1%', '78.1%', '73.3%', '71.4%'],
        ]), 'A.4.7');

        const result = parseDebtToGdpWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toEqual([
            { fecha: '2016-12-01', deuda_pbi_oficial: 53.1 },
            { fecha: '2025-12-01', deuda_pbi_oficial: 78.1 },
            { fecha: '2026-03-01', deuda_pbi_oficial: 73.3 },
            { fecha: '2026-06-01', deuda_pbi_oficial: 71.4 },
        ]);
    });

    it('parses annual capital and interest maturities and the next 12 months in millions of USD', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [null, 'PERIODO PROYECTADO JULIO 2026 A JUNIO 2027'],
            [null, null, 'Julio', 'Subtotal 2026', 'Junio', 'Subtotal 2027', 'Total'],
            [null, ' TÍTULOS PÚBLICOS', '1', '1', '1', '1', '2'],
            [null, ' TOTAL', '13,752,050.6', '86,149,782.1', '14,896,209.4', '61,779,911.5', '147,929,693.6'],
            [null, '    CAPITAL', '1', '1', '1', '1', '137,211,791.4'],
            [null, '    INTERÉS', '1', '1', '1', '1', '10,717,902.3'],
        ]), 'A.3.1');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [null, 'TIPO DE ACREEDOR', '2026', '2027', '2036/2089', 'TOTAL'],
            [null, ' TÍTULOS PÚBLICOS', '9', '9', '9', '27'],
            [null, '    CAPITAL', '9', '9', '9', '27'],
            [null, ' TOTAL', '86,149,782.1', '100,566,847.2', '52,047,639.9', '1'],
            [null, '   Como % del total de servicios (2)', '0.2', '0.2', '0.1', '1'],
            [null, '    CAPITAL', '80,717,063.3', '90,128,255.8', '43,013,468.9', '1'],
            [null, '    INTERÉS', '5,432,718.8', '10,438,591.4', '9,034,171.1', '1'],
        ]), 'A.3.6');

        const result = parseDeudaMaturitiesWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result.anuales).toEqual([
            { periodo: '2026', capital_usd: expect.closeTo(80717.0633, 3), interes_usd: expect.closeTo(5432.7188, 3) },
            { periodo: '2027', capital_usd: expect.closeTo(90128.2558, 3), interes_usd: expect.closeTo(10438.5914, 3) },
            { periodo: '2036-2089', capital_usd: expect.closeTo(43013.4689, 3), interes_usd: expect.closeTo(9034.1711, 3) },
        ]);
        expect(result.proximos12m).toEqual({ capital_usd: expect.closeTo(137211.7914, 3), interes_usd: expect.closeTo(10717.9023, 3) });
    });
});
