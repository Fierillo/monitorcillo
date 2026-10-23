export type SourceStep<T> = { name: string; run: () => Promise<T[]> };

type ChainOptions = {
    /** Oldest acceptable newest period (YYYY-MM-DD); anything older is stale. */
    minLatest: string;
    warn?: (message: string) => void;
};

const newest = (rows: Array<{ fecha: string }>): string => rows.reduce((max, row) => (row.fecha > max ? row.fecha : max), '');

/**
 * Tries each source in order (API -> page -> CSV -> PDF/OCR) and returns the first with current data.
 * A step that throws, returns no rows or only stale rows counts as failed; if all fail, the freshest result is kept.
 */
export async function firstUsable<T extends { fecha: string }>(label: string, steps: SourceStep<T>[], { minLatest, warn = console.warn }: ChainOptions): Promise<T[]> {
    let best: T[] = [];
    const failures: string[] = [];

    for (const step of steps) {
        try {
            const rows = await step.run();
            if (newest(rows) >= minLatest) return rows;
            failures.push(`${step.name}: ${rows.length ? `stale (${newest(rows)})` : 'no rows'}`);
            if (newest(rows) > newest(best)) best = rows;
        } catch (error) {
            failures.push(`${step.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    warn(`[source-chain] ${label}: no source has data since ${minLatest}; using freshest (${newest(best) || 'none'}). ${failures.join('; ')}`);
    return best;
}

export function minLatestPeriod(today: string, releaseLagDays: number): string {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - releaseLagDays);
    return `${date.toISOString().slice(0, 7)}-01`;
}

/** Newest period an official release should already contain: the release month minus the publication lag in months. */
export function minLatestFromRelease(releaseDate: string, periodLagMonths: number): string {
    const date = new Date(`${releaseDate.slice(0, 7)}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - periodLagMonths);
    return date.toISOString().slice(0, 10);
}
