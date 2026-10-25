import type { CatalogIndicatorRow, CatalogIndicatorSpec, DataRow, IndicatorType } from '@/types';
import { CATALOG_INDICATOR_SPECS } from './specs';
import {
    comparisonTrend,
    formatCatalogDate,
    formatCatalogDisplayDate,
    formatReferenceValue,
    allFieldsDaily,
    latestRawDate,
    latestDateLabel,
    latestRow,
    nextExpectedCatalogEvent,
    referenceNumericValue,
    referenceRowForSpec,
    rowDate,
    toFiniteNumber,
} from './rows';

/** Bulk fallback: it has no publication dates, so its rows never carry published_at. */
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
        const date = latestRawDate(rawRows, Object.keys(spec.rawDateFields)) ?? referenceDate;
        const referenceRow = spec.isComparable?.(valueRow) === false ? null : referenceRowForSpec(spec, valueRow, normalizedRows, rawRows);
        const referenceValue = referenceNumericValue(spec, referenceRow);
        const nextEvent = nextExpectedCatalogEvent(spec, valueRow, referenceDate, date, null, undefined, normalizedRows, rawRows);

        return {
            ...item,
            referencia: formatReferenceValue(spec, referenceRow),
            reference_description: spec.referenceLabel,
            trend: comparisonTrend(spec, value, referenceValue),
            fecha: date ? formatCatalogDate(date, spec.datePrecision) : item.fecha,
            dato: spec.formatRowValue?.(valueRow, value) ?? spec.formatValue(value),
            proxima_fecha: nextEvent?.date,
            proxima_fecha_description: nextEvent?.description ?? null,
            proxima_estimada: nextEvent?.estimated,
            fecha_description: latestDateLabel(spec, valueRow, rawRows),
            daily: allFieldsDaily(rawRows, Object.keys(spec.rawDateFields)),
        };
    });
}

export function buildIndicatorCatalogItem(
    item: CatalogIndicatorRow,
    spec: CatalogIndicatorSpec,
    valueRow: DataRow | null,
    rawDate: string | null,
    publicationDate: string | null = null,
    comparedRow: DataRow | null = null,
    normalizedRows: DataRow[] = [],
    rawRows: DataRow[] = [],
    sourcePublicationDates?: Record<string, string | null>,
): CatalogIndicatorRow {
    if (!valueRow) return { ...item };

    const value = toFiniteNumber(spec.selectValue(valueRow));
    if (value === null) return { ...item };

    const referenceRow = spec.isComparable?.(valueRow) === false ? null : comparedRow;
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
        published_at: publicationDate ?? undefined,
        dato: spec.formatRowValue?.(valueRow, value) ?? spec.formatValue(value),
        proxima_fecha: nextEvent?.date,
        proxima_fecha_description: nextEvent?.description ?? null,
        proxima_estimada: nextEvent?.estimated,
        fecha_description: latestDateLabel(spec, valueRow, rawRows),
        daily: allFieldsDaily(rawRows, Object.keys(spec.rawDateFields)),
    };
}
