import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow, IndicatorType } from '@/types';
import { CATALOG_INDICATOR_SPECS } from './specs';
import {
    comparisonTrend,
    formatCatalogDate,
    formatCatalogDisplayDate,
    formatReferenceValue,
    latestRawDate,
    latestRow,
    nextExpectedCatalogEvent,
    referenceNumericValue,
    referenceRowForSpec,
    rowDate,
    toFiniteNumber,
} from './rows';

export function buildIndicatorsCatalog(
    catalog: CatalogIndicatorRow[],
    normalizedData: Partial<Record<IndicatorType, DataRow[] | null | undefined>>,
    rawData: Partial<Record<IndicatorType, DataRow[] | null | undefined>> = {},
): CatalogIndicatorRow[] {
    return catalog.map(item => {
        const spec = CATALOG_INDICATOR_SPECS[item.id];
        if (!spec) return { ...item };

        const normalizedRows = normalizedData[spec.type] ?? [];
        let valueRow = latestRow(normalizedRows, row => toFiniteNumber(spec.selectValue(row)) !== null);
        if (!valueRow && spec.fallbackValueColumns) {
            for (const col of spec.fallbackValueColumns) {
                valueRow = latestRow(normalizedRows, row => toFiniteNumber(row[col]) !== null);
                if (valueRow) break;
            }
        }
        if (!valueRow) return { ...item };

        const value = toFiniteNumber(spec.selectValue(valueRow));
        if (value === null) return { ...item };

        const referenceDate = rowDate(valueRow);
        const rawRows = rawData[spec.type] ?? [];
        const date = latestRawDate(rawRows, spec) ?? referenceDate;
        const referenceRow = referenceRowForSpec(spec, valueRow, normalizedRows, rawRows);
        const referenceValue = referenceNumericValue(spec, referenceRow);
        const nextEvent = nextExpectedCatalogEvent(spec, valueRow, referenceDate, date, null, undefined, normalizedRows, rawRows);

        return {
            ...item,
            referencia: formatReferenceValue(spec, referenceRow),
            reference_description: spec.referenceLabel,
            trend: comparisonTrend(spec, value, referenceValue),
            fecha: date ? formatCatalogDate(date, spec.datePrecision) : item.fecha,
            dato: spec.formatValue(value),
            proxima_fecha: nextEvent?.date,
            proxima_fecha_description: nextEvent?.description ?? null,
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
    normalizedRows: DataRow[] = [],
    rawRows: DataRow[] = [],
    sourcePublicationDates?: Record<string, string | null>,
): CatalogIndicatorRow {
    if (!valueRow) return { ...item };

    const value = toFiniteNumber(spec.selectValue(valueRow));
    if (value === null) return { ...item };

    const referenceDate = rowDate(valueRow);
    const date = rawDate ?? referenceDate;
    const referenceValue = referenceNumericValue(spec, referenceRow);
    const nextEvent = nextExpectedCatalogEvent(spec, valueRow, referenceDate, date, publicationDate, sourcePublicationDates, normalizedRows, rawRows);

    return {
        ...item,
        referencia: formatReferenceValue(spec, referenceRow),
        reference_description: spec.referenceLabel,
        trend: comparisonTrend(spec, value, referenceValue),
        fecha: date ? formatCatalogDisplayDate(date, spec, publicationDate) : item.fecha,
        dato: spec.formatValue(value),
        proxima_fecha: nextEvent?.date,
        proxima_fecha_description: nextEvent?.description ?? null,
    };
}
