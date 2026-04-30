import https from 'https';
import type { DatosGobApiResponse, DatosGobSeriesRow } from '@/types';

export async function fetchSeries(ids: string, startDate?: string): Promise<DatosGobSeriesRow[]> {
    const dateParam = startDate ? `&start_date=${startDate}` : '';
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${ids}&limit=5000&format=json${dateParam}`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data) as DatosGobApiResponse;
                        resolve(parsed.data || []);
                    } catch {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            });
        }).on('error', () => {
            resolve([]);
        });
    });
}
