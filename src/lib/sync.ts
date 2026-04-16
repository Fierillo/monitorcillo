import https from 'https';
import { getRawData, saveRawData, saveNormalizedData, saveIndicatorsCatalog, getBcraOverrides, IndicatorType } from './db';

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, OCT: 9, NOV: 10, DIC: 11 };

function isoToFecha(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

function fechaToTimestamp(fecha: string): number {
    const parts = fecha.split(' ');
    if (parts.length < 3) return 0;
    return new Date(2000 + parseInt(parts[2]), MONTHS_IDX[parts[1]], parseInt(parts[0])).getTime();
}

function fechaToISO(fecha: string): string {
    const parts = fecha.split(' ');
    if (parts.length < 3) return '';
    return `20${parts[2]}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
}

async function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<any[]> {
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

async function fetchSeries(ids: string): Promise<any[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${ids}&limit=5000&format=json`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.data || []);
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

export async function syncEmision(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emision';
    const existingData = (await getRawData(type)) ?? [];

    const existingByFecha = new Map(existingData.map((d: any) => [d.fecha, d]));

    const lastFecha = existingData.length ? existingData[existingData.length - 1].fecha : null;
    const lastDateISO = lastFecha
        ? fechaToISO(lastFecha)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const toDate = new Date().toISOString().split('T')[0];

    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, lastDateISO, toDate),
        fetchBcraVariable(4, lastDateISO, toDate),
    ]);

    const tcByFecha = new Map(tcData.map((d: any) => [d.fecha, d.valor]));

    const rawRows: any[] = [];
    let appended = 0;

    for (const d of compraData) {
        const fecha = isoToFecha(d.fecha);
        if (existingByFecha.has(fecha)) continue;

        const tc = tcByFecha.get(d.fecha) ?? 0;
        const compraDolares = d.valor ?? 0;
        const BCRA = compraDolares * tc;

        const row = {
            fecha,
            compra_dolares: compraDolares,
            tc,
            bcra: BCRA,
            vencimientos: 0,
            licitado: 0,
            licitaciones: 0,
            resultado_fiscal: 0,
            total: BCRA,
            acumulado: null,
        };
        
        existingByFecha.set(fecha, row);
        rawRows.push(row);
        appended++;
    }

    const merged = Array.from(existingByFecha.values())
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    let runningTotal = 0;
    for (const row of merged) {
        if (row.acumulado !== undefined && row.acumulado !== null) {
            runningTotal = row.acumulado;
        } else {
            runningTotal += row.total ?? 0;
            row.acumulado = runningTotal;
        }
    }

    await saveRawData(type, merged);

    const normalized = merged.map((r: any) => ({
        fecha: r.fecha,
        value: r.bcra,
        acumulado: r.acumulado,
        tc: r.tc,
    }));
    await saveNormalizedData(type, normalized);

    return { appended, total: merged.length };
}

export async function syncEmae(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emae';
    const existingData = (await getRawData(type)) ?? [];

    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const series = await fetchSeries('tcm_2006.4_m_23_37,tcm_2006.4_m_23_38,tcm_2006.4_m_23_39');

    const months: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const emaeByFecha = new Map<string, { emae: number; desest?: number; tendencia?: number }>();

    for (const s of series) {
        const fecha = `${months[s.fecha.slice(5, 7)]} ${s.fecha.slice(2, 4)}`;
        
        if (s.indice === 'tcm_2006.4_m_23_37') {
            emaeByFecha.set(fecha, { emae: s.valor });
        } else if (s.indice === 'tcm_2006.4_m_23_38' && emaeByFecha.has(fecha)) {
            const existing = emaeByFecha.get(fecha)!;
            existing.desest = s.valor;
        } else if (s.indice === 'tcm_2006.4_m_23_39' && emaeByFecha.has(fecha)) {
            const existing = emaeByFecha.get(fecha)!;
            existing.tendencia = s.valor;
        }
    }

    const rawRows: any[] = [];
    let appended = 0;

    for (const [fecha, values] of emaeByFecha) {
        if (existingFechas.has(fecha)) continue;
        
        const row = {
            fecha,
            emae: values.emae,
            emae_desestacionalizado: values.desest,
            emae_tendencia: values.tendencia,
        };
        
        existingData.push(row);
        rawRows.push(row);
        appended++;
    }

    existingData.sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    await saveRawData(type, existingData);
    await saveNormalizedData(type, existingData);

    return { appended, total: existingData.length };
}

