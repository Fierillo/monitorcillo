import { deflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    appendExecutionRowsOrWarn,
    buildPublicSpendingChartData,
    buildPublicSpendingExecutionRow,
    executionYears,
    parseNationalTotalsZip,
    parseProvincialExecutionWorkbook,
    provincialExecutionLinks,
    parsePublicSpendingAbsoluteWorkbook,
    parsePublicSpendingWorkbook,
} from '../lib/public-spending-source';

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

function absoluteWorkbookBuffer(total: number, debtService: number): Uint8Array {
    const rows = [
        [],
        [],
        [],
        [null, 'FINALIDAD / FUNCION', 2023, 2024],
        [],
        ['1.0', 'GASTO PÚBLICO TOTAL', total - 1, total],
        ['1.4', 'IV. SERVICIOS DE LA DEUDA PÚBLICA', debtService - 0.5, debtService],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '$ corrientes');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
}

function nationalTotalsCsv(): Uint8Array {
    return new TextEncoder().encode([
        'ejercicio_presupuestario,credito_presupuestado,credito_vigente,credito_devengado,recurso_inicial,recurso_vigente,recurso_ingresado_percibido,gasto_primario_presupuestado,gasto_primario_vigente,gasto_primario_devengado,ultima_actualizacion_fecha',
        '2024,"0","0","89.667.784,7","0","0","0","0","0","80.334.720,5","Última actualización del ejercicio 2024: 01 Julio 2025."',
        '2025,"0","0","100.000.000,0","0","0","0","0","0","90.000.000,0","Última actualización del ejercicio 2025: 15 Marzo 2026."',
        '2026,"0","0","118.356.616,3","0","0","0","0","0","105.496.432,1","Última actualización del ejercicio 2026: 21 Octubre 2026."',
    ].join('\n'));
}

