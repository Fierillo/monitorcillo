import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchBufferFromUrl: vi.fn(),
    fetchTextFromUrl: vi.fn(),
    parseEmaeSectorWorkbook: vi.fn(),
    parseEmaeWorkbook: vi.fn(),
    parseLatestPbiWorkbookUrl: vi.fn(),
    parsePbiWorkbook: vi.fn(),
}));

vi.mock('@/lib/sync/http-client', () => ({
    fetchBufferFromUrl: mocks.fetchBufferFromUrl,
    fetchTextFromUrl: mocks.fetchTextFromUrl,
}));
vi.mock('@/lib/emae-source', () => ({
    parseEmaeSectorWorkbook: mocks.parseEmaeSectorWorkbook,
    parseEmaeWorkbook: mocks.parseEmaeWorkbook,
}));
vi.mock('@/lib/pbi-source', () => ({
    parseLatestPbiWorkbookUrl: mocks.parseLatestPbiWorkbookUrl,
    parsePbiWorkbook: mocks.parsePbiWorkbook,
}));

describe('sync cache', () => {
    beforeEach(() => {
        vi.resetModules();
        Object.values(mocks).forEach(mock => mock.mockReset());
    });

    it('removes failed downloads from the cache', async () => {
        const rows = [{ indice_serie_original: 100 }];
        mocks.fetchBufferFromUrl
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce(Buffer.from('workbook'));
        mocks.parseEmaeWorkbook.mockReturnValue(rows);
        const { fetchEmaeWorkbookRows } = await import('@/lib/sync/cache');

        await expect(fetchEmaeWorkbookRows()).rejects.toThrow('network error');
        await expect(fetchEmaeWorkbookRows()).resolves.toBe(rows);
        expect(mocks.fetchBufferFromUrl).toHaveBeenCalledTimes(2);
    });
});
