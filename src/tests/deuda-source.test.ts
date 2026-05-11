import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseDebtPlacementsWorkbook, parseDeudaMonthlyLoanDisbursementsWorkbook, parseDeudaMonthlyStockWorkbook, parseDeudaPublicaWorkbook, parseInitialDebtStockWorkbook, parseLatestDeudaPublicaExcelUrl } from '../lib/deuda-source';

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

        const result = parseDeudaPublicaWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
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

    it('parses monthly debt stock from debt bulletin', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            [], [], [], [], [], [], [], [], [],
            [null, null, 'Jan-25', 'Feb-25'],
            [], [], [], [], [],
            [null, 'III - DEUDA BRUTA (I + II)', '450,000', '455,000'],
        ]), 'A.4');

        const result = parseDeudaMonthlyStockWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
        expect(result).toContainEqual({ fecha: '2025-01-01', stock_deuda_usd: 450000 });
        expect(result).toContainEqual({ fecha: '2025-02-01', stock_deuda_usd: 455000 });
    });
});