function provincialWorkbookBuffer(primary: number, interest: number, sheetName = 'II TRIM PARA PUBLICAR'): Uint8Array {
    const rows = [
        [], [], [], [],
        [],
        [],
        [],
        [],
        ['Concepto', 'CABA', 'Total'],
        [],
        [' I. Ingresos Corrientes', 0, 0],
        ['   . Rentas de la Propiedad', interest / 2, interest / 2],
        [],
        [' VII. Gastos Totales (II+V)', 0, primary + interest],
        [' VIII. Gastos Primarios (VII - Rentas de la Propiedad)', 0, primary],
        ['    . Rentas de la Propiedad', 0, interest],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
}

function zipBuffer(name: string, content: string): Uint8Array {
    const nameBytes = new TextEncoder().encode(name);
    const contentBytes = new TextEncoder().encode(content);
    const compressed = deflateRawSync(contentBytes);
    const local = new Uint8Array(30 + nameBytes.length + compressed.length + 16);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 8, true);
    localView.setUint16(8, 8, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    const descriptorOffset = 30 + nameBytes.length + compressed.length;
    localView.setUint32(descriptorOffset, 0x08074b50, true);
    localView.setUint32(descriptorOffset + 8, compressed.length, true);
    localView.setUint32(descriptorOffset + 12, contentBytes.length, true);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 8, true);
    centralView.setUint16(10, 8, true);
    centralView.setUint32(20, compressed.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    central.set(nameBytes, 46);

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(8, 1, true);
    eocdView.setUint16(10, 1, true);
    eocdView.setUint32(12, central.length, true);
    eocdView.setUint32(16, local.length, true);

    const result = new Uint8Array(local.length + central.length + eocd.length);
    result.set(local, 0);
    result.set(central, local.length);
    result.set(eocd, local.length + central.length);
    return result;
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

    it('reads national totals from a ZIP with a data descriptor', () => {
        const csv = new TextDecoder().decode(nationalTotalsCsv());

        expect(parseNationalTotalsZip(zipBuffer('totales-de-presupuesto.csv', csv)).get(2026)).toMatchObject({ primary: 105496432.1 });
    });

    it('parses absolute values for the 2024 scope bridge', () => {
        expect(parsePublicSpendingAbsoluteWorkbook(absoluteWorkbookBuffer(105.8, 9.4), 2024)).toEqual({ total: 105.8, debtService: 9.4 });
    });

    it('parses national execution totals and the update date', () => {
        const totals = parseNationalTotalsZip(zipBuffer('totales.csv', new TextDecoder().decode(nationalTotalsCsv())));

        expect(totals.get(2024)).toMatchObject({ total: 89667784.7, primary: 80334720.5 });
        expect(totals.get(2026)).toMatchObject({ total: 118356616.3, primary: 105496432.1 });
        expect(totals.get(2026)?.interest).toBeCloseTo(12860184.2, 1);
        expect(totals.get(2026)?.updatedAt.toISOString()).toBe('2026-10-21T00:00:00.000Z');
    });

    it('parses provincial primary spending and property income from the expense section', () => {
        expect(parseProvincialExecutionWorkbook(provincialWorkbookBuffer(76891832.9, 1507190.8))).toEqual({
            primary: 76891832.9,
            interest: 1507190.8,
            quarters: 2,
        });
    });

    it('detects the accumulated quarter from any TRIM sheet name', () => {
        expect(parseProvincialExecutionWorkbook(provincialWorkbookBuffer(10, 1, 'III TRIM')).quarters).toBe(3);
        expect(parseProvincialExecutionWorkbook(provincialWorkbookBuffer(10, 1, 'I TRIM PUBLICAR')).quarters).toBe(1);
    });

    it('lists provincial APNF execution files of a year, latest quarter first', () => {
        const html = [
            '<a href="/sites/default/files/ejecuciones_presupuestarias_apnf_2026_-_trim._i.xls">I</a>',
            '<a href="/sites/default/files/ejecuciones_presupuestarias_apnf_2026_-_trim_ii_0.xls">II</a>',
            '<a href="https://www.argentina.gob.ar/sites/default/files/ejecuciones_presupuestarias_apnf_2025_-_trim_iv.xls">IV</a>',
            '<a href="/sites/default/files/serie_aif-apnf-2025.xlsx">serie</a>',
        ].join('');

        expect(provincialExecutionLinks(html, 2026)).toEqual([
            'https://www.argentina.gob.ar/sites/default/files/ejecuciones_presupuestarias_apnf_2026_-_trim_ii_0.xls',
            'https://www.argentina.gob.ar/sites/default/files/ejecuciones_presupuestarias_apnf_2026_-_trim._i.xls',
        ]);
        expect(provincialExecutionLinks(html, 2027)).toEqual([]);
    });

    it('lists the years after the official series that DGSIAF already executes', () => {
        const totals = parseNationalTotalsZip(zipBuffer('t.csv', new TextDecoder().decode(nationalTotalsCsv())));

        expect(executionYears(totals, 2023)).toEqual([2024, 2025, 2026]);
        expect(executionYears(totals, 2024)).toEqual([2025, 2026]);
        expect(executionYears(totals, 2026)).toEqual([]);
    });

    it('keeps the other years and warns, inventing nothing, when one year sources fail', async () => {
        const annual = [{ fecha: '2024', iso_fecha: '2024-01-01', total: 35.6 }];
        const warnings: string[] = [];

        const data = await appendExecutionRowsOrWarn(annual, [2025, 2026], async year => {
            if (year === 2025) throw new Error('provincial Q4 missing');
            return { fecha: '2026', iso_fecha: '2026-01-01', totalPartial: 22.7, partial: true };
        }, message => warnings.push(message));

        expect(data.map(row => row.fecha)).toEqual(['2024', '2026']);
        expect(warnings.join(' ')).toContain('2025');
        expect(warnings.join(' ')).toContain('provincial Q4 missing');
    });

    const executionInputs = () => ({
        bridgeYear: 2024,
        nationalTotals: parseNationalTotalsZip(zipBuffer('t.csv', new TextDecoder().decode(nationalTotalsCsv()))),
        provincial: { primary: 76891832.9, interest: 1507190.8, quarters: 2 },
        nationalBridge: { total: 105781672.2, debtService: 9422796.7 },
        provincesBridge: { total: 14.5, debtService: 0.3, preliminary: true },
        municipalitiesBridge: { total: 2.986, debtService: 0.011, preliminary: true },
        pbi: 1_032_146_706,
    });

    it('builds the 2026 partial row accumulated to the cut, without annualizing', () => {
        const row = buildPublicSpendingExecutionRow({ ...executionInputs(), year: 2026, kind: 'partial' });

        expect(row).toMatchObject({ fecha: '2026', partial: true, partialAsOf: '2026-10-21', partialQuarters: 2, partialBridgeYear: 2024 });
        expect(row.nationPartial).toBeCloseTo(12.26, 2);
        expect(row.provincesPartial).toBeCloseTo(7.45, 2);
        expect(row.municipalitiesPartial).toBeCloseTo(1.561, 3);
        expect(row.interestPartial).toBeCloseTo(1.398, 3);
        expect(row.totalPartial).toBeCloseTo(22.668, 3);
        expect(row.partialInterestSubnational).toBeCloseTo(0.146 + 0.0058, 3);
    });

    it('builds a full-year estimate only from a fourth-quarter provincial execution', () => {
        const inputs = { ...executionInputs(), year: 2026, kind: 'estimate' as const };

        expect(() => buildPublicSpendingExecutionRow(inputs)).toThrow(/4/);
        const row = buildPublicSpendingExecutionRow({ ...inputs, provincial: { ...inputs.provincial, quarters: 4 } });
        expect(row).toMatchObject({ fecha: '2026', estimate: true });
        expect(row.totalEstimate).toBeCloseTo(22.668, 3);
        expect(row.partial).toBeUndefined();
    });
});
