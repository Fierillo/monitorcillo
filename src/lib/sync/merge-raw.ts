export type FechaRow = { fecha: string };

export type MergeRawSeriesResult<T extends FechaRow> = {
    merged: T[];
    upserts: Array<Partial<T> & { fecha: string }>;
    emptyIncoming: boolean;
};

const IGNORED_KEYS = new Set(['fecha', 'id', 'fetched_at', 'last_update']);

function isAbsent(value: unknown): boolean {
    return value === null || value === undefined || value === '';
}

function valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (isAbsent(a) && isAbsent(b)) return true;

    const aNumeric = typeof a === 'number' || (typeof a === 'string' && a.trim() !== '' && Number.isFinite(Number(a)));
    const bNumeric = typeof b === 'number' || (typeof b === 'string' && b.trim() !== '' && Number.isFinite(Number(b)));
    if (aNumeric && bNumeric) return Number(a) === Number(b);

    return String(a) === String(b);
}

/**
 * Preserve existing raw history by default.
 * - Empty incoming does not wipe or alter existing rows.
 * - Null/undefined/'' fields in incoming never overwrite stored values.
 * - Only dates present in incoming can change, and only for provided fields.
 */
export function mergeRawSeries<T extends FechaRow>(
    existing: readonly T[],
    incoming: ReadonlyArray<Partial<T> & FechaRow>,
): MergeRawSeriesResult<T> {
    const incomingRows = incoming;

    if (incomingRows.length === 0) {
        return {
            merged: existing.map((row) => ({ ...row })),
            upserts: [],
            emptyIncoming: true,
        };
    }

    const byFecha = new Map<string, T>();
    for (const row of existing) {
        if (!row.fecha) continue;
        byFecha.set(row.fecha, { ...row });
    }

    const upserts: Array<Partial<T> & { fecha: string }> = [];

    for (const incomingRow of incomingRows) {
        const fecha = incomingRow.fecha;
        if (!fecha) continue;

        const current = byFecha.get(fecha);
        if (!current) {
            const created = { ...incomingRow, fecha } as T;
            byFecha.set(fecha, created);
            upserts.push({ ...incomingRow, fecha });
            continue;
        }

        const patch = { fecha } as Partial<T> & { fecha: string };
        let changed = false;

        for (const [key, value] of Object.entries(incomingRow as Record<string, unknown>)) {
            if (IGNORED_KEYS.has(key) || isAbsent(value)) continue;

            const previous = (current as Record<string, unknown>)[key];
            if (valuesEqual(previous, value)) continue;

            (patch as Record<string, unknown>)[key] = value;
            (current as Record<string, unknown>)[key] = value;
            changed = true;
        }

        if (changed) upserts.push(patch);
    }

    return {
        merged: Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        upserts,
        emptyIncoming: false,
    };
}