export async function syncBma(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];

    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const series = await fetchSeries('tcm_2006.4_m_21_35_tend');

    const months: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    let appended = 0;

    for (const s of series) {
        const fecha = `${months[s.fecha.slice(5, 7)]} ${s.fecha.slice(2, 4)}`;
        if (existingFechas.has(fecha)) continue;

        const row = { fecha, base: s.valor };
        existingData.push(row);
        appended++;
    }

    existingData.sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    await saveRawData(type, existingData);
    await saveNormalizedData(type, existingData);

    return { appended, total: existingData.length };
}

export async function runSync(): Promise<Record<string, { appended: number; total: number }>> {
    const results: Record<string, { appended: number; total: number }> = {};

    const [emision, emae, bma, catalog, overrides] = await Promise.all([
        syncEmision(),
        syncEmae(),
        syncBma(),
        syncIndicatorsCatalog(),
        syncBcraOverrides(),
    ]);

    if (emision.appended > 0 || emision.total > 0) results.emision = { appended: emision.appended, total: emision.total };
    if (emae.appended > 0 || emae.total > 0) results.emae = { appended: emae.appended, total: emae.total };
    if (bma.appended > 0 || bma.total > 0) results.bma = { appended: bma.appended, total: bma.total };
    if (catalog.appended > 0 || catalog.total > 0) results.catalog = { appended: catalog.appended, total: catalog.total };
    if (overrides.appended > 0 || overrides.total > 0) results.overrides = { appended: overrides.appended, total: overrides.total };

    return results;
}

const DEFAULT_CATALOG = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Metrica compuesta', dato: '-', fecha: 'Feb-26', fuente: 'BCRA', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Emisión / Absorción de Pesos', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Var% interanual', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'Indice 100 = Ene-17', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Índice Base Ene-17 = 100', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
];

const DEFAULT_OVERRIDES = {
    otros: {
        '2025-07': 915650.0522746978,
        '2025-08': 870107.8875241702,
        '2025-09': 4410267.021281188,
        '2025-10': 1680687.1870503204,
        '2025-11': 3338799.64449871,
        '2025-12': 3598125.5826119184,
        '2026-01': 532951.165145119,
        '2026-02': 401430.9767548815
    },
    tesoro: {}
};

export async function syncIndicatorsCatalog(): Promise<{ appended: number; total: number }> {
    try {
        await saveIndicatorsCatalog(DEFAULT_CATALOG);
        return { appended: DEFAULT_CATALOG.length, total: DEFAULT_CATALOG.length };
    } catch (e) {
        return { appended: 0, total: 0 };
    }
}

export async function syncBcraOverrides(): Promise<{ appended: number; total: number }> {
    const existing = await getBcraOverrides();
    if (Object.keys(existing.otros).length > 0 || Object.keys(existing.tesoro).length > 0) {
        return { appended: 0, total: Object.keys(existing.otros).length + Object.keys(existing.tesoro).length };
    }
    
    const { saveBcraOverride } = await import('./db');
    let count = 0;
    for (const [month, value] of Object.entries(DEFAULT_OVERRIDES.otros)) {
        await saveBcraOverride('otros', month, value);
        count++;
    }
    return { appended: count, total: count };
}

export async function syncRecaudacion(): Promise<{ appended: number; total: number }> {
    console.log('Recaudacion sync not implemented - requires manual data');
    return { appended: 0, total: 0 };
}

export async function syncPoderAdquisitivo(): Promise<{ appended: number; total: number }> {
    console.log('Poder adquisitivo sync not implemented - requires manual data');
    return { appended: 0, total: 0 };
}