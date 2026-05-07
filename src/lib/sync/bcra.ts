import https from 'https';
import type { BcraApiResponse, BcraVariablePage, BcraVariableRow } from '@/types';

function fetchBcraVariablePage(idVariable: number, from: string, to: string, offset: number): Promise<BcraVariablePage> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}&limit=3000&offset=${offset}`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    resolve({ detalle: [], count: 0, limit: 3000 });
                    return;
                }

                try {
                    const parsed = JSON.parse(data) as BcraApiResponse;
                    resolve({
                        detalle: parsed.results?.[0]?.detalle || [],
                        count: parsed.metadata?.resultset?.count || 0,
                        limit: parsed.metadata?.resultset?.limit || 3000,
                    });
                } catch {
                    resolve({ detalle: [], count: 0, limit: 3000 });
                }
            });
        }).on('error', () => resolve({ detalle: [], count: 0, limit: 3000 }));
    });
}

export async function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<BcraVariableRow[]> {
    const allRows: BcraVariableRow[] = [];
    let offset = 0;
    let count = 0;
    let limit = 3000;

    do {
        const page = await fetchBcraVariablePage(idVariable, from, to, offset);
        allRows.push(...page.detalle);
        count = page.count;
        limit = page.limit;
        offset += limit;
    } while (offset < count);

    return allRows;
}

export async function fetchEmisionRaw(from: string, to: string): Promise<{ compraData: BcraVariableRow[]; tcData: BcraVariableRow[] }> {
    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, from, to),
        fetchBcraVariable(4, from, to),
    ]);

    return { compraData, tcData };
}
