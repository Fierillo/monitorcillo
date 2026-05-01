import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow, IndicatorType } from '@/types';
import { isoToFecha } from './normalize';

export const DEFAULT_CATALOG: CatalogIndicatorRow[] = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Metrica compuesta', dato: '-', fecha: 'Feb-26', fuente: 'BCRA', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Emisión / Absorción de Pesos', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Var% interanual', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'Indice 100 = Ene-17', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Índice Base Ene-17 = 100', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
];

const decimalFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
});

const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatPbiPercentage = (value: number) => `${formatDecimal(value)}% del PBI`;

export const CATALOG_INDICATOR_SPECS: Record<string, CatalogIndicatorSpec> = {
    bma: {
        type: 'bma',
        selectValue: row => row.BMAmplia,
        rawDateFields: ['base_monetaria', 'pases', 'leliq', 'lefi', 'otros', 'depositos_tesoro'],
        formatValue: formatPbiPercentage,
    },
    emision: {
        type: 'emision',
        selectValue: row => row.ACUMULADO,
        rawDateFields: ['compra_dolares', 'tc', 'bcra', 'vencimientos', 'licitado', 'resultado_fiscal'],
        formatValue: value => `$${integerFormatter.format(Math.round(value))}M`,
    },
    recaudacion: {
        type: 'reca',
        selectValue: row => row.pctPbi,
        rawDateFields: ['recaudacion_total'],
        formatValue: formatPbiPercentage,
    },
    'poder-adquisitivo': {
        type: 'poder',
        selectValue: row => row.blanco,
        rawDateFields: ['salario_registrado', 'salario_no_registrado', 'salario_privado', 'salario_publico', 'ripte', 'jubilacion_minima'],
        formatValue: formatDecimal,
    },
    emae: {
        type: 'emae',
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

        return {
            ...item,
            fecha: date ? isoToFecha(date) : item.fecha,
            dato: spec.formatValue(value),
        };
    });
}
