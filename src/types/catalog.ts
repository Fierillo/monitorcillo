import type { DataRow } from './common';
import type { IndicatorType } from './indicators';

export type CatalogDatePrecision = 'day' | 'month';

export type CatalogIndicatorSpec = {
    type: IndicatorType;
    referenceLabel: string;
    referenceSource?: 'normalized' | 'raw';
    betterWhen: 'higher' | 'lower';
    getReferenceDate: (date: string) => string;
    selectReferenceValue: (row: DataRow) => unknown;
    formatReferenceValue?: (value: number) => string;
    datePrecision: CatalogDatePrecision;
    normalizedValueColumn: string;
    fallbackValueColumns?: string[];
    selectValue: (row: DataRow) => unknown;
    rawDateFields: string[];
    formatValue: (value: number) => string;
    getNextExpectedDate: (latestDate: string) => string;
};
