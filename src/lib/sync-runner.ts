import type { SyncResults, SyncTask } from '@/types';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runSyncTasks(tasks: SyncTask[]): Promise<SyncResults> {
    const results: SyncResults = {};
    const failures: string[] = [];

    for (const task of tasks) {
        try {
            const result = await task.run();
            if (result.total > 0) results[task.key] = result;
        } catch (error) {
            console.error(`${task.key} error:`, error);
            failures.push(`${task.key}: ${errorMessage(error)}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(`Sync failed for ${failures.join('; ')}`);
    }

    return results;
}
