import { describe, expect, it } from 'vitest';
import { runSyncTasks } from '../lib/sync-runner';

describe('runSyncTasks', () => {
    it('runs every task and reports successes and failures without stopping', async () => {
        const executed: string[] = [];

        await expect(runSyncTasks([
            {
                key: 'emision',
                run: async () => {
                    executed.push('emision');
                    return { appended: 1, total: 10 };
                },
            },
            {
                key: 'bma',
                run: async () => {
                    executed.push('bma');
                    throw new Error('BCRA failed');
                },
            },
            {
                key: 'recaudacion',
                run: async () => {
                    executed.push('recaudacion');
                    return { appended: 0, total: 20 };
                },
            },
        ])).resolves.toEqual({
            results: {
                emision: { appended: 1, total: 10 },
                recaudacion: { appended: 0, total: 20 },
            },
            updated: ['emision', 'recaudacion'],
            failed: [{ key: 'bma', error: 'BCRA failed' }],
        });

        expect(executed).toEqual(['emision', 'bma', 'recaudacion']);
    });
});
