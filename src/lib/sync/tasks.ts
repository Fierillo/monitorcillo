import type { EmisionRawRow, IndicatorType, NormalizedDataRow, RawDataByType, SyncResult, SyncResults } from '@/types';
import { getRawData, replaceNormalizedData, saveIndicatorPublication, saveIndicatorsCatalog, saveRawData } from '../db';
import { buildCurrentIndicatorsCatalog } from '../catalog-service';
import { fechaToISO, normalizeBma, normalizeDeuda, normalizeEmae, normalizeEmision, normalizeInflacion, normalizePobreza, normalizePoderAdquisitivo, normalizeRecaudacion } from '../normalize';
import { runSyncTasks } from '../sync-runner';
import { fetchEmisionRaw } from './bcra';
import { fetchBmaRaw } from './bma';
import { ensureEmaeSectorTables, fetchEmaeRaw } from './emae';
import { fetchPoderAdquisitivoRawReport } from './poder-adquisitivo';
import { ensureRecaudacionTables, fetchRecaudacionRawReport } from './recaudacion';
import { ensureDeudaTables, fetchDeudaRaw } from './deuda';
import { ensurePobrezaTables, fetchPobrezaRawReport } from './pobreza';
import { ensureInflacionTables, fetchInflacionRawReport } from './inflacion';
import { mergeRawSeries } from './merge-raw';

function normalizeEmisionRawRow(row: EmisionRawRow): EmisionRawRow {
    return {
        fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
        compra_dolares: Number(row.compra_dolares ?? 0),
        tc: row.tc === null || row.tc === undefined || row.tc === '' ? undefined : Number(row.tc),
        bcra: Number(row.bcra ?? 0),
        vencimientos: Number(row.vencimientos ?? 0),
        licitado: Number(row.licitado ?? 0),
        resultado_fiscal: Number(row.resultado_fiscal ?? 0),
    };
}

async function persistMergedRawAndNormalize<T extends IndicatorType>(
    type: T,
    existingData: Array<RawDataByType[T]>,
    incoming: Array<RawDataByType[T]>,
    normalize: (rows: Array<RawDataByType[T]>) => NormalizedDataRow[],
): Promise<SyncResult> {
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { merged, upserts, emptyIncoming } = mergeRawSeries(existingData, incoming);

    if (emptyIncoming || upserts.length === 0) {
        return { appended: 0, total: existingData.length };
    }

    await saveRawData(type, upserts as Array<Partial<RawDataByType[T]>>);

    const persistedRaw = (await getRawData(type)) as Array<RawDataByType[T]>;
    const rawForNormalize = persistedRaw.length > 0 ? persistedRaw : merged;
    const normalized = normalize(rawForNormalize);
    if (normalized.length > 0) {
        await replaceNormalizedData(type, normalized);
    }

    return {
        appended: incoming.filter((row) => !existingFechas.has(row.fecha)).length,
        total: rawForNormalize.length,
    };
}

export async function syncEmision(): Promise<SyncResult> {
    const type: IndicatorType = 'emision';
    const existingData = ((await getRawData(type)) ?? []).map(normalizeEmisionRawRow);
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { compraData, tcData } = await fetchEmisionRaw('2026-01-01', new Date().toISOString().split('T')[0]);

    if (compraData.length === 0) {
        return { appended: 0, total: existingData.length };
    }

    const tcByIso = new Map(tcData.map((row) => [row.fecha, row.valor === null || row.valor === undefined || row.valor === '' ? undefined : Number(row.valor)]));
    const apiRows: EmisionRawRow[] = compraData.map((row) => {
        const compra = Number(row.valor ?? 0);
        const tc = tcByIso.get(row.fecha);
        return { fecha: row.fecha, compra_dolares: compra, tc, bcra: tc == null ? 0 : compra * tc };
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
    if (persistedRaw.length > 0) {
        await replaceNormalizedData(type, normalizeEmision(persistedRaw));
    }
    return { appended: apiRows.filter((row) => !existingFechas.has(row.fecha)).length, total: persistedRaw.length };
}

export async function syncEmae(): Promise<SyncResult> {
    const type: IndicatorType = 'emae';
    await ensureEmaeSectorTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawRows, publishedAt } = await fetchEmaeRaw();
    const result = await persistMergedRawAndNormalize(type, existingData, rawRows, normalizeEmae);
    const persistedRaw = (await getRawData(type)) ?? [];
    if (persistedRaw.length > 0) await replaceNormalizedData(type, normalizeEmae(persistedRaw));
    if (publishedAt && rawRows.length > 0) {
        await saveIndicatorPublication('emae', publishedAt, rawRows.at(-1)?.fecha ?? null);
    }
    return result;
}

export async function syncBma(): Promise<SyncResult> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    const components = await fetchBmaRaw();
    return persistMergedRawAndNormalize(type, existingData, components, normalizeBma);
}

export async function syncIndicatorsCatalog(): Promise<SyncResult> {
    const catalog = await buildCurrentIndicatorsCatalog();
    await saveIndicatorsCatalog(catalog);
    return { appended: catalog.length, total: catalog.length };
}

export async function syncRecaudacion(): Promise<SyncResult> {
    const type: IndicatorType = 'reca';
    await ensureRecaudacionTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt } = await fetchRecaudacionRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizeRecaudacion);
    if (publishedAt && rawData.length > 0) {
        await saveIndicatorPublication('recaudacion', publishedAt, rawData.at(-1)?.fecha ?? null);
    }
    return result;
}

export async function syncPoderAdquisitivo(): Promise<SyncResult> {
    const type: IndicatorType = 'poder';
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt } = await fetchPoderAdquisitivoRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizePoderAdquisitivo);
    if (publishedAt && rawData.length > 0) {
        await saveIndicatorPublication('poder-adquisitivo', publishedAt, rawData.at(-1)?.fecha ?? null);
    }
    return result;
}

export async function syncDeuda(): Promise<SyncResult> {
    const type: IndicatorType = 'deuda';
    await ensureDeudaTables();
    const existingData = (await getRawData(type)) ?? [];
    const rawData = await fetchDeudaRaw();
    return persistMergedRawAndNormalize(type, existingData, rawData, normalizeDeuda);
}

export async function syncPobreza(): Promise<SyncResult> {
    const type: IndicatorType = 'pobreza';
    await ensurePobrezaTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt, sourcePublications } = await fetchPobrezaRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizePobreza);

    if (rawData.length > 0) {
        if (publishedAt) await saveIndicatorPublication('pobreza', publishedAt, rawData.at(-1)?.fecha ?? null);
        await Promise.all((sourcePublications ?? []).map(source => saveIndicatorPublication(source.id, source.publishedAt, source.periodDate)));
    }

    return result;
}

export async function syncInflacion(): Promise<SyncResult> {
    const type: IndicatorType = 'inflacion';
    await ensureInflacionTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt, sourcePublications } = await fetchInflacionRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizeInflacion);

    if (rawData.length > 0) {
        if (publishedAt) await saveIndicatorPublication('inflacion', publishedAt, rawData.at(-1)?.fecha ?? null);
        await Promise.all((sourcePublications ?? []).map(source => saveIndicatorPublication(source.id, source.publishedAt, source.periodDate)));
    }

    return result;
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
