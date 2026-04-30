import https from 'https';
import type { BcraApiResponse, BcraVariableRow } from '@/types';

export async function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<BcraVariableRow[]> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}`;

    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });

        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data) as BcraApiResponse;
                        resolve(parsed.results && parsed.results[0] ? parsed.results[0].detalle || [] : []);
                    } catch {
                        resolve([]);
                    }
                } else {
                    console.error(`BCRA API returned ${res.statusCode}`);
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching BCRA var ${idVariable}:`, err);
            resolve([]);
        });
    });
}
