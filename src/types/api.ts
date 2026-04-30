import type { BcraVariableRow, DatosGobSeriesRow } from './data';
import type { EmisionAdminRow } from './admin';
import type { Indicator } from './indicators';
import type { SyncResults } from './common';

export type BcraVariablePage = {
    detalle: BcraVariableRow[];
    count: number;
    limit: number;
};

export type BcraApiResponse = {
    results?: Array<{
        detalle?: BcraVariableRow[];
    }>;
    metadata?: {
        resultset?: {
            count?: number;
            limit?: number;
        };
    };
};

export type DatosGobApiResponse = {
    data?: DatosGobSeriesRow[];
};

export type ApiErrorResponse = {
    error: string;
    details?: string;
};

export type SyncApiResponse = {
    success: boolean;
    results?: SyncResults;
};

export type EmisionPostBody = {
    type: 'emision';
    data: EmisionAdminRow[];
};

export type IndicatorsPostBody = Indicator[];
