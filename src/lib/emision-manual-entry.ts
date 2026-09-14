import db from './db';
import { fechaToISO, normalizeEmision } from './normalize';
import type { EmisionAdminRow, EmisionRawEditableField, EmisionRawRow, NumericValue } from '@/types';

type ManualEmisionUpdate = {
    updated: number;
    skipped: string[];
};

const EDITABLE_FIELDS: Record<string, EmisionRawEditableField> = {
    CompraDolares: 'compra_dolares',
    TC: 'tc',
    BCRA: 'bcra',
    Vencimientos: 'vencimientos',
    Licitado: 'licitado',
    'Resultado fiscal': 'resultado_fiscal',
};

function toIsoDate(row: EmisionAdminRow): string | null {
    const candidate = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha));
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate ?? '') ? candidate : null;
}

function toNumericValue(value: unknown): NumericValue {
    if (value === null || value === '' || value === '-') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function changedFields(row: EmisionAdminRow, stored: EmisionRawRow | undefined): Partial<EmisionRawRow> {
    const changes: Record<string, NumericValue> = {};

    for (const [inputField, rawField] of Object.entries(EDITABLE_FIELDS)) {
        const incoming = (row as unknown as Record<string, unknown>)[inputField];
        if (incoming === undefined) continue;

        const value = toNumericValue(incoming);
        if (stored && value === (stored[rawField] ?? null)) continue;
        changes[rawField] = value;
    }

    return changes;
}

export async function applyManualEmisionRows(rows: EmisionAdminRow[]): Promise<ManualEmisionUpdate> {
    const stored = new Map((await db.getRawData('emision')).map(row => [row.fecha, row as EmisionRawRow]));
    const updates: Array<Partial<EmisionRawRow>> = [];
    const skipped: string[] = [];

    for (const row of rows) {
        const fecha = toIsoDate(row);
        if (!fecha) {
            skipped.push(String(row.fecha ?? row.iso_fecha ?? ''));
            continue;
        }

        const changes = changedFields(row, stored.get(fecha));
        if (Object.keys(changes).length > 0) updates.push({ fecha, ...changes });
    }

    if (updates.length > 0) await db.saveRawData('emision', updates);

    const persisted = (await db.getRawData('emision') as EmisionRawRow[]).sort((a, b) => a.fecha.localeCompare(b.fecha));
    await db.replaceNormalizedData('emision', normalizeEmision(persisted));

    return { updated: updates.length, skipped };
}
