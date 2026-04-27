import https from 'https';
import * as XLSX from 'xlsx';
import { getRawData, saveRawData, saveIndicatorsCatalog, replaceRawData, replaceNormalizedData, IndicatorType, getNormalizedData } from './db';
import { normalizeEmision, normalizeEmae, normalizeBma, normalizeRecaudacion, normalizePoderAdquisitivo, fechaToISO, fechaToTimestamp, isoToFecha } from './normalize';

const WEEKLY_BALANCE_WORKBOOK_URL = 'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Serieanual.xls';
const WEEKLY_TREASURY_SERIES_REGEX = /DEPOSITOS DEL GOBIERNO NACIONAL Y OTROS/i;
const ENGLISH_MONTHS: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
};

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

function fetchBufferFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Failed to download ${url}. Status ${res.statusCode}`));
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function parseWorkbookWeeklyDate(value: unknown): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = ENGLISH_MONTHS[match[2]];
    const yearShort = Number(match[3]);
    if (!month || Number.isNaN(day) || Number.isNaN(yearShort)) return null;
    const year = yearShort >= 50 ? 1900 + yearShort : 2000 + yearShort;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseWorkbookTreasuryValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const sanitized = String(value).trim().replace(/[,.]/g, '');
    if (!sanitized) return null;
    const numericValue = Number(sanitized);
    if (Number.isNaN(numericValue)) return null;
    return numericValue / 1000;
}

function extractWeeklyGovernmentDepositsSeries(workbookBuffer: Buffer, fromDate: string): Array<{ fecha: string; valor: number }> {
    const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
    const byFecha = new Map<string, number>();

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
        const headerRow = rows.find((row) => row.some((cell) => parseWorkbookWeeklyDate(cell)));
        const treasuryRow = rows.find((row) => WEEKLY_TREASURY_SERIES_REGEX.test(String(row[0] ?? '')));

        if (!headerRow || !treasuryRow) continue;

        for (let column = 1; column < headerRow.length; column += 1) {
            const fecha = parseWorkbookWeeklyDate(headerRow[column]);
            if (!fecha || fecha < fromDate) continue;

            const valor = parseWorkbookTreasuryValue(treasuryRow[column]);
            if (valor == null) continue;

            byFecha.set(fecha, valor);
        }
    }

    return Array.from(byFecha.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, valor]) => ({ fecha, valor }));
}

function fetchBcraVariablePage(idVariable: number, from: string, to: string, offset: number): Promise<{ detalle: any[]; count: number; limit: number }> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}&limit=3000&offset=${offset}`;

    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({
                            detalle: parsed.results?.[0]?.detalle || [],
                            count: parsed.metadata?.resultset?.count || 0,
                            limit: parsed.metadata?.resultset?.limit || 3000,
                        });
                    } catch {
                        resolve({ detalle: [], count: 0, limit: 3000 });
                    }
                } else {
                    resolve({ detalle: [], count: 0, limit: 3000 });
                }
            });
        }).on('error', () => resolve({ detalle: [], count: 0, limit: 3000 }));
    });
}

