import type { EmisionRawRow, IndicatorType, SyncResult, SyncResults } from '@/types';
import { getRawData, replaceNormalizedData, replaceRawData, saveIndicatorPublication, saveIndicatorsCatalog, saveRawData } from '../db';
import { buildCurrentIndicatorsCatalog } from '../catalog-service';
import { fechaToISO, normalizeBma, normalizeDeuda, normalizeEmae, normalizeEmision, normalizeInflacion, normalizePobreza, normalizePoderAdquisitivo, normalizeRecaudacion } from '../normalize';
import { runSyncTasks } from '../sync-runner';
import { fetchEmisionRaw } from './bcra';
import { fetchBmaRaw } from './bma';
import { ensureEmaeSectorTables, fetchEmaeRaw } from './emae';
import { fetchPoderAdquisitivoRawReport } from './poder-adquisitivo';
import { fetchRecaudacionRawReport } from './recaudacion';
import { ensureDeudaTables, fetchDeudaRaw } from './deuda';
import { ensurePobrezaTables, fetchPobrezaRaw } from './pobreza';
import { ensureInflacionTables, fetchInflacionRaw, fetchInflacionRawReport } from './inflacion';

function normalizeEmisionRawRow(row: EmisionRawRow): EmisionRawRow {
    return {
        fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
        compra_dolares: Number(row.compra_dolares ?? 0),
        tc: Number(row.tc ?? 0),
        bcra: Number(row.bcra ?? 0),
        vencimientos: Number(row.vencimientos ?? 0),
        licitado: Number(row.licitado ?? 0),
        resultado_fiscal: Number(row.resultado_fiscal ?? 0),
    };
}

export async function syncEmision(): Promise<SyncResult> {
    const type: IndicatorType = 'emision';
    const existingData = ((await getRawData(type)) ?? []).map(normalizeEmisionRawRow);
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { compraData, tcData } = await fetchEmisionRaw('2026-01-01', new Date().toISOString().split('T')[0]);
    const tcByIso = new Map(tcData.map((row) => [row.fecha, Number(row.valor ?? 0)]));
    const apiRows: EmisionRawRow[] = compraData.map((row) => {
        const compra = Number(row.valor ?? 0);
        const tc = tcByIso.get(row.fecha) ?? 0;
        return { fecha: row.fecha, compra_dolares: compra, tc, bcra: compra * tc };
    });
    const existingByFecha = new Map(existingData.map((row) => [row.fecha, row]));
    const rowsToUpsert = apiRows.map((row): Partial<EmisionRawRow> | null => {
        const existing = existingByFecha.get(row.fecha);
        if (!existing) return { ...row, vencimientos: 0, licitado: 0, resultado_fiscal: 0 };
        const apiChanged = existing.compra_dolares !== row.compra_dolares || existing.tc !== row.tc || existing.bcra !== row.bcra;
        return apiChanged ? { fecha: row.fecha, compra_dolares: row.compra_dolares, tc: row.tc, bcra: row.bcra } : null;
    }).filter((row): row is Partial<EmisionRawRow> => row !== null);

    if (rowsToUpsert.length > 0) await saveRawData(type, rowsToUpsert);
    const persistedRaw = ((await getRawData(type)) ?? []).map(normalizeEmisionRawRow).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    await replaceNormalizedData(type, normalizeEmision(persistedRaw));
    return { appended: apiRows.filter((row) => !existingFechas.has(row.fecha)).length, total: persistedRaw.length };
}

export async function syncEmae(): Promise<SyncResult> {
    const type: IndicatorType = 'emae';
    await ensureEmaeSectorTables();
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { rows: rawRows, publishedAt } = await fetchEmaeRaw();
    const appended = rawRows.filter((row) => !existingFechas.has(row.fecha)).length;
    await replaceRawData(type, rawRows);
    await replaceNormalizedData(type, normalizeEmae(rawRows));
    if (publishedAt) await saveIndicatorPublication('emae', publishedAt, rawRows.at(-1)?.fecha ?? null);
    return { appended, total: rawRows.length };
}

