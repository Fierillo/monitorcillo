import type { ChartDataRow } from '@/types';
import { unstable_cache } from 'next/cache';
import { extractFileLinks, readWorkbook, sheetRows } from './protocols';
import {
    PRESUPUESTO_EXPENSE_KEYS,
    PRESUPUESTO_RESOURCE_KEYS,
    PRESUPUESTO_RUBRO_KEYS,
    withNegativeExpenses,
    type PresupuestoRubroKey,
} from './presupuesto/schema';

export type PresupuestoYearRow = Record<PresupuestoRubroKey, number> & {
    preliminary: boolean;
    proyecto: boolean;
};

export type PresupuestoSeries = Map<number, PresupuestoYearRow>;

export type PresupuestoSerieAnualRow = {
    ingreso: number;
    gasto: number;
    pbi: number;
};

export type PresupuestoSerieAnual = Map<number, PresupuestoSerieAnualRow>;

const RUBRO_ALIASES: Record<string, PresupuestoRubroKey> = {
    tributarios: 'tributarios',
    aportes_ss: 'aportes_ss',
    'aportes y contribuciones ss': 'aportes_ss',
    'aportes y contribuciones a la seguridad social': 'aportes_ss',
    otros_ingresos: 'otros_ingresos',
    'otros ingresos corrientes': 'otros_ingresos',
    recursos_capital: 'recursos_capital',
    'recursos de capital': 'recursos_capital',
    prestaciones_ss: 'prestaciones_ss',
    'prestaciones de la ss': 'prestaciones_ss',
    'prestaciones de la seguridad social': 'prestaciones_ss',
    consumo_operacion: 'consumo_operacion',
    'consumo y operacion': 'consumo_operacion',
    'gastos de consumo y operacion': 'consumo_operacion',
    transferencias: 'transferencias',
    'transferencias corrientes': 'transferencias',
    intereses: 'intereses',
    gastos_capital: 'gastos_capital',
    'gastos de capital': 'gastos_capital',
};

export const PRESUPUESTO_LAW_SERIES: PresupuestoSeries = new Map([
    [2020, {
        tributarios: 2_746_484,
        aportes_ss: 1_330_424,
        otros_ingresos: 2_100_164,
        recursos_capital: 146_055,
        prestaciones_ss: 2_682_272,
        consumo_operacion: 817_396,
        transferencias: 2_880_166,
        intereses: 962_232,
        gastos_capital: 419_258,
        preliminary: false,
        proyecto: false,
    }],
    [2021, {
        tributarios: 4_681_814,
        aportes_ss: 2_044_419,
        otros_ingresos: 1_868_744,
        recursos_capital: 13_742,
        prestaciones_ss: 3_716_367,
        consumo_operacion: 1_332_045,
        transferencias: 3_883_388,
        intereses: 771_262,
        gastos_capital: 1_296_798,
        preliminary: false,
        proyecto: false,
    }],
    [2022, {
        tributarios: 8_558_438,
        aportes_ss: 3_672_470,
        otros_ingresos: 581_779,
        recursos_capital: 63_428,
        prestaciones_ss: 6_369_566,
        consumo_operacion: 2_279_787,
        transferencias: 6_420_776,
        intereses: 1_586_325,
        gastos_capital: 1_469_203,
        preliminary: false,
        proyecto: false,
    }],
    [2023, {
        tributarios: 17_268_020,
        aportes_ss: 8_295_265,
        otros_ingresos: 2_663_045,
        recursos_capital: 155_456,
        prestaciones_ss: 13_087_571,
        consumo_operacion: 5_602_573,
        transferencias: 14_214_607,
        intereses: 4_430_069,
        gastos_capital: 3_075_367,
        preliminary: false,
        proyecto: false,
    }],
    [2024, {
        tributarios: 58_459_188,
        aportes_ss: 25_297_497,
        otros_ingresos: 6_053_970,
        recursos_capital: 157_895,
        prestaciones_ss: 36_317_103,
        consumo_operacion: 14_109_785,
        transferencias: 31_504_322,
        intereses: 10_229_287,
        gastos_capital: 3_923_010,
        preliminary: true,
        proyecto: false,
    }],
    [2025, {
        tributarios: 73_767_309,
        aportes_ss: 40_720_625,
        otros_ingresos: 20_957_970,
        recursos_capital: 394_755,
        prestaciones_ss: 56_900_221,
        consumo_operacion: 17_875_924,
        transferencias: 38_731_319,
        intereses: 12_160_850,
        gastos_capital: 2_898_400,
        preliminary: true,
        proyecto: false,
    }],
    [2026, {
        tributarios: 90_308_958,
        aportes_ss: 47_652_940,
        otros_ingresos: 8_245_468,
        recursos_capital: 357_466,
        prestaciones_ss: 67_178_856,
        consumo_operacion: 20_179_300,
        transferencias: 43_368_172,
        intereses: 12_322_351,
        gastos_capital: 3_286_766,
        preliminary: false,
        proyecto: false,
    }],
    [2027, {
        tributarios: 122_592_339,
        aportes_ss: 62_336_428,
        otros_ingresos: 13_521_530,
        recursos_capital: 514_644,
        prestaciones_ss: 98_075_904,
        consumo_operacion: 28_354_431,
        transferencias: 53_347_675,
        intereses: 15_167_107,
        gastos_capital: 3_768_279,
        preliminary: false,
        proyecto: true,
    }],
]);

