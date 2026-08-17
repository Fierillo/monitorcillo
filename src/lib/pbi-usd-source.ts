import { PBI_USD_ANNUAL_SERIES_ID, PBI_USD_QUARTERLY_SERIES_ID } from './balanza/schema';
import { fetchTextFromUrl } from './sync/http-client';
import { seriesValueMap } from './sync/series';
import { fetchTimeSeries } from './sync/time-series-client';

const WORLD_BANK_GDP_URL = 'https://api.worldbank.org/v2/country/ARG/indicator/NY.GDP.MKTP.CD?format=json&per_page=80';

export function parseWorldBankGdpUsdMillions(payload: unknown): Map<string, number> {
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
        throw new Error('Failed to parse World Bank GDP. Expected a JSON array with a data page.');
    }

    const values = new Map<string, number>();
    for (const row of payload[1]) {
        if (!row || typeof row !== 'object') continue;
        const year = Number((row as { date?: unknown }).date);
        const dollars = Number((row as { value?: unknown }).value);
        if (!Number.isInteger(year) || year < 1992 || !Number.isFinite(dollars) || dollars <= 0) continue;
        values.set(`${year}-01-01`, dollars / 1_000_000);
    }

    return values;
}

export async function fetchAnnualPbiUsdMillions(): Promise<Map<string, number>> {
    const [worldBankText, indec] = await Promise.all([
        fetchTextFromUrl(WORLD_BANK_GDP_URL),
        fetchTimeSeries({ ids: [PBI_USD_QUARTERLY_SERIES_ID, PBI_USD_ANNUAL_SERIES_ID] }),
    ]);

    const values = parseWorldBankGdpUsdMillions(JSON.parse(worldBankText));
    const quarterly = seriesValueMap(indec.data || []);
    for (const [fecha, pbi] of quarterly) {
        if (fecha >= '2004-01-01') values.set(fecha, pbi);
    }

    if (values.size === 0) {
        throw new Error('Failed to build USD GDP series from 1992. World Bank and INDEC returned no usable observations.');
    }

    return new Map([...values.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