async function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<any[]> {
    const allRows: any[] = [];
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

export async function fetchBmaRaw(): Promise<any[]> {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    const fromDate = '2017-01-01';

    const [baseMonetaria, pases, leliq, lefi, otros, weeklyWorkbook, pbi, emae, ipc] = await Promise.all([
        fetchBcraVariable(15, fromDate, toDate),
        fetchBcraVariable(152, fromDate, toDate),
        fetchBcraVariable(155, fromDate, toDate),
        fetchBcraVariable(196, fromDate, toDate),
        fetchBcraVariable(198, fromDate, toDate),
        fetchBufferFromUrl(WEEKLY_BALANCE_WORKBOOK_URL),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=166.2_PPIB_0_0_3&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=143.3_NO_PR_2004_A_31&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
    ]);

    const depositosTesoro = extractWeeklyGovernmentDepositsSeries(weeklyWorkbook, fromDate);

    const byFecha = new Map<string, Record<string, any>>();

    const mergeSeries = (items: any[], field: string) => {
        for (const item of items) {
            if (!item?.fecha) continue;
            const row: Record<string, any> = byFecha.get(item.fecha) ?? { fecha: item.fecha };
            row[field] = item.valor == null ? null : Number(item.valor);
            byFecha.set(item.fecha, row);
        }
    };

    mergeSeries(baseMonetaria, 'base_monetaria');
    mergeSeries(pases, 'pases');
    mergeSeries(leliq, 'leliq');
    mergeSeries(lefi, 'lefi');
    mergeSeries(otros, 'otros');
    mergeSeries(depositosTesoro, 'depositos_tesoro');

    const pbiByQuarter = new Map<string, number>();
    for (const row of pbi.data || []) {
        const fecha = row[0];
        if (!fecha || typeof fecha !== 'string') continue;
        const year = parseInt(fecha.slice(0, 4), 10);
        const month = parseInt(fecha.slice(5, 7), 10);
        const quarter = Math.ceil(month / 3);
        pbiByQuarter.set(`${year}-Q${quarter}`, row[1]);
    }

    const emaeByFecha = new Map((emae.data || []).map((row: any) => [row[0], row[1]]));
    const ipcByFecha = new Map((ipc.data || []).map((row: any) => [row[0], row[1]]));

    const monthPrefixes = new Set<string>();
    for (const fecha of byFecha.keys()) {
        monthPrefixes.add(fecha.slice(0, 7));
    }

    for (const monthPrefix of monthPrefixes) {
        const firstOfMonth = `${monthPrefix}-01`;
        const year = parseInt(monthPrefix.slice(0, 4), 10);
        const month = parseInt(monthPrefix.slice(5, 7), 10);
        const quarter = Math.ceil(month / 3);
        
        const pbiVal = pbiByQuarter.get(`${year}-Q${quarter}`);
        const emaeVal = emaeByFecha.get(firstOfMonth);
        const ipcVal = ipcByFecha.get(firstOfMonth);
        
        if (pbiVal != null || emaeVal != null || ipcVal != null) {
            const row: Record<string, any> = byFecha.get(firstOfMonth) ?? { fecha: firstOfMonth };
            if (pbiVal != null) row.pbi_trimestral = pbiVal;
            if (emaeVal != null) row.emae_desestacionalizado = emaeVal;
            if (ipcVal != null) row.ipc_nucleo = ipcVal;
            byFecha.set(firstOfMonth, row);
        }
    }

    return Array.from(byFecha.values()).sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));
}

function fetchCSV(url: string): Promise<string[][]> {
    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    const rows = data.split('\n')
                        .map(line => line.trim().split(','))
                        .filter(row => row.length > 1);
                    resolve(rows);
                } else {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

export async function fetchPoderAdquisitivoRaw(): Promise<any[]> {
    const [ipc, jubilaciones, salariosCsv, ripteCsv] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=58.1_MP_0_M_24&limit=5000'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/149/distribution/149.1/download/indice-salarios-periodicidad-mensual-base-octubre-2016.csv'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv'),
    ]);

    const ipcByFecha = new Map((ipc.data || []).map((row: any) => [row[0], row[1]]));
    const jubilacionesByFecha = new Map((jubilaciones.data || []).map((row: any) => [row[0], row[1]]));
    const ripteByFecha = new Map(ripteCsv.slice(1).map(row => [row[0], row[1]]));

    const combinedMap = new Map<string, any>();

    // Use salaries CSV as base for dates since it's the primary series
    salariosCsv.slice(1).forEach(row => {
        const fecha = row[0];
        if (!fecha) return;
        combinedMap.set(fecha, {
            fecha,
            ipc_nucleo: ipcByFecha.get(fecha) ?? null,
            salario_registrado: row[2] ? Number(row[2]) : null,
            salario_no_registrado: row[5] ? Number(row[5]) : null,
            salario_privado: row[3] ? Number(row[3]) : null,
            salario_publico: row[4] ? Number(row[4]) : null,
            ripte: ripteByFecha.get(fecha) ? Number(ripteByFecha.get(fecha)) : null,
            jubilacion_minima: jubilacionesByFecha.get(fecha) ? Number(jubilacionesByFecha.get(fecha)) : null,
        });
    });

    // Ensure we also have rows that might only exist in IPC or Jubilaciones (though unlikely for recent data)
    ipcByFecha.forEach((val, fecha) => {
        if (!combinedMap.has(fecha)) {
            combinedMap.set(fecha, {
                fecha,
                ipc_nucleo: val,
                salario_registrado: null,
                salario_no_registrado: null,
                salario_privado: null,
                salario_publico: null,
                ripte: ripteByFecha.get(fecha) ? Number(ripteByFecha.get(fecha)) : null,
                jubilacion_minima: jubilacionesByFecha.get(fecha) ? Number(jubilacionesByFecha.get(fecha)) : null,
            });
        }
    });

    return Array.from(combinedMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchRecaudacionRaw(): Promise<any[]> {
    const [recaudacion, pbi, emae, ipc] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=172.3_TL_RECAION_M_0_0_17&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=166.2_PPIB_0_0_3&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=143.3_NO_PR_2004_A_31&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
    ]);

    const pbiByQuarter = new Map<string, number>();
    for (const row of pbi.data || []) {
        const fecha = row[0];
        if (!fecha || typeof fecha !== 'string') continue;
        const year = parseInt(fecha.slice(0, 4), 10);
        const month = parseInt(fecha.slice(5, 7), 10);
        const quarter = Math.ceil(month / 3);
        pbiByQuarter.set(`${year}-Q${quarter}`, row[1]);
    }

    const emaeByFecha = new Map((emae.data || []).map((row: any) => [row[0], row[1]]));
    const ipcByFecha = new Map((ipc.data || []).map((row: any) => [row[0], row[1]]));

    return (recaudacion.data || []).map((row: any) => {
        const fecha = row[0];
        const year = parseInt(fecha.slice(0, 4), 10);
        const month = fecha.slice(5, 7);
        const quarter = Math.ceil(parseInt(month, 10) / 3);

        return {
            fecha,
            mes: month,
            year,
            recaudacion_total: row[1] ?? null,
            pbi_trimestral: pbiByQuarter.get(`${year}-Q${quarter}`) ?? null,
            emae_desestacionalizado: emaeByFecha.get(fecha) ?? null,
            ipc_nucleo: ipcByFecha.get(fecha) ?? null,
        };
    });
}