export const PRESUPUESTO_PBI_BY_YEAR = new Map([
    [2020, 42_380_207],
    [2021, 57_699_183],
    [2022, 86_300_992],
    [2023, 190_226_441],
    [2024, 603_000_000],
    [2025, 910_460_188],
    [2026, 1_032_146_706],
    [2027, 1_421_178_148],
]);

function normalizeText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function numericValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim().replace(/\s/g, '');
    const normalized = raw.includes(',') && raw.includes('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function emptyYearRow(preliminary: boolean): PresupuestoYearRow {
    return {
        tributarios: 0,
        aportes_ss: 0,
        otros_ingresos: 0,
        recursos_capital: 0,
        prestaciones_ss: 0,
        consumo_operacion: 0,
        transferencias: 0,
        intereses: 0,
        gastos_capital: 0,
        preliminary,
        proyecto: false,
    };
}

function isCompleteYear(row: PresupuestoYearRow): boolean {
    const hasResources = PRESUPUESTO_RESOURCE_KEYS.some(key => row[key] !== 0);
    const hasExpenses = PRESUPUESTO_EXPENSE_KEYS.some(key => row[key] !== 0);
    return hasResources && hasExpenses;
}

export function parsePresupuestoWorkbook(buffer: ArrayBuffer | Uint8Array): PresupuestoSeries {
    const workbook = readWorkbook(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheetRows(sheet);
    if (rows.length < 2) throw new Error('Failed to parse presupuesto workbook. Missing header or data rows.');

    const headers = rows[0].map(cell => normalizeText(cell));
    const yearIndex = headers.findIndex(header => header === 'ejercicio' || header === 'anio' || header === 'year');
    const rubroIndex = headers.findIndex(header => header === 'rubro' || header === 'concepto');
    const valueIndex = headers.findIndex(header => header === 'millones' || header === 'monto' || header === 'importe');
    if (yearIndex < 0 || rubroIndex < 0 || valueIndex < 0) {
        throw new Error('Failed to parse presupuesto workbook. Expected columns ejercicio, rubro and millones.');
    }

    const series: PresupuestoSeries = new Map();
    for (const row of rows.slice(1)) {
        const year = Number(row[yearIndex]);
        const rubro = RUBRO_ALIASES[normalizeText(row[rubroIndex])];
        const value = numericValue(row[valueIndex]);
        if (!Number.isInteger(year) || !rubro || value == null) continue;

        const current = series.get(year) ?? emptyYearRow(year === 2024 || year === 2025);
        current[rubro] = value;
        series.set(year, current);
    }

    for (const [year, row] of series) {
        if (!isCompleteYear(row)) series.delete(year);
    }

    if (series.size === 0) throw new Error('Failed to parse presupuesto workbook. No complete annual observations found.');
    return series;
}

function toPctPbi(value: number, pbi: number): number {
    return (value / pbi) * 100;
}

export function buildPresupuestoChartData(
    series: PresupuestoSeries,
    pbiByYear: Map<number, number>,
): ChartDataRow[] {
    return [...series.entries()]
        .sort(([left], [right]) => left - right)
        .flatMap(([year, yearRow]) => {
            const pbi = pbiByYear.get(year);
            if (!pbi || pbi <= 0) return [];

            const nominal = Object.fromEntries(
                PRESUPUESTO_RUBRO_KEYS.map(key => [key, yearRow[key]]),
            ) as Record<PresupuestoRubroKey, number>;
            const signed = withNegativeExpenses(
                Object.fromEntries(
                    PRESUPUESTO_RUBRO_KEYS.map(key => [key, toPctPbi(nominal[key], pbi)]),
                ),
            );
            const resultado = PRESUPUESTO_RUBRO_KEYS.reduce((sum, key) => sum + Number(signed[key] ?? 0), 0);

            return [{
                fecha: String(year),
                iso_fecha: `${year}-01-01`,
                ...signed,
                resultado,
                preliminary: yearRow.preliminary,
                proyecto: yearRow.proyecto,
            }];
        });
}

export function parsePresupuestoDatasetLinks(html: string, origin?: string): string[] {
    return extractFileLinks(html, { origin, extensions: ['xls', 'xlsx', 'csv'] })
        .filter(link => /presupuesto/i.test(link.href) || /presupuesto/i.test(link.label))
        .map(link => link.href);
}

function parseCsvLine(line: string): string[] {
    return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
}

export function parsePresupuestoSerieAnualCsv(csv: string): PresupuestoSerieAnual {
    const lines = csv.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('Failed to parse presupuesto serie anual CSV. Missing header or data rows.');

    const headers = parseCsvLine(lines[0]).map(header => normalizeText(header));
    const yearIndex = headers.findIndex(header => header.includes('ejercicio') || header === 'anio' || header === 'year');
    const ingresoIndex = headers.findIndex(header => header === 'ingreso' || header === 'recursos' || header === 'recurso');
    const gastoIndex = headers.findIndex(header => header === 'gasto' || header === 'gastos');
    const pbiIndex = headers.findIndex(header => header === 'pib' || header === 'pbi');
    if (yearIndex < 0 || ingresoIndex < 0 || gastoIndex < 0 || pbiIndex < 0) {
        throw new Error('Failed to parse presupuesto serie anual CSV. Expected columns ejercicio_presupuestario, ingreso, gasto and PIB.');
    }

    const series: PresupuestoSerieAnual = new Map();
    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const yearRaw = cells[yearIndex] ?? '';
        const yearMatch = yearRaw.match(/(\d{4})/);
        const year = yearMatch ? Number(yearMatch[1]) : Number(yearRaw);
        const ingreso = numericValue(cells[ingresoIndex]);
        const gasto = numericValue(cells[gastoIndex]);
        const pbi = numericValue(cells[pbiIndex]);
        if (!Number.isInteger(year) || ingreso == null || gasto == null || pbi == null || pbi <= 0) continue;
        series.set(year, { ingreso, gasto, pbi });
    }

    if (series.size === 0) throw new Error('Failed to parse presupuesto serie anual CSV. No annual observations found.');
    return series;
}

