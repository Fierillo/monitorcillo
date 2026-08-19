import * as XLSX from 'xlsx';
import type { ChartDataRow } from '@/types';

const PUBLIC_SPENDING_URLS = {
    consolidated: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fconsolidado%5Fdesde%5F1980%5F2.xls',
    nation: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fnacional%5Fdesde%5F1980%5F2.xls',
    provinces: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fprovincial%5Fdesde%5F1980%5F2.xls',
    municipalities: 'https://www.argentina.gob.ar/sites/default/files/gasto%5Fpublico%5Fmunicipal%5Fdesde%5F1980%5F1.xls',
} as const;

type PublicSpendingYear = {
    total: number;
    debtService: number;
    preliminary: boolean;
};

export type PublicSpendingSeries = Map<number, PublicSpendingYear>;

function numericValue(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function parsePublicSpendingWorkbook(buffer: ArrayBuffer | Uint8Array): PublicSpendingSeries {
    const workbook = XLSX.read(buffer, { type: 'array' });
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

export function addPublicSpendingEstimates(data: ChartDataRow[]): ChartDataRow[] {
    return [
        ...data.map(row => row.fecha === '2024' ? { ...row, totalEstimate: row.total } : row),
        {
            fecha: '2025',
            iso_fecha: '2025-01-01',
            nationEstimate: 15,
            provincesEstimate: 15,
            municipalitiesEstimate: 3,
            interestEstimate: 1,
            totalEstimate: 34,
            estimate: true,
        },
    ];
}

async function fetchWorkbook(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error(`Failed to fetch public spending workbook ${url}. HTTP ${response.status}.`);
    return response.arrayBuffer();
}

export async function fetchPublicSpendingChartData(): Promise<ChartDataRow[]> {
    const [consolidated, nation, provinces, municipalities] = await Promise.all(
        Object.values(PUBLIC_SPENDING_URLS).map(async url => parsePublicSpendingWorkbook(await fetchWorkbook(url))),
    );
    return addPublicSpendingEstimates(buildPublicSpendingChartData(consolidated, nation, provinces, municipalities));
}
