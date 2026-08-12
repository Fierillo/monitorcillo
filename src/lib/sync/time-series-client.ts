import type { DatosGobSeriesResponse, DatosGobSeriesRow } from '@/types';
import { fetchTextFromUrl } from './http-client';

const API_URL = 'https://apis.datos.gob.ar/series/api/series/';
const DEFAULT_LIMIT = 5000;
const responseCache = new Map<string, Promise<DatosGobSeriesResponse>>();

type FetchTimeSeriesOptions = {
    ids: string[];
    limit?: number;
};

export function buildTimeSeriesUrl({ ids, limit = DEFAULT_LIMIT }: FetchTimeSeriesOptions): string {
    if (ids.length === 0 || ids.some(id => !id.trim())) {
        throw new Error('Failed to build time series request. Provide at least one valid series ID.');
    }
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Failed to build time series request for ${ids.join(', ')}. Limit must be a positive integer.`);
    }

    const url = new URL(API_URL);
    url.searchParams.set('ids', ids.join(','));
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit));
    return url.toString();
}

export function parseTimeSeriesResponse(value: unknown, ids: string[]): DatosGobSeriesResponse {
    if (!value || typeof value !== 'object' || !Array.isArray((value as DatosGobSeriesResponse).data)) {
        throw new Error(`Failed to parse time series ${ids.join(', ')}. The API response does not contain a data array.`);
    }

    const expectedColumns = ids.length + 1;
    const data = (value as DatosGobSeriesResponse).data!;
    if (!data.every(row => isSeriesRow(row, expectedColumns))) {
        throw new Error(`Failed to parse time series ${ids.join(', ')}. Expected a date and ${ids.length} value column(s) in every row.`);
    }

    return { data };
}

export function fetchTimeSeries(options: FetchTimeSeriesOptions): Promise<DatosGobSeriesResponse> {
    const url = buildTimeSeriesUrl(options);
    const cached = responseCache.get(url);
    if (cached) return cached;

    const request = fetchTextFromUrl(url)
        .then(text => {
            try {
                return parseTimeSeriesResponse(JSON.parse(text), options.ids);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    throw new Error(`Failed to parse time series ${options.ids.join(', ')}. The API returned invalid JSON.`);
                }
                throw error;
            }
        })
        .catch(error => {
            responseCache.delete(url);
            if (error instanceof Error && error.message.startsWith('Failed to parse time series')) throw error;
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch time series ${options.ids.join(', ')}. ${message}`);
        });

    responseCache.set(url, request);
    return request;
}

function isSeriesRow(value: unknown, expectedColumns: number): value is DatosGobSeriesRow {
    if (!Array.isArray(value) || value.length !== expectedColumns || typeof value[0] !== 'string') return false;
    return value.slice(1).every(item => item == null || typeof item === 'number');
}
