import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchTextFromUrl: vi.fn() }));
vi.mock('@/lib/sync/http-client', () => ({ fetchTextFromUrl: mocks.fetchTextFromUrl }));

import { expectedIndecPeriod, firstUsable, minLatestFromRelease, minLatestPeriod } from '@/lib/sync/source-chain';

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

describe('minLatestFromRelease', () => {
    it('is the first day of the release month minus the period lag, across years', () => {
        expect(minLatestFromRelease('2026-11-13', 1)).toBe('2026-10-01');
        expect(minLatestFromRelease('2026-01-31', 1)).toBe('2025-12-01');
        expect(minLatestFromRelease('2026-03-31', 0)).toBe('2026-03-01');
        expect(minLatestFromRelease('2026-02-14', 14)).toBe('2024-12-01');
    });
});

describe('expectedIndecPeriod', () => {
    it('is the month before the latest INDEC release of that report on or before today', async () => {
        mocks.fetchTextFromUrl.mockImplementation(async (url: string) => url.includes('Octubre-2026')
            ? '<div class="nro-dia">15</div><div class="cal-content text-calendario">Sistema de &#237;ndices de precios mayoristas (SIPM). Septiembre de 2026</div>'
            : '');

        await expect(expectedIndecPeriod('indec-sipm', '2026-10-20', 1)).resolves.toBe('2026-09-01');
    });

    it('falls back to the day-lag rule when the calendar is unavailable', async () => {
        mocks.fetchTextFromUrl.mockRejectedValue(new Error('calendar down'));

        await expect(expectedIndecPeriod('indec-sipm', '2026-10-20', 1)).resolves.toBe(minLatestPeriod('2026-10-20', 1));
    });
});
