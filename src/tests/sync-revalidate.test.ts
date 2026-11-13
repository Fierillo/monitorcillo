import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSyncAndRefreshSite } from '../lib/sync/revalidate-site';

const originalAdminPassword = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD = 'strong-admin-password';

function successfulReport() {
    return { results: { inflacion: { appended: 1, total: 10 } }, updated: ['inflacion'], failed: [] };
}

beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe('runSyncAndRefreshSite', () => {
    it('posts to the revalidate endpoint after a successful runSync', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
        const runSync = vi.fn().mockResolvedValue(successfulReport());

        const report = await runSyncAndRefreshSite({ runSync, fetch: fetchMock });

        expect(report).toEqual(successfulReport());
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://monitorcillo.fierillo.world/api/revalidate');
        expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error' });
        expect(JSON.parse(init.body)).toEqual({ password: ADMIN_PASSWORD });
    });

    it('does not fail the sync or mark it failed when revalidation fails; it only logs', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
        const log = { error: vi.fn() };
        const runSync = vi.fn().mockResolvedValue(successfulReport());

        const report = await runSyncAndRefreshSite({ runSync, fetch: fetchMock, log });

        expect(report.failed).toEqual([]);
        expect(log.error).toHaveBeenCalled();
        expect(String(log.error.mock.calls[0][0])).toMatch(/revalidat/i);
    });

    it('revalidates when some tasks updated even if others failed', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        const runSync = vi.fn().mockResolvedValue({
            results: {},
            updated: ['inflacion'],
            failed: [{ key: 'emae', error: 'boom' }],
        });

        const report = await runSyncAndRefreshSite({ runSync, fetch: fetchMock, password: 'pw' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(report.failed).toEqual([{ key: 'emae', error: 'boom' }]);
    });

    it('skips revalidation when nothing was updated', async () => {
        const fetchMock = vi.fn();
        const runSync = vi.fn().mockResolvedValue({
            results: {},
            updated: [],
            failed: [{ key: 'inflacion', error: 'boom' }],
        });

        await runSyncAndRefreshSite({ runSync, fetch: fetchMock });

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
