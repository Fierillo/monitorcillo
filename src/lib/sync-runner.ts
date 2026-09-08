import type { SyncFailure, SyncResults, SyncRunReport, SyncTask } from '@/types';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runSyncTasks(tasks: SyncTask[]): Promise<SyncRunReport> {
    const results: SyncResults = {};
    const updated: string[] = [];
    const failed: SyncFailure[] = [];

    for (const task of tasks) {
        try {
            const result = await task.run();
            updated.push(task.key);
            if (result.total > 0) results[task.key] = result;
        } catch (error) {
            const message = errorMessage(error);
            console.error(`${task.key} error:`, error);
            failed.push({ key: task.key, error: message });
        }
    }

    return { results, updated, failed };
}
