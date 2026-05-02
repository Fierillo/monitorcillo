import type { DataRow } from './common';
import type { IndicatorType } from './indicators';

export type CatalogIndicatorSpec = {
    type: IndicatorType;
    normalizedValueColumn: string;
    selectValue: (row: DataRow) => unknown;
    rawDateFields: string[];
    formatValue: (value: number) => string;
};
