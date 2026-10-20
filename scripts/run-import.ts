/** Runs a one-off import, logs the upserted row counts and sets a failing exit code on error. */
export function runImport(load: () => Promise<void>, counts: Record<string, number>): void {
    load().then(
        () => console.log(Object.entries(counts).map(([table, rows]) => `${table}: ${rows}`).join('; ') + ' upserted'),
        error => { console.error(error); process.exitCode = 1; },
    );
}