export async function syncBma(): Promise<SyncResult> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    const components = await fetchBmaRaw();
    const appended = components.filter((row) => !new Set(existingData.map(item => item.fecha)).has(row.fecha)).length;
    await replaceRawData(type, components);
    await replaceNormalizedData(type, normalizeBma(components));
    return { appended, total: components.length };
}

export async function syncIndicatorsCatalog(): Promise<SyncResult> {
    const catalog = await buildCurrentIndicatorsCatalog();
    await saveIndicatorsCatalog(catalog);
    return { appended: catalog.length, total: catalog.length };
}

export async function syncRecaudacion(): Promise<SyncResult> {
    const type: IndicatorType = 'reca';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { rows: rawData, publishedAt } = await fetchRecaudacionRawReport();
    await replaceRawData(type, rawData);
    await replaceNormalizedData(type, normalizeRecaudacion(rawData));
    if (publishedAt) await saveIndicatorPublication('recaudacion', publishedAt, rawData.at(-1)?.fecha ?? null);
    return { appended: rawData.filter((row) => !existingFechas.has(row.fecha)).length, total: rawData.length };
}

export async function syncPoderAdquisitivo(): Promise<SyncResult> {
    const type: IndicatorType = 'poder';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { rows: rawData, publishedAt } = await fetchPoderAdquisitivoRawReport();
    const normalized = normalizePoderAdquisitivo(rawData);
    await replaceRawData(type, rawData);
    await replaceNormalizedData(type, normalized);
    if (publishedAt) await saveIndicatorPublication('poder-adquisitivo', publishedAt, normalized.at(-1)?.iso_fecha ?? rawData.at(-1)?.fecha ?? null);
    return { appended: rawData.filter((row) => !existingFechas.has(row.fecha)).length, total: rawData.length };
}

export async function syncDeuda(): Promise<SyncResult> {
    const type: IndicatorType = 'deuda';
    await ensureDeudaTables();
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const rawData = await fetchDeudaRaw();
    await replaceRawData(type, rawData);
    await replaceNormalizedData(type, normalizeDeuda(rawData));
    return { appended: rawData.filter((row) => !existingFechas.has(row.fecha)).length, total: rawData.length };
}

export async function syncPobreza(): Promise<SyncResult> {
    const type: IndicatorType = 'pobreza';
    await ensurePobrezaTables();
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const rawData = await fetchPobrezaRaw();
    await replaceRawData(type, rawData);
    await replaceNormalizedData(type, normalizePobreza(rawData));
    return { appended: rawData.filter((row) => !existingFechas.has(row.fecha)).length, total: rawData.length };
}

export async function syncInflacion(): Promise<SyncResult> {
    const type: IndicatorType = 'inflacion';
    await ensureInflacionTables();
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { rows: rawData, publishedAt } = await fetchInflacionRawReport();
    await replaceRawData(type, rawData);
    const normalized = normalizeInflacion(rawData);
    await replaceNormalizedData(type, normalized);
    if (publishedAt) await saveIndicatorPublication('inflacion', publishedAt, normalized.at(-1)?.iso_fecha ?? rawData.at(-1)?.fecha ?? null);
    return { appended: rawData.filter((row) => !existingFechas.has(row.fecha)).length, total: rawData.length };
}

export async function runSync(): Promise<SyncResults> {
    const indicatorResults = await runSyncTasks([
        { key: 'emision', run: syncEmision },
        { key: 'emae', run: syncEmae },
        { key: 'bma', run: syncBma },
        { key: 'recaudacion', run: syncRecaudacion },
        { key: 'poder_adquisitivo', run: syncPoderAdquisitivo },
        { key: 'deuda', run: syncDeuda },
        { key: 'pobreza', run: syncPobreza },
        { key: 'inflacion', run: syncInflacion },
    ]);
    const catalogResults = await runSyncTasks([{ key: 'catalog', run: syncIndicatorsCatalog }]);
    return { ...indicatorResults, ...catalogResults };
}
