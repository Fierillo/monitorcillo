import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow, IndicatorType } from '@/types';
import { isoToFecha, isoToMonthLabel } from './normalize';

export const DEFAULT_CATALOG: CatalogIndicatorRow[] = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Mes anterior', dato: '-', fecha: 'Feb-26', fuente: 'BCRA e INDEC', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Día anterior', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Mismo mes año anterior', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'IPC mismo mes', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Mes anterior desest.', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
];

const decimalFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
});

const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatPbiPercentage = (value: number) => `${formatDecimal(value)}% del PBI real`;

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().split('T')[0];
}

function addMonths(date: string, months: number): string {
    const [year, month] = date.split('-').map(Number);
    const value = new Date(Date.UTC(year, month - 1 + months, 1));
    return value.toISOString().split('T')[0];
}

function addYears(date: string, years: number): string {
    const [year, month] = date.split('-').map(Number);
    return `${year + years}-${String(month).padStart(2, '0')}-01`;
}

export const CATALOG_INDICATOR_SPECS: Record<string, CatalogIndicatorSpec> = {
    bma: {
        type: 'bma',
        referenceLabel: 'Mes anterior',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.BMAmplia,
        datePrecision: 'day',
        normalizedValueColumn: 'bma_amplia',
        selectValue: row => row.BMAmplia,
        rawDateFields: ['base_monetaria', 'pases', 'leliq', 'lefi', 'otros', 'depositos_tesoro'],
        formatValue: formatPbiPercentage,
    },
    emision: {
        type: 'emision',
        referenceLabel: 'Día anterior',
        getReferenceDate: date => addDays(date, -1),
        selectReferenceValue: row => row.ACUMULADO,
        datePrecision: 'day',
        normalizedValueColumn: 'acumulado',
        selectValue: row => row.ACUMULADO,
        rawDateFields: ['compra_dolares', 'tc', 'bcra', 'vencimientos', 'licitado', 'resultado_fiscal'],
        formatValue: value => `$${integerFormatter.format(Math.round(value))}M`,
    },
    recaudacion: {
        type: 'reca',
        referenceLabel: 'Mismo mes año anterior',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.pctPbi,
        datePrecision: 'month',
        normalizedValueColumn: 'pct_pbi',
        selectValue: row => row.pctPbi,
        rawDateFields: ['recaudacion_total'],
        formatValue: formatPbiPercentage,
    },
    'poder-adquisitivo': {
        type: 'poder',
        referenceLabel: 'IPC mismo mes',
        referenceSource: 'raw',
        getReferenceDate: date => date,
        selectReferenceValue: row => row.ipc_nucleo,
        formatReferenceValue: formatDecimal,
        datePrecision: 'month',
        normalizedValueColumn: 'blanco',
        selectValue: row => row.blanco,
        rawDateFields: ['salario_registrado', 'salario_no_registrado', 'salario_privado', 'salario_publico', 'ripte', 'jubilacion_minima'],
        formatValue: formatDecimal,
    },
    emae: {
        type: 'emae',
        referenceLabel: 'Mes anterior desest.',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.emae_desestacionalizado,
        datePrecision: 'month',
        normalizedValueColumn: 'emae_desestacionalizado',
        selectValue: row => row.emae_desestacionalizado,
        rawDateFields: ['emae', 'emae_desestacionalizado', 'emae_tendencia'],
        formatValue: formatDecimal,
    },
};

function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function toIsoDate(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value !== 'string') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function rowDate(row: DataRow): string | null {
    return toIsoDate(row.iso_fecha ?? row.fecha);
}

function hasAnyValue(row: DataRow, fields: string[]): boolean {
    return fields.some(field => toFiniteNumber(row[field]) !== null);
}

function latestRow(rows: DataRow[], predicate: (row: DataRow) => boolean): DataRow | null {
    let latest: DataRow | null = null;
    let latestDate = '';

    for (const row of rows) {
        const date = rowDate(row);
        if (!date || !predicate(row) || date < latestDate) continue;
        latest = row;
        latestDate = date;
    }

    return latest;
}

