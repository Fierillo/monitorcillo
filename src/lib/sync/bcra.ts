import https from 'https';
import type { BcraApiResponse, BcraVariablePage, BcraVariableRow, EmisionRawRow } from '@/types';

function fetchBcraVariablePage(idVariable: number, from: string, to: string, offset: number): Promise<BcraVariablePage> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}&limit=3000&offset=${offset}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`Failed to fetch BCRA variable ${idVariable}. API returned status ${res.statusCode ?? 'unknown'}. Retry the sync when the BCRA API is available.`));
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
                    reject(new Error(`Failed to parse BCRA variable ${idVariable}. Verify the BCRA API response format before retrying the sync.`));
                }
            });
        }).on('error', (error) => reject(new Error(`Failed to fetch BCRA variable ${idVariable}: ${error.message}. Retry the sync when the BCRA API is available.`)));
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

export function sampleMonthlyBalanceDates(rows: BcraVariableRow[]): BcraVariableRow[] {
    const rowsByMonth = new Map<string, BcraVariableRow[]>();
    for (const row of rows) {
        if (!row.fecha || !Number.isFinite(Number(row.valor))) continue;
        const month = row.fecha.slice(0, 7);
        const monthRows = rowsByMonth.get(month) ?? [];
        monthRows.push(row);
        rowsByMonth.set(month, monthRows);
    }

    return Array.from(rowsByMonth.entries()).flatMap(([month, monthRows]) => {
        monthRows.sort((a, b) => a.fecha.localeCompare(b.fecha));
        const [year, monthNumber] = month.split('-').map(Number);
        const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
        const latestDate = monthRows.at(-1)!.fecha;
        const selected = new Map<string, BcraVariableRow>();

        for (const day of [7, 15, 23, lastDay]) {
            const targetDate = `${month}-${String(day).padStart(2, '0')}`;
            if (targetDate > latestDate) continue;
            const row = monthRows.findLast(item => item.fecha <= targetDate);
            if (row) selected.set(targetDate, { ...row, fecha: targetDate });
        }

        return Array.from(selected.values());
    });
}

export async function fetchEmisionRaw(from: string, to: string): Promise<{ compraData: BcraVariableRow[]; tcData: BcraVariableRow[] }> {
    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, from, to),
        fetchBcraVariable(4, from, to),
    ]);

    return { compraData, tcData };
}

export function buildEmissionRows(compraData: BcraVariableRow[], tcData: BcraVariableRow[]): EmisionRawRow[] {
    if (compraData.length === 0) {
        throw new Error('Failed to sync emission data. BCRA variable 78 returned no observations, so existing data was preserved.');
    }
    if (tcData.length === 0) {
        throw new Error('Failed to sync emission data. BCRA variable 4 returned no exchange rates, so existing data was preserved.');
    }

    const tcByIso = new Map(tcData
        .map(row => [row.fecha, Number(row.valor)] as const)
        .filter((row): row is readonly [string, number] => Number.isFinite(row[1])));
    const missingExchangeRateDates = compraData.filter(row => !tcByIso.has(row.fecha)).map(row => row.fecha);
    if (missingExchangeRateDates.length > 0) {
        throw new Error(`Failed to sync emission data. Missing BCRA exchange rates for ${missingExchangeRateDates.slice(0, 5).join(', ')}${missingExchangeRateDates.length > 5 ? ' and more dates' : ''}. Existing data was preserved.`);
    }

    return compraData.map((row) => {
        const compra = Number(row.valor);
        const tc = tcByIso.get(row.fecha)!;
        if (!Number.isFinite(compra)) {
            throw new Error(`Failed to sync emission data. Invalid BCRA purchase value for ${row.fecha}. Existing data was preserved.`);
        }
        return { fecha: row.fecha, compra_dolares: compra, tc, bcra: compra * tc };
    });
}
