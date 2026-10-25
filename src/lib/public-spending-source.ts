import * as XLSX from 'xlsx';
import type { ChartDataRow } from '@/types';
import { extractFileLinks, readWorkbook } from './protocols';
import { fetchBufferFromUrl, fetchTextFromUrl } from './sync/http-client';
import { PRESUPUESTO_PBI_BY_YEAR } from './presupuesto-source';

const PUBLIC_SPENDING_URLS = {
    consolidated: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fconsolidado%5Fdesde%5F1980%5F2.xls',
    nation: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fnacional%5Fdesde%5F1980%5F2.xls',
    provinces: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fprovincial%5Fdesde%5F1980%5F2.xls',
    municipalities: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fmunicipal%5Fdesde%5F1980%5F1.xls',
} as const;

const NATIONAL_TOTALS_URL = 'https://dgsiaf-repo.mecon.gob.ar/repository/pa/datasets/totales-de-presupuesto.zip';
const ARGENTINA_GOB_ORIGIN = 'https://www.argentina.gob.ar';
const PROVINCIAL_EXECUTIONS_PAGE_URL = `${ARGENTINA_GOB_ORIGIN}/economia/sechacienda/coordinacion-fiscal-provincial/ejecucion-presupuestaria-provincial/ejecuciones`;
const QUARTER_NUMERALS = ['i', 'ii', 'iii', 'iv'];

const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type PublicSpendingYear = {
    total: number;
    debtService: number;
    preliminary: boolean;
};

export type PublicSpendingSeries = Map<number, PublicSpendingYear>;

export type NationalTotalsYear = {
    total: number;
    primary: number;
    interest: number;
    updatedAt: Date;
};

export type ProvincialExecution = {
    primary: number;
    interest: number;
    /** Accumulated quarters covered by the execution (1-4). */
    quarters: number;
};

function numericValue(value: unknown): number | null {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function parseLocalNumber(value: string | undefined): number | null {
    if (value == null) return null;
    return numericValue(value.replace(/\./g, '').replace(',', '.'));
}

function parseSpanishDate(value: string | undefined): Date | null {
    if (!value) return null;
    const match = value.match(/(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})/i);
    if (!match) return null;
    const month = SPANISH_MONTHS.indexOf(match[2].toLowerCase());
    if (month < 0) return null;
    return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

export function parsePublicSpendingWorkbook(buffer: ArrayBuffer | Uint8Array): PublicSpendingSeries {
    const workbook = readWorkbook(buffer);
    const sheet = workbook.Sheets['% del PIB'];
    if (!sheet) throw new Error('Failed to parse public spending workbook. Missing "% del PIB" sheet.');

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    const headers = rows[3] ?? [];
    const totalRow = rows.find(row => row[0] === '1.0');
    const debtServiceRow = rows.find(row => row[0] === '1.4');
    if (!totalRow || !debtServiceRow) throw new Error('Failed to parse public spending workbook. Missing total or debt service row.');

    const series: PublicSpendingSeries = new Map();
    for (let column = 2; column < headers.length; column += 1) {
        const header = String(headers[column]);
        const match = header.match(/^(\d{4})(\*)?$/);
        const total = numericValue(totalRow[column]);
        const debtService = numericValue(debtServiceRow[column]);
        if (!match || total == null || debtService == null) continue;
        series.set(Number(match[1]), { total, debtService, preliminary: match[2] === '*' });
    }

    if (series.size === 0) throw new Error('Failed to parse public spending workbook. No annual observations found.');
    return series;
}

export function parsePublicSpendingAbsoluteWorkbook(
    buffer: ArrayBuffer | Uint8Array,
    year: number,
): { total: number; debtService: number } {
    const workbook = readWorkbook(buffer);
    const sheet = workbook.Sheets['$ corrientes'];
    if (!sheet) throw new Error('Failed to parse public spending workbook. Missing "$ corrientes" sheet.');

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    const headers = rows[3] ?? [];
    const column = headers.findIndex(header => String(header) === String(year));
    const totalRow = rows.find(row => row[0] === '1.0');
    const debtServiceRow = rows.find(row => row[0] === '1.4');
    const total = numericValue(totalRow?.[column]);
    const debtService = numericValue(debtServiceRow?.[column]);
    if (column < 0 || total == null || debtService == null) {
        throw new Error(`Failed to parse public spending workbook. Missing absolute values for ${year}.`);
    }
    return { total, debtService };
}

export function parseNationalTotalsZip(buffer: ArrayBuffer | Uint8Array): Map<number, NationalTotalsYear> {
    // xlsx bundles the CFB container reader (which also reads ZIP) but types it as any.
    const entries: Array<{ name: string; content?: Uint8Array }> = XLSX.CFB.read(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), { type: 'buffer' }).FileIndex;
    const entry = entries.find(file => file.name.toLowerCase().endsWith('.csv'));
    if (!entry?.content) throw new Error('Failed to read national totals ZIP. No .csv entry found.');

    const csv = new TextDecoder('utf-8').decode(entry.content);
    const workbook = XLSX.read(csv, { type: 'string', raw: true });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: '' });

    const series = new Map<number, NationalTotalsYear>();
    for (const row of rows) {
        const year = Number(row.ejercicio_presupuestario);
        const total = parseLocalNumber(row.credito_devengado);
        const primary = parseLocalNumber(row.gasto_primario_devengado);
        const updatedAt = parseSpanishDate(row.ultima_actualizacion_fecha);
        if (!Number.isInteger(year) || total == null || primary == null || !updatedAt) continue;
        series.set(year, { total, primary, interest: total - primary, updatedAt });
    }

    if (series.size === 0) throw new Error('Failed to parse national totals CSV. No annual observations found.');
    return series;
}