function latestRawDate(rows: DataRow[], spec: CatalogIndicatorSpec): string | null {
    const row = latestRow(rows, candidate => {
        const date = rowDate(candidate);
        return !!date && hasAnyValue(candidate, spec.rawDateFields);
    });

    return row ? rowDate(row) : null;
}

function formatCatalogDate(date: string, precision: CatalogIndicatorSpec['datePrecision']): string {
    return precision === 'month' ? isoToMonthLabel(date) : isoToFecha(date);
}

function formatCatalogDisplayDate(date: string, spec: CatalogIndicatorSpec, publicationDate?: string | null): string {
    return publicationDate ? isoToFecha(publicationDate) : formatCatalogDate(date, spec.datePrecision);
}

function formatReferenceValue(spec: CatalogIndicatorSpec, referenceRow: DataRow | null): string {
    if (!referenceRow) return '-';

    const value = toFiniteNumber(spec.selectReferenceValue(referenceRow));
    if (value === null) return '-';

    return (spec.formatReferenceValue ?? spec.formatValue)(value);
}

function referenceRowForSpec(
    spec: CatalogIndicatorSpec,
    valueRow: DataRow,
    normalizedRows: DataRow[],
    rawRows: DataRow[],
): DataRow | null {
    const valueDate = rowDate(valueRow);
    if (!valueDate) return null;

    const referenceDate = spec.getReferenceDate(valueDate);
    const sourceRows = spec.referenceSource === 'raw' ? rawRows : normalizedRows;
    return sourceRows.find(row => rowDate(row) === referenceDate) ?? null;
}

export function buildIndicatorsCatalog(
    catalog: CatalogIndicatorRow[],
    normalizedData: Partial<Record<IndicatorType, DataRow[] | null | undefined>>,
    rawData: Partial<Record<IndicatorType, DataRow[] | null | undefined>> = {},
): CatalogIndicatorRow[] {
    return catalog.map(item => {
        const spec = CATALOG_INDICATOR_SPECS[item.id];
        if (!spec) return { ...item };

        const normalizedRows = normalizedData[spec.type] ?? [];
        const valueRow = latestRow(normalizedRows, row => toFiniteNumber(spec.selectValue(row)) !== null);
        if (!valueRow) return { ...item };

        const value = toFiniteNumber(spec.selectValue(valueRow));
        if (value === null) return { ...item };

        const referenceDate = rowDate(valueRow);
        const rawRows = rawData[spec.type] ?? [];
        const date = latestRawDate(rawRows, spec) ?? referenceDate;
        const referenceRow = referenceRowForSpec(spec, valueRow, normalizedRows, rawRows);

        return {
            ...item,
            referencia: formatReferenceValue(spec, referenceRow),
            reference_description: spec.referenceLabel,
            fecha: date ? formatCatalogDate(date, spec.datePrecision) : item.fecha,
            dato: spec.formatValue(value),
        };
    });
}

export function buildIndicatorCatalogItem(
    item: CatalogIndicatorRow,
    spec: CatalogIndicatorSpec,
    valueRow: DataRow | null,
    rawDate: string | null,
    publicationDate: string | null = null,
    referenceRow: DataRow | null = null,
): CatalogIndicatorRow {
    if (!valueRow) return { ...item };

    const value = toFiniteNumber(spec.selectValue(valueRow));
    if (value === null) return { ...item };

    const referenceDate = rowDate(valueRow);
    const date = rawDate ?? referenceDate;

    return {
        ...item,
        referencia: formatReferenceValue(spec, referenceRow),
        reference_description: spec.referenceLabel,
        fecha: date ? formatCatalogDisplayDate(date, spec, publicationDate) : item.fecha,
        dato: spec.formatValue(value),
    };
}