export async function syncEmision(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emision';
    const existingData = ((await getRawData(type)) ?? []).map((row: any) => ({
        fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
        compra_dolares: Number(row.compra_dolares ?? 0),
        tc: Number(row.tc ?? 0),
        bcra: Number(row.bcra ?? 0),
        vencimientos: Number(row.vencimientos ?? 0),
        licitado: Number(row.licitado ?? 0),
        resultado_fiscal: Number(row.resultado_fiscal ?? 0),
    }));
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const fromDate = '2026-01-01';
    const toDate = new Date().toISOString().split('T')[0];

    const { compraData, tcData } = await fetchEmisionRaw(fromDate, toDate);

    const tcByIso = new Map(tcData.map((row: any) => [row.fecha, Number(row.valor ?? 0)]));

    const apiRows = compraData.map((row: any) => {
        const compra = Number(row.valor ?? 0);
        const tc = tcByIso.get(row.fecha) ?? 0;

        return {
            fecha: row.fecha,
            compra_dolares: compra,
            tc,
            bcra: compra * tc,
        };
    });

    const existingByFecha = new Map(existingData.map((row: any) => [row.fecha, row]));
    const rowsToUpsert = apiRows
        .map((row: any) => {
            const existing = existingByFecha.get(row.fecha);

            if (!existing) {
                return {
                    ...row,
                    vencimientos: 0,
                    licitado: 0,
                    resultado_fiscal: 0,
                };
            }

            const apiChanged =
                existing.compra_dolares !== row.compra_dolares ||
                existing.tc !== row.tc ||
                existing.bcra !== row.bcra;

            if (!apiChanged) {
                return null;
            }

            // ONLY return API columns for existing rows to protect manual ones
            return {
                fecha: row.fecha,
                compra_dolares: row.compra_dolares,
                tc: row.tc,
                bcra: row.bcra,
            };
        })
        .filter((row: any) => row !== null);

    if (rowsToUpsert.length > 0) {
        await saveRawData(type, rowsToUpsert);
    }

    const persistedRaw = ((await getRawData(type)) ?? [])
        .map((row: any) => ({
            fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
            compra_dolares: Number(row.compra_dolares ?? 0),
            tc: Number(row.tc ?? 0),
            bcra: Number(row.bcra ?? 0),
            vencimientos: Number(row.vencimientos ?? 0),
            licitado: Number(row.licitado ?? 0),
            resultado_fiscal: Number(row.resultado_fiscal ?? 0),
        }))
        .sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));

    const normalized = normalizeEmision(persistedRaw);
    await replaceNormalizedData(type, normalized);

    const appended = apiRows.filter((row: any) => !existingFechas.has(row.fecha)).length;
    return { appended, total: persistedRaw.length };
}

export async function syncEmae(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'emae';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const rawData = await fetchEmaeRaw();
    const rawRows = (rawData.data || [])
        .map((row: any) => {
            const fecha = row[0];
            if (!fecha || typeof fecha !== 'string') return null;
            return {
                fecha,
                emae: row[1] ?? null,
                emae_desestacionalizado: row[2] ?? null,
                emae_tendencia: row[3] ?? null,
            };
        })
        .filter((row: any) => row !== null);

    const appended = rawRows.filter((row: any) => !existingFechas.has(row.fecha)).length;
    await replaceRawData(type, rawRows);

    const normalized = normalizeEmae(rawRows);
    await replaceNormalizedData(type, normalized);

    return { appended, total: rawRows.length };
}

export async function syncBma(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const components = await fetchBmaRaw();

    const appended = components.filter((row: any) => !existingFechas.has(row.fecha)).length;
    await replaceRawData(type, components);

    const normalized = normalizeBma(components);
    await replaceNormalizedData(type, normalized);

    return { appended, total: components.length };
}