/** Provincial APNF execution files for a year, latest accumulated quarter first. */
export function provincialExecutionLinks(html: string, year: number): string[] {
    const pattern = new RegExp(`ejecuciones_presupuestarias_apnf_${year}_-_trim\\.?_(iv|i{1,3})(?![a-z])`, 'i');
    return extractFileLinks(html, { origin: ARGENTINA_GOB_ORIGIN, extensions: ['xls', 'xlsx'] })
        .map(link => ({ href: link.href, quarter: QUARTER_NUMERALS.indexOf(link.href.match(pattern)?.[1].toLowerCase() ?? '') + 1 }))
        .filter(link => link.quarter > 0)
        .sort((a, b) => b.quarter - a.quarter)
        .map(link => link.href);
}

/** Years after the official annual series that DGSIAF already executes: all but the latest are closed (estimate), the latest is partial. */
export function executionYears(nationalTotals: Map<number, NationalTotalsYear>, lastAnnualYear: number): number[] {
    return [...nationalTotals.keys()].filter(year => year > lastAnnualYear).sort((a, b) => a - b);
}

export function parseProvincialExecutionWorkbook(buffer: ArrayBuffer | Uint8Array): ProvincialExecution {
    const workbook = readWorkbook(buffer);
    const sheetName = workbook.SheetNames.find(name => /\bTRIM\b/i.test(name));
    const quarters = QUARTER_NUMERALS.indexOf(sheetName?.match(/\b(IV|I{1,3})\s+TRIM/i)?.[1].toLowerCase() ?? '') + 1;
    if (!sheetName || quarters === 0) throw new Error('Failed to parse provincial execution workbook. Missing quarterly TRIM sheet.');
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    const headerRow = rows.find(row => row.some(cell => String(cell).trim() === 'Total'));
    const totalColumn = headerRow?.findIndex(cell => String(cell).trim() === 'Total') ?? -1;
    const primaryRow = rows.find(row => String(row[0]).toLowerCase().includes('gastos primarios'));
    const interestRow = rows.filter(row => {
        const label = String(row[0]).toLowerCase();
        return label.includes('rentas de la propiedad') && !label.includes('gastos primarios');
    }).at(-1);
    const primary = numericValue(primaryRow?.[totalColumn]);
    const interest = numericValue(interestRow?.[totalColumn]);
    if (totalColumn < 0 || primary == null || interest == null) {
        throw new Error('Failed to parse provincial execution workbook. Missing primary spending or property income totals.');
    }
    return { primary, interest, quarters };
}

