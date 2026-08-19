import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { addPublicSpendingEstimates, buildPublicSpendingChartData, parsePublicSpendingWorkbook } from '../lib/public-spending-source';

function workbookBuffer(total: number, debtService: number, preliminary = false): Uint8Array {
    const rows = [
        [],
        [],
        [],
        [null, 'FINALIDAD / FUNCION', 2023, preliminary ? '2024*' : 2024],
        [],
        ['1.0', 'GASTO PÚBLICO TOTAL', total - 1, total],
        ['1.4', 'IV. SERVICIOS DE LA DEUDA PÚBLICA', debtService - 0.5, debtService],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '% del PIB');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
}

describe('public spending official source', () => {
    it('parses totals, debt service and preliminary years', () => {
        const series = parsePublicSpendingWorkbook(workbookBuffer(35.6, 1.9, true));

        expect(series.get(2023)).toEqual({ total: 34.6, debtService: 1.4, preliminary: false });
        expect(series.get(2024)).toEqual({ total: 35.6, debtService: 1.9, preliminary: true });
    });

    it('builds primary spending by government level and keeps the official total', () => {
        const consolidated = parsePublicSpendingWorkbook(workbookBuffer(35.6, 1.9, true));
        const nation = parsePublicSpendingWorkbook(workbookBuffer(18.1, 1.6));
        const provinces = parsePublicSpendingWorkbook(workbookBuffer(14.5, 0.3, true));
        const municipalities = parsePublicSpendingWorkbook(workbookBuffer(3, 0));

        const row = buildPublicSpendingChartData(consolidated, nation, provinces, municipalities).at(-1);

        expect(row).toMatchObject({
            fecha: '2024',
            nation: 16.5,
            provinces: 14.2,
            municipalities: 3,
            interest: 1.9,
            total: 35.6,
            preliminary: true,
        });
    });

    it('adds a separately keyed 2025 estimate', () => {
        const data = addPublicSpendingEstimates([{ fecha: '2024', iso_fecha: '2024-01-01', total: 35.6 }]);

        expect(data[0]).toMatchObject({ fecha: '2024', totalEstimate: 35.6 });
        expect(data[1]).toMatchObject({ fecha: '2025', nationEstimate: 15, provincesEstimate: 15, municipalitiesEstimate: 3, interestEstimate: 1, totalEstimate: 34, estimate: true });
        expect(data).toHaveLength(2);
    });
});
