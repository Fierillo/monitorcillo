import { describe, expect, it, vi } from 'vitest';
import { firstUsable, minLatestPeriod } from '@/lib/sync/source-chain';

const rows = (...fechas: string[]) => fechas.map(fecha => ({ fecha }));

describe('firstUsable', () => {
    it('returns the first step whose newest period is current, skipping failed, empty and stale steps', async () => {
        const later = vi.fn();
        const result = await firstUsable('ipc', [
            { name: 'api', run: async () => rows('2026-07-01', '2026-08-01') },
            { name: 'page', run: async () => { throw new Error('Unexpected content type text/html'); } },
            { name: 'csv', run: async () => [] },
            { name: 'pdf', run: async () => rows('2026-09-01') },
            { name: 'ocr', run: later },
        ], { minLatest: '2026-09-01', warn: () => {} });

        expect(result).toEqual(rows('2026-09-01'));
        expect(later).not.toHaveBeenCalled();
    });

    it('keeps the freshest result and warns when every step fails or is stale', async () => {
        const warn = vi.fn();
        const result = await firstUsable('ipc', [
            { name: 'api', run: async () => rows('2026-07-01') },
            { name: 'csv', run: async () => rows('2026-06-01', '2026-08-01') },
            { name: 'pdf', run: async () => { throw new Error('boom'); } },
        ], { minLatest: '2026-09-01', warn });

        expect(result).toEqual(rows('2026-06-01', '2026-08-01'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('ipc'));
    });
});

describe('minLatestPeriod', () => {
    it('is the month that should already be published given the release lag', () => {
        expect(minLatestPeriod('2026-10-22', 45)).toBe('2026-09-01');
        expect(minLatestPeriod('2026-10-10', 45)).toBe('2026-08-01');
    });
});