export function buildPublicSpendingChartData(
    consolidated: PublicSpendingSeries,
    nation: PublicSpendingSeries,
    provinces: PublicSpendingSeries,
    municipalities: PublicSpendingSeries,
): ChartDataRow[] {
    return [...consolidated.entries()].flatMap(([year, consolidatedRow]) => {
        const nationRow = nation.get(year);
        const provincesRow = provinces.get(year);
        const municipalitiesRow = municipalities.get(year);
        if (!nationRow || !provincesRow || !municipalitiesRow) return [];

        return [{
            fecha: String(year),
            iso_fecha: `${year}-01-01`,
            nation: nationRow.total - nationRow.debtService,
            provinces: provincesRow.total - provincesRow.debtService,
            municipalities: municipalitiesRow.total - municipalitiesRow.debtService,
            interest: consolidatedRow.debtService,
            total: consolidatedRow.total,
            preliminary: consolidatedRow.preliminary || nationRow.preliminary || provincesRow.preliminary || municipalitiesRow.preliminary,
        }];
    });
}

type ExecutionRowInputs = {
    year: number;
    /** 'estimate': closed year awaiting MECON's consolidated figure; 'partial': current year accumulated to the cut. */
    kind: 'estimate' | 'partial';
    /** Latest year present in both the official series and DGSIAF totals; bridges their scopes. */
    bridgeYear: number;
    nationalTotals: Map<number, NationalTotalsYear>;
    provincial: ProvincialExecution;
    nationalBridge: { total: number; debtService: number };
    provincesBridge: PublicSpendingYear;
    municipalitiesBridge: PublicSpendingYear;
    pbi: number;
};

/**
 * Spending accumulated to the execution cut over the year's GDP, never annualized.
 * Nation: DGSIAF primary spending times the bridge-year level ratio official/DGSIAF (scope correction, not time scaling).
 * Municipalities have no execution data: they keep their bridge-year ratio to provincial primary spending.
 */
export function buildPublicSpendingExecutionRow({ year, kind, bridgeYear, nationalTotals, provincial, nationalBridge, provincesBridge, municipalitiesBridge, pbi }: ExecutionRowInputs): ChartDataRow {
    const national = nationalTotals.get(year);
    const nationalBridgeTotals = nationalTotals.get(bridgeYear);
    if (!national || !nationalBridgeTotals) {
        throw new Error(`Failed to build ${year} public spending row. Missing national totals for ${year} or ${bridgeYear}.`);
    }
    if (kind === 'estimate' && provincial.quarters < 4) {
        throw new Error(`Failed to build ${year} public spending estimate. Provincial execution only covers ${provincial.quarters} of 4 quarters.`);
    }

    const scopeBridge = (nationalBridge.total - nationalBridge.debtService) / nationalBridgeTotals.primary;
    const nation = national.primary * scopeBridge / pbi * 100;
    const provinces = provincial.primary / pbi * 100;
    const municipalRatio = provinces / (provincesBridge.total - provincesBridge.debtService);
    const municipalities = (municipalitiesBridge.total - municipalitiesBridge.debtService) * municipalRatio;
    const subnationalInterest = provincial.interest / pbi * 100 + municipalitiesBridge.debtService * municipalRatio;
    const interest = national.interest / pbi * 100 + subnationalInterest;
    const suffix = kind === 'partial' ? 'Partial' : 'Estimate';
    const values = { [`nation${suffix}`]: nation, [`provinces${suffix}`]: provinces, [`municipalities${suffix}`]: municipalities, [`interest${suffix}`]: interest, [`total${suffix}`]: nation + provinces + municipalities + interest };

    return kind === 'partial'
        ? { fecha: String(year), iso_fecha: `${year}-01-01`, ...values, partial: true, partialAsOf: national.updatedAt.toISOString().slice(0, 10), partialQuarters: provincial.quarters, partialBridgeYear: bridgeYear, partialInterestSubnational: subnationalInterest }
        : { fecha: String(year), iso_fecha: `${year}-01-01`, ...values, estimate: true };
}

