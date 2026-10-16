import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEmaeRaw } from '../lib/sync/emae';

const mocks = vi.hoisted(() => ({
    fetchTextFromUrl: vi.fn(),
    fetchTimeSeries: vi.fn(),
}));

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn() } }));
vi.mock('../lib/sync/http-client', () => ({ fetchTextFromUrl: mocks.fetchTextFromUrl }));
vi.mock('../lib/sync/time-series-client', () => ({ fetchTimeSeries: mocks.fetchTimeSeries }));
vi.mock('../lib/sync/cache', () => ({
    fetchEmaeWorkbookRows: async () => [{ fecha: '2004-01-01', emae: 95, emae_desestacionalizado: 100 }],
    fetchEmaeSectorWorkbookRows: async () => [{ fecha: '2004-01-01', industria: 90 }],
}));

describe('EMAE synchronization source', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.fetchTimeSeries.mockResolvedValue({ data: [] });
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => {
            if (url.includes('api.worldbank.org')) {
                return JSON.stringify([{}, [{ date: '1992', value: 32_000_000 }, { date: '2004', value: 38_000_000 }]]);
            }
            if (url.endsWith('.csv')) {
                return 'indice_tiempo,indice_serie_desestacionalizada\n1993-01-01,40\n2004-01-01,80';
            }
            return '22/04/26. Estimador mensual de actividad económica';
        });
    });

    it('links official historical CSV to current INDEC data without depending on the series API', async () => {
        const report = await fetchEmaeRaw();

        expect(report.publishedAt).toBe('2026-04-22');
        expect(report.rows).toEqual([
            { fecha: '1993-01-01', emae_desestacionalizado: 50, poblacion: 32_250_000 },
            { fecha: '2004-01-01', emae: 95, emae_desestacionalizado: 100, industria: 90, poblacion: 37_750_000 },
        ]);
        expect(mocks.fetchTimeSeries).not.toHaveBeenCalled();
    });

    it.each([
        'indice_tiempo,indice_serie_desestacionalizada\n2004-01-01,80',
        'indice_tiempo,indice_serie_desestacionalizada\n1993-01-01,40',
    ])('rejects historical data without the start date or an overlapping observation', async csv => {
        const fetchSource = mocks.fetchTextFromUrl.getMockImplementation()!;
        mocks.fetchTextFromUrl.mockImplementation((url: string) => url.endsWith('.csv') ? Promise.resolve(csv) : fetchSource(url));

        await expect(fetchEmaeRaw()).rejects.toThrow('Failed to extend EMAE history to 1993');
    });

    it('rejects an HTML error page instead of treating it as historical CSV data', async () => {
        const fetchSource = mocks.fetchTextFromUrl.getMockImplementation()!;
        mocks.fetchTextFromUrl.mockImplementation((url: string) => url.endsWith('.csv')
            ? Promise.resolve('<html>Service unavailable</html>')
            : fetchSource(url));

        await expect(fetchEmaeRaw()).rejects.toThrow('Invalid HTML');
    });
});
