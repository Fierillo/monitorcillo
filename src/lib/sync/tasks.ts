import type { IndicatorType, NormalizedDataRow, RawDataByType, SyncResult, SyncRunReport } from '@/types';
import { getRawData, replaceNormalizedData, saveIndicatorPublication, saveIndicatorsCatalog, saveRawData } from '../db';
import { buildCurrentIndicatorsCatalog } from '../catalog-service';
import { normalizeBalanza, normalizeBma, normalizeDepositosPrestamos, normalizeDeuda, normalizeEmae, normalizeEmision, normalizeIcg, normalizeInflacion, normalizePobreza, normalizePoderAdquisitivo, normalizeRecaudacion, normalizeSipa } from '../normalize';
import { runSyncTasks } from '../sync-runner';
import { buildEmissionRows, fetchEmisionRaw } from './bcra';
import { fetchBmaRaw } from './bma';
import { ensureDepositosPrestamosTables, fetchDepositosPrestamosRaw } from './depositos-prestamos';
import { ensureEmaeSectorTables, fetchEmaeRaw } from './emae';
import { fetchPoderAdquisitivoRawReport } from './poder-adquisitivo';
import { ensureRecaudacionTables, fetchRecaudacionRawReport } from './recaudacion';
import { ensureDeudaTables, fetchDeudaRaw } from './deuda';
import { ensurePobrezaTables, fetchPobrezaRawReport } from './pobreza';
import { ensureInflacionTables, fetchInflacionRawReport } from './inflacion';
import { ensureIcgTables, fetchIcgRawReport } from './icg';
import { ensureBalanzaTables, fetchBalanzaRawReport } from './balanza';
import { ensureSipaTables, fetchSipaRawReport } from './sipa';
import { normalizeEmisionStoredRow, planEmisionRawUpserts } from './emision-plan';
import { mergeRawSeries } from './merge-raw';

async function persistMergedRawAndNormalize<T extends IndicatorType>(
    type: T,
    existingData: Array<RawDataByType[T]>,
    incoming: Array<RawDataByType[T]>,
    normalize: (rows: Array<RawDataByType[T]>) => NormalizedDataRow[],
    refreshUnchanged = false,
): Promise<SyncResult> {
    const existingFechas = new Set(existingData.map((row) => row.fecha));
    const { merged, upserts } = mergeRawSeries(existingData, incoming);

    if (upserts.length === 0 && !refreshUnchanged) {
        return { appended: 0, total: existingData.length };
    }

    if (upserts.length > 0) await saveRawData(type, upserts as Array<Partial<RawDataByType[T]>>);

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
    const existingData = (await getRawData(type)) ?? [];
    const { compraData, tcData } = await fetchEmisionRaw('2026-01-01', new Date().toISOString().split('T')[0]);
    const apiRows = buildEmissionRows(compraData, tcData);
    const { upserts, appended } = planEmisionRawUpserts(existingData, apiRows);

    if (upserts.length > 0) await saveRawData(type, upserts);
    const persistedRaw = ((await getRawData(type)) ?? []).map(normalizeEmisionStoredRow).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (persistedRaw.length > 0) {
        await replaceNormalizedData(type, normalizeEmision(persistedRaw));
    }
    return { appended, total: persistedRaw.length };
}

export async function syncEmae(): Promise<SyncResult> {
    const type: IndicatorType = 'emae';
    await ensureEmaeSectorTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawRows, publishedAt } = await fetchEmaeRaw();
    const result = await persistMergedRawAndNormalize(type, existingData, rawRows, normalizeEmae, true);
    if (publishedAt && rawRows.length > 0) {
        await saveIndicatorPublication('emae', publishedAt, rawRows.at(-1)?.fecha ?? null);
    }
    return result;
}

export async function syncBma(): Promise<SyncResult> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    return persistMergedRawAndNormalize(type, existingData, await fetchBmaRaw(), normalizeBma);
}

export async function syncDepositosPrestamos(): Promise<SyncResult> {
    const type: IndicatorType = 'depositos-prestamos';
    await ensureDepositosPrestamosTables();
    const existingData = (await getRawData(type)) ?? [];
    const rawData = await fetchDepositosPrestamosRaw();
    return persistMergedRawAndNormalize(type, existingData, rawData, normalizeDepositosPrestamos, true);
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
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizePoderAdquisitivo, true);
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

export async function syncIcg(): Promise<SyncResult> {
    const type: IndicatorType = 'icg';
    await ensureIcgTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt, nextPublishedAt } = await fetchIcgRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizeIcg);
    if (rawData.length > 0) {
        if (publishedAt) await saveIndicatorPublication('icg', publishedAt, rawData.at(-1)?.fecha ?? null);
        if (nextPublishedAt) await saveIndicatorPublication('icg-next', nextPublishedAt, null);
    }
    return result;
}

export async function syncBalanza(): Promise<SyncResult> {
    const type: IndicatorType = 'balanza';
    await ensureBalanzaTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt } = await fetchBalanzaRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizeBalanza);
    if (publishedAt && rawData.length > 0) await saveIndicatorPublication('balanza-comercial', publishedAt, rawData.at(-1)?.fecha ?? null);
    return result;
}

export async function syncSipa(): Promise<SyncResult> {
    const type: IndicatorType = 'sipa';
    await ensureSipaTables();
    const existingData = (await getRawData(type)) ?? [];
    const { rows: rawData, publishedAt } = await fetchSipaRawReport();
    const result = await persistMergedRawAndNormalize(type, existingData, rawData, normalizeSipa);
    if (publishedAt && rawData.length > 0) await saveIndicatorPublication('sipa', publishedAt, rawData.at(-1)?.fecha ?? null);
    return result;
}

export async function runSync(): Promise<SyncRunReport> {
    const indicatorReport = await runSyncTasks([
        { key: 'emision', run: syncEmision },
        { key: 'emae', run: syncEmae },
        { key: 'bma', run: syncBma },
        { key: 'depositos_prestamos', run: syncDepositosPrestamos },
        { key: 'recaudacion', run: syncRecaudacion },
        { key: 'poder_adquisitivo', run: syncPoderAdquisitivo },
        { key: 'deuda', run: syncDeuda },
        { key: 'pobreza', run: syncPobreza },
        { key: 'inflacion', run: syncInflacion },
        { key: 'icg', run: syncIcg },
        { key: 'balanza_comercial', run: syncBalanza },
        { key: 'sipa', run: syncSipa },
    ]);
    const catalogReport = await runSyncTasks([{ key: 'catalog', run: syncIndicatorsCatalog }]);
    return {
        results: { ...indicatorReport.results, ...catalogReport.results },
        updated: [...indicatorReport.updated, ...catalogReport.updated],
        failed: [...indicatorReport.failed, ...catalogReport.failed],
    };
}
