import { getAdminPassword } from '../auth-token';
import type { SyncRunReport } from '@/types';

export const PRODUCTION_SITE_URL = 'https://monitorcillo.fierillo.world';

type Logger = { error: (...args: unknown[]) => void };

export type RevalidateSiteOptions = {
    fetch?: typeof fetch;
    password?: string | null;
    siteUrl?: string;
    log?: Logger;
};

export async function revalidateSite(options: RevalidateSiteOptions = {}): Promise<void> {
    const password = options.password ?? getAdminPassword();
    const log = options.log ?? console;
    if (!password) {
        log.error('[sync] Skipping site revalidation: ADMIN_PASSWORD is not set');
        return;
    }

    const siteUrl = options.siteUrl ?? PRODUCTION_SITE_URL;
    try {
        const response = await (options.fetch ?? fetch)(`${siteUrl}/api/revalidate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
            redirect: 'error',
        });
        if (!response.ok) {
            log.error(`[sync] Site revalidation failed: HTTP ${response.status}`);
        }
    } catch (error) {
        log.error('[sync] Site revalidation failed:', error);
    }
}

export async function runSyncAndRefreshSite(deps: {
    runSync: () => Promise<SyncRunReport>;
    fetch?: typeof fetch;
    password?: string | null;
    siteUrl?: string;
    log?: Logger;
}): Promise<SyncRunReport> {
    const report = await deps.runSync();
    if (report.updated.length > 0) {
        await revalidateSite(deps);
    }
    return report;
}
