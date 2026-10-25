import type { ChartDataRow, GastoKind, GastoNormalizedRow, GastoRawRow } from '@/types';
import { toNullableNumber } from './numbers';

const COMPONENTS = ['nation', 'provinces', 'municipalities', 'interest', 'total'] as const;
/** Chart key suffix of each stored kind: official and preliminary years share the plain keys. */
const SUFFIX: Record<GastoKind, string> = { official: '', preliminary: '', estimate: 'Estimate', partial: 'Partial' };

function kindOf(row: ChartDataRow): GastoKind {
    if (row.partial === true) return 'partial';
    if (row.estimate === true) return 'estimate';
    return row.preliminary === true ? 'preliminary' : 'official';
}

/** One raw row per year from the fetched chart rows; every key is present so each sync rewrites the year (see mergeRawSeries). */
export function toGastoRawRows(rows: ChartDataRow[]): GastoRawRow[] {
    return rows.map(row => {
        const kind = kindOf(row);
        const values = Object.fromEntries(COMPONENTS.map(key => [key, toNullableNumber(row[`${key}${SUFFIX[kind]}`] as number | null)]));
        return {
            fecha: `${row.fecha}-01-01`,
            ...values,
            kind,
            as_of: kind === 'partial' ? String(row.partialAsOf) : null,
            partial_quarters: kind === 'partial' ? Number(row.partialQuarters) : null,
            bridge_year: kind === 'partial' ? Number(row.partialBridgeYear) : null,
            interest_subnational: kind === 'partial' ? toNullableNumber(row.partialInterestSubnational as number | null) : null,
        } as GastoRawRow;
    });
}

export function normalizeGasto(rawData: GastoRawRow[]): GastoNormalizedRow[] {
    return rawData
        .filter(row => /^\d{4}-01-01$/.test(row.fecha) && toNullableNumber(row.total) !== null)
        .map(row => ({
            fecha: row.fecha.slice(0, 4),
            iso_fecha: row.fecha,
            ...Object.fromEntries(COMPONENTS.map(key => [key, toNullableNumber(row[key])])) as Record<typeof COMPONENTS[number], number | null>,
            kind: row.kind,
            as_of: row.kind === 'partial' ? row.as_of : null,
            partial_quarters: row.kind === 'partial' ? row.partial_quarters : null,
            bridge_year: row.kind === 'partial' ? row.bridge_year : null,
            interest_subnational: row.kind === 'partial' ? toNullableNumber(row.interest_subnational) : null,
        }))
        .sort((a, b) => a.iso_fecha.localeCompare(b.iso_fecha));
}

/** Last day of the last quarter reported (provincial APNF series). */
export function quarterEndIso(year: number, quarters: number): string {
    return new Date(Date.UTC(year, quarters * 3, 0)).toISOString().slice(0, 10);
}

const toDisplayDate = (iso: string) => iso.split('-').reverse().join('/');

/** Each part of the partial year has its own cut: Nación to as_of (DGSIAF), provinces to its quarter end (APNF). */
export function partialCuts(asOf: string, quarters: number): { nation: string; provinces: string } {
    return { nation: toDisplayDate(asOf), provinces: toDisplayDate(quarterEndIso(Number(asOf.slice(0, 4)), quarters)) };
}

function dayOfYear(iso: string): number {
    return (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(Number(iso.slice(0, 4)), 0, 1)) / 86_400_000 + 1;
}

function daysInYear(year: number): number {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

/**
 * Linear projection of a partial year, shown next to (never instead of) the accumulated value.
 * Nación by days elapsed to the cut, provinces and municipios (a ratio of provinces) by 4/quarters, interest by its parts.
 */
function annualized(row: GastoNormalizedRow): ChartDataRow {
    const { nation, provinces, municipalities, interest, total, as_of: asOf, partial_quarters: quarters, interest_subnational: subnational } = row;
    if (nation == null || provinces == null || municipalities == null || interest == null || total == null || !asOf || !quarters || subnational == null) return {};
    const byDays = daysInYear(Number(asOf.slice(0, 4))) / dayOfYear(asOf);
    const byQuarters = 4 / quarters;
    const values = {
        nationAnnualized: nation * byDays,
        provincesAnnualized: provinces * byQuarters,
        municipalitiesAnnualized: municipalities * byQuarters,
        interestAnnualized: (interest - subnational) * byDays + subnational * byQuarters,
    };
    const totalAnnualized = Object.values(values).reduce((sum, value) => sum + value, 0);
    return { ...values, totalAnnualized, annualizedGap: totalAnnualized - total };
}

function chartRow(row: GastoNormalizedRow): ChartDataRow {
    const suffix = SUFFIX[row.kind];
    const values = Object.fromEntries(COMPONENTS.map(key => [`${key}${suffix}`, row[key]]));
    if (row.kind === 'estimate') return { fecha: row.fecha, iso_fecha: row.iso_fecha, ...values, estimate: true };
    if (row.kind === 'partial') {
        return { fecha: row.fecha, iso_fecha: row.iso_fecha, ...values, partial: true, partialAsOf: row.as_of, partialQuarters: row.partial_quarters, partialBridgeYear: row.bridge_year, partialInterestSubnational: row.interest_subnational, ...annualized(row) };
    }
    return { fecha: row.fecha, iso_fecha: row.iso_fecha, ...values, preliminary: row.kind === 'preliminary' };
}

/** Chart rows for the detail view; the year before an estimate or partial bar also starts its dashed total line. */
export function publicSpendingChartRows(rows: GastoNormalizedRow[]): ChartDataRow[] {
    const chart = rows.map(chartRow);
    return chart.map((row, index) => {
        const next = chart[index + 1];
        if (next?.estimate === true) return { ...row, totalEstimate: row.total };
        if (next?.partial === true) {
            const connector = row.totalEstimate ?? row.total;
            return { ...row, totalPartial: connector, ...(next.totalAnnualized != null ? { totalAnnualized: connector } : {}) };
        }
        return row;
    });
}