export function buildPresupuestoAgregadoChartData(series: PresupuestoSerieAnual): ChartDataRow[] {
    return [...series.entries()]
        .sort(([left], [right]) => left - right)
        .map(([year, row]) => {
            const ingreso = toPctPbi(row.ingreso, row.pbi);
            const gasto = -toPctPbi(row.gasto, row.pbi);
            return {
                fecha: String(year),
                iso_fecha: `${year}-01-01`,
                ingreso,
                gasto,
                resultado: ingreso + gasto,
                preliminary: year === 2024 || year === 2025,
            };
        });
}

const DATOS_GOB_SERIE_ANUAL_URLS = [
    'https://datos.gob.ar/dataset/sspre-presupuesto-administracion-publica-nacional/resource/sspre_195/download/serie-anual-gastos-recursos-y-pib.csv',
    'https://datos.gob.ar/sites/default/files/sspre_195.csv',
] as const;

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error(`Failed to fetch presupuesto serie anual from ${url}. HTTP ${response.status}.`);
    return response.text();
}

async function fetchPresupuestoSerieAnual(): Promise<PresupuestoSerieAnual | null> {
    for (const url of DATOS_GOB_SERIE_ANUAL_URLS) {
        try {
            return parsePresupuestoSerieAnualCsv(await fetchText(url));
        } catch {
            continue;
        }
    }
    return null;
}

export const fetchPresupuestoChartData = unstable_cache(
    async (): Promise<ChartDataRow[]> => {
        const serieAnual = await fetchPresupuestoSerieAnual();
        if (serieAnual) return buildPresupuestoAgregadoChartData(serieAnual);
        return buildPresupuestoAgregadoChartData(serieAnualFromLawSeries(PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR));
    },
    ['presupuesto-nacional-chart', 'v5-proyecto-2027'],
    { revalidate: 86400 },
);

export const fetchPresupuestoRubrosChartData = unstable_cache(
    async (): Promise<ChartDataRow[]> => buildPresupuestoChartData(PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR),
    ['presupuesto-nacional-rubros-chart', 'v5-proyecto-2027'],
    { revalidate: 86400 },
);

function serieAnualFromLawSeries(
    series: PresupuestoSeries,
    pbiByYear: Map<number, number>,
): PresupuestoSerieAnual {
    const result: PresupuestoSerieAnual = new Map();
    for (const [year, row] of series) {
        const pbi = pbiByYear.get(year);
        if (!pbi || pbi <= 0) continue;
        const ingreso = PRESUPUESTO_RESOURCE_KEYS.reduce((sum, key) => sum + row[key], 0);
        const gasto = PRESUPUESTO_EXPENSE_KEYS.reduce((sum, key) => sum + row[key], 0);
        result.set(year, { ingreso, gasto, pbi });
    }
    return result;
}