/** Execution years are best effort, one by one: a year whose sources fail is warned about and left out, never invented. */
export async function appendExecutionRowsOrWarn(
    annual: ChartDataRow[],
    years: number[],
    loadRow: (year: number) => Promise<ChartDataRow>,
    warn: (message: string) => void = console.warn,
): Promise<ChartDataRow[]> {
    const rows = [...annual];
    for (const year of years) {
        try {
            rows.push(await loadRow(year));
        } catch (error) {
            warn(`[public-spending] ${year} omitted: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return rows;
}

async function fetchWorkbook(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch public spending workbook ${url}. HTTP ${response.status}.`);
    return response.arrayBuffer();
}

async function fetchProvincialExecution(year: number): Promise<ProvincialExecution> {
    const links = provincialExecutionLinks(await fetchTextFromUrl(PROVINCIAL_EXECUTIONS_PAGE_URL), year);
    const failures: string[] = [];
    for (const link of links) {
        try {
            return parseProvincialExecutionWorkbook(await fetchBufferFromUrl(link, { expectedContentType: /excel|spreadsheet|octet-stream/i }));
        } catch (error) {
            failures.push(`${link}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(`No usable provincial execution for ${year} on ${PROVINCIAL_EXECUTIONS_PAGE_URL}. ${failures.join('; ')}`);
}

async function loadExecutionRows(annual: ChartDataRow[], nationBuffer: ArrayBuffer, nation: PublicSpendingSeries, provinces: PublicSpendingSeries, municipalities: PublicSpendingSeries): Promise<ChartDataRow[]> {
    const nationalTotals = parseNationalTotalsZip(await fetchBufferFromUrl(NATIONAL_TOTALS_URL, { expectedContentType: /zip|octet-stream/i }));
    const years = executionYears(nationalTotals, Number(annual.at(-1)?.fecha));
    const latest = years.at(-1);
    const bridgeYear = Math.max(...[...nation.keys()].filter(candidate => nationalTotals.has(candidate) && provinces.has(candidate) && municipalities.has(candidate)));
    const provincesBridge = provinces.get(bridgeYear);
    const municipalitiesBridge = municipalities.get(bridgeYear);
    if (!provincesBridge || !municipalitiesBridge) throw new Error(`Missing ${bridgeYear} bridge-year provincial or municipal data.`);
    const nationalBridge = parsePublicSpendingAbsoluteWorkbook(nationBuffer, bridgeYear);

    return appendExecutionRowsOrWarn(annual, years, async year => {
        const pbi = PRESUPUESTO_PBI_BY_YEAR.get(year);
        if (pbi == null) throw new Error(`Missing ${year} GDP.`);
        return buildPublicSpendingExecutionRow({
            year,
            kind: year === latest ? 'partial' : 'estimate',
            bridgeYear,
            nationalTotals,
            provincial: await fetchProvincialExecution(year),
            nationalBridge,
            provincesBridge,
            municipalitiesBridge,
            pbi,
        });
    });
}

/** Official annual series plus the execution years after it (closed estimates and the current partial), fetched live from MECON; the sync stores it in Neon. */
export async function fetchPublicSpendingChartRows(): Promise<ChartDataRow[]> {
    const [consolidatedBuffer, nationBuffer, provincesBuffer, municipalitiesBuffer] = await Promise.all(
        Object.values(PUBLIC_SPENDING_URLS).map(fetchWorkbook),
    );
    const [consolidated, nation, provinces, municipalities] = [
        consolidatedBuffer,
        nationBuffer,
        provincesBuffer,
        municipalitiesBuffer,
    ].map(parsePublicSpendingWorkbook);
    const annual = buildPublicSpendingChartData(consolidated, nation, provinces, municipalities);
    try {
        return await loadExecutionRows(annual, nationBuffer, nation, provinces, municipalities);
    } catch (error) {
        console.warn(`[public-spending] execution years omitted: ${error instanceof Error ? error.message : String(error)}`);
        return annual;
    }
}
