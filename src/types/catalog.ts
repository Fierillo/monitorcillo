import type { DataRow } from './common';
import type { IndicatorType } from './indicators';

export type CatalogDatePrecision = 'day' | 'month';

export type CatalogIndicatorSpec = {
    type: IndicatorType;
    datePrecision: CatalogDatePrecision;
    normalizedValueColumn: string;
    selectValue: (row: DataRow) => unknown;
    rawDateFields: string[];
    formatValue: (value: number) => string;
};