const DEFAULT_CATALOG = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Metrica compuesta', dato: '-', fecha: 'Feb-26', fuente: 'BCRA', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Emisión / Absorción de Pesos', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Var% interanual', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'Indice 100 = Ene-17', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Índice Base Ene-17 = 100', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
];

export async function syncIndicatorsCatalog(): Promise<{ appended: number; total: number }> {
    try {
        const catalog = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
        const sources: Record<string, IndicatorType> = {
            'bma': 'bma',
            'emision': 'emision',
            'recaudacion': 'reca',
            'poder-adquisitivo': 'poder',
            'emae': 'emae'
        };

        for (const item of catalog) {
            const type = sources[item.id];
            if (!type) continue;
            
            const data = await getNormalizedData(type);
            if (!data || data.length === 0) continue;

            const getValue = (row: any) => {
                if (item.id === 'bma') return row.BMAmplia;
                if (item.id === 'emision') return row.ACUMULADO;
                if (item.id === 'recaudacion') return row.pctPbi;
                if (item.id === 'poder-adquisitivo') return row.blanco;
                if (item.id === 'emae') return row.emae_desestacionalizado;
                return null;
            };

            let latestRow = data[data.length - 1];
            if (getValue(latestRow) == null) {
                for (let i = data.length - 1; i >= 0; i--) {
                    if (getValue(data[i]) != null) {
                        latestRow = data[i];
                        break;
                    }
                }
            }

            if (latestRow.iso_fecha) item.fecha = isoToFecha(latestRow.iso_fecha);
            
            const val = getValue(latestRow);
            if (val != null) {
                if (item.id === 'bma' || item.id === 'recaudacion') {
                    item.dato = `${val.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
                } else if (item.id === 'emision') {
                    item.dato = `$${Math.round(val).toLocaleString('es-AR')}M`;
                } else {
                    item.dato = val.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                }
            }
        }
        await saveIndicatorsCatalog(catalog);
        return { appended: catalog.length, total: catalog.length };
    } catch (error) {
        console.error('syncIndicatorsCatalog error:', error);
        return { appended: 0, total: 0 };
    }
}

export async function syncRecaudacion(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'reca';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const rawData = await fetchRecaudacionRaw();
    const appended = rawData.filter((row: any) => !existingFechas.has(row.fecha)).length;

    await replaceRawData(type, rawData);

    const normalized = normalizeRecaudacion(rawData);
    await replaceNormalizedData(type, normalized);

    return { appended, total: rawData.length };
}

export async function syncPoderAdquisitivo(): Promise<{ appended: number; total: number }> {
    const type: IndicatorType = 'poder';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((d: any) => d.fecha));

    const rawData = await fetchPoderAdquisitivoRaw();
    const appended = rawData.filter((row: any) => !existingFechas.has(row.fecha)).length;

    await replaceRawData(type, rawData);

    const normalized = normalizePoderAdquisitivo(rawData);
    await replaceNormalizedData(type, normalized);

    return { appended, total: rawData.length };
}

export async function runSync(): Promise<Record<string, { appended: number; total: number }>> {
    const results: Record<string, { appended: number; total: number }> = {};

    const emision = await syncEmision().catch(e => { console.error('emision error:', e); return { appended: 0, total: 0 }; });
    const emae = await syncEmae().catch(e => { console.error('emae error:', e); return { appended: 0, total: 0 }; });
    const bma = await syncBma().catch(e => { console.error('bma error:', e); return { appended: 0, total: 0 }; });
    const reca = await syncRecaudacion().catch(e => { console.error('reca error:', e); return { appended: 0, total: 0 }; });
    const poder = await syncPoderAdquisitivo().catch(e => { console.error('poder error:', e); return { appended: 0, total: 0 }; });
    const catalog = await syncIndicatorsCatalog().catch(e => { console.error('catalog error:', e); return { appended: 0, total: 0 }; });

    if (emision.total > 0) results.emision = { appended: emision.appended, total: emision.total };
    if (emae.total > 0) results.emae = { appended: emae.appended, total: emae.total };
    if (bma.total > 0) results.bma = { appended: bma.appended, total: bma.total };
    if (reca.total > 0) results.recaudacion = { appended: reca.appended, total: reca.total };
    if (poder.total > 0) results.poder_adquisitivo = { appended: poder.appended, total: poder.total };
    if (catalog.total > 0) results.catalog = { appended: catalog.appended, total: catalog.total };
    return results;
}

export default {
    fetchEmisionRaw,
    fetchEmaeRaw,
    fetchBmaRaw,
    fetchPoderAdquisitivoRaw,
    fetchRecaudacionRaw,
    syncEmision,
    syncEmae,
    syncBma,
    syncIndicatorsCatalog,
    syncRecaudacion,
    syncPoderAdquisitivo,
    runSync
};
