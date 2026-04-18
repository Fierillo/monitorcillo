import https from 'https';
import { getRawData, saveRawData, saveNormalizedData, saveIndicatorsCatalog, getManualOverrides, saveManualOverride, IndicatorType } from './db';
import { normalizeEmision, normalizeEmae, normalizeBma, isoToFecha, fechaToISO, fechaToTimestamp } from './normalize';

function fetchFromUrl(url: string): Promise<any> {
    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch {
                        resolve({ data: [] });
                    }
                } else {
                    resolve({ data: [] });
                }
            });
        }).on('error', () => resolve({ data: [] }));
    });
}

function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<any[]> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}`;

    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.results?.[0]?.detalle || []);
                    } catch {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

export async function fetchEmisionRaw(from: string, to: string): Promise<{ compraData: any[]; tcData: any[] }> {
    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, from, to),
        fetchBcraVariable(4, from, to),
    ]);

    return { compraData, tcData };
}

export async function fetchEmaeRaw(): Promise<any> {
    const ids = '143.3_NO_PR_2004_A_21,143.3_NO_PR_2004_A_31,143.3_NO_PR_2004_A_28';
    return fetchFromUrl(`https://apis.datos.gob.ar/series/api/series/?ids=${ids}&limit=5000`);
}

export async function fetchBmaRaw(): Promise<any> {
    return fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=143.2_NO_PR_2004_A_16&limit=5000');
}

function getLastDateISO(existingData: any[]): string {
    if (existingData.length === 0) {
        return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    const lastFecha = existingData[existingData.length - 1].fecha;
    return fechaToISO(lastFecha);
}

export async function syncEmision(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emision';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const lastDateISO = getLastDateISO(existingData);
    const toDate = new Date().toISOString().split('T')[0];

    const { compraData, tcData } = await fetchEmisionRaw(lastDateISO, toDate);

    const newRows = compraData
        .filter((d: any) => !existingFechas.has(isoToFecha(d.fecha)))
        .map((d: any) => ({
            fecha: isoToFecha(d.fecha),
            compra_dolares: d.valor ?? 0,
            tc: tcData.find((t: any) => t.fecha === d.fecha)?.valor ?? 0,
            bcra: (d.valor ?? 0) * (tcData.find((t: any) => t.fecha === d.fecha)?.valor ?? 0),
            vencimientos: 0,
            licitado: 0,
            licitaciones: 0,
            resultado_fiscal: 0,
            total: 0,
            acumulado: null,
        }));

    if (newRows.length === 0) {
        return { appended: 0, total: existingData.length };
    }

    const merged = [...existingData, ...newRows].sort((a: any, b: any) => 
        fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha)
    );

    let runningTotal = 0;
    for (const row of merged) {
        if (row.acumulado !== undefined && row.acumulado !== null) {
            runningTotal = row.acumulado;
        } else {
            runningTotal += row.bcra ?? 0;
            row.acumulado = runningTotal;
        }
    }

    await saveRawData(type, merged);

    const normalized = normalizeEmision(merged);
    await saveNormalizedData(type, normalized);

    return { appended: newRows.length, total: merged.length };
}

export async function syncEmae(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emae';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const rawData = await fetchEmaeRaw();
    const normalized = normalizeEmae(rawData);

    const newRows = normalized.filter((r: any) => !existingFechas.has(r.fecha));
    const merged = [...existingData, ...newRows].sort((a: any, b: any) => 
        fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha)
    );

    await saveRawData(type, merged);
    await saveNormalizedData(type, merged);

    return { appended: newRows.length, total: merged.length };
}

export async function syncBma(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const rawData = await fetchBmaRaw();
    const normalized = normalizeBma(rawData);

    const newRows = normalized.filter((r: any) => !existingFechas.has(r.fecha));
    const merged = [...existingData, ...newRows].sort((a: any, b: any) => 
        fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha)
    );

    await saveRawData(type, merged);
    await saveNormalizedData(type, merged);

    return { appended: newRows.length, total: merged.length };
}

const DEFAULT_CATALOG = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Metrica compuesta', dato: '-', fecha: 'Feb-26', fuente: 'BCRA', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Emisión / Absorción de Pesos', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Var% interanual', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'Indice 100 = Ene-17', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Índice Base Ene-17 = 100', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
];

const DEFAULT_OVERRIDES_OTROS = {
    '2025-07': 915650.0522746978,
    '2025-08': 870107.8875241702,
    '2025-09': 4410267.021281188,
    '2025-10': 1680687.1870503204,
    '2025-11': 3338799.64449871,
    '2025-12': 3598125.5826119184,
    '2026-01': 532951.165145119,
    '2026-02': 401430.9767548815
};

export async function syncIndicatorsCatalog(): Promise<{ appended: number; total: number }> {
    try {
        await saveIndicatorsCatalog(DEFAULT_CATALOG);
        return { appended: DEFAULT_CATALOG.length, total: DEFAULT_CATALOG.length };
    } catch {
        return { appended: 0, total: 0 };
    }
}

export async function syncBcraOverrides(): Promise<{ appended: number; total: number }> {
    const existing = await getManualOverrides();
    const existingCount = Object.keys(existing.otros).length + Object.keys(existing.tesoro).length;
    
    if (existingCount > 0) {
        return { appended: 0, total: existingCount };
    }

    let count = 0;
    for (const [month, value] of Object.entries(DEFAULT_OVERRIDES_OTROS)) {
        await saveManualOverride('otros', month, value);
        count++;
    }
    return { appended: count, total: count };
}

export async function syncRecaudacion(): Promise<{ appended: number; total: number }> {
    console.log('Recaudacion: no API available - manual data required');
    return { appended: 0, total: 0 };
}

export async function syncPoderAdquisitivo(): Promise<{ appended: number; total: number }> {
    console.log('Poder adquisitivo: no API available - manual data required');
    return { appended: 0, total: 0 };
}

export async function runSync(): Promise<Record<string, { appended: number; total: number }>> {
    const results: Record<string, { appended: number; total: number }> = {};

    const [emision, emae, bma, reca, poder, catalog, overrides] = await Promise.all([
        syncEmision(),
        syncEmae(),
        syncBma(),
        syncRecaudacion(),
        syncPoderAdquisitivo(),
        syncIndicatorsCatalog(),
        syncBcraOverrides(),
    ]);

    if (emision.total > 0) results.emision = { appended: emision.appended, total: emision.total };
    if (emae.total > 0) results.emae = { appended: emae.appended, total: emae.total };
    if (bma.total > 0) results.bma = { appended: bma.appended, total: bma.total };
    if (reca.total > 0) results.recaudacion = { appended: reca.appended, total: reca.total };
    if (poder.total > 0) results.poder_adquisitivo = { appended: poder.appended, total: poder.total };
    if (catalog.total > 0) results.catalog = { appended: catalog.appended, total: catalog.total };
    if (overrides.total > 0) results.overrides = { appended: overrides.appended, total: overrides.total };

    return results;
}