import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { getFeedback, saveFeedback, setFeedbackStatus } from '../lib/db/feedback';

beforeEach(() => {
    database.query.mockReset();
});

describe('feedback database', () => {
    it('stores context and returns newest feedback first', async () => {
        database.query.mockResolvedValue([]);
        await saveFeedback({
            message: 'Revisar escala',
            context: { surface: 'chart', path: '/indicador/emae', metricId: 'emae', metricTitle: 'EMAE' },
        });

        const insertCall = database.query.mock.calls.find(([query]) => String(query).includes('INSERT INTO feedback'));
        expect(insertCall?.[1]).toEqual(['Revisar escala', 'chart', '/indicador/emae', 'emae', 'EMAE', null, null, null, null, null, null]);

        database.query.mockResolvedValueOnce([{
            id: 4,
            message: 'Revisar escala',
            surface: 'chart',
            path: '/indicador/emae',
            metric_id: 'emae',
            metric_title: 'EMAE',
            created_at: '2026-08-25T12:00:00.000Z',
        }]);

        await expect(getFeedback()).resolves.toEqual([expect.objectContaining({
            id: 4,
            message: 'Revisar escala',
            metricId: 'emae',
            createdAt: '2026-08-25T12:00:00.000Z',
            implemented: false,
            rejected: false,
        })]);
        expect(database.query).toHaveBeenLastCalledWith('SELECT * FROM feedback ORDER BY rejected ASC, created_at DESC', []);
    });

    it('stores an optional twitter handle', async () => {
        database.query.mockResolvedValue([]);
        await saveFeedback({
            message: 'Revisar escala',
            twitterHandle: 'fierillo',
            context: { surface: 'general_table', path: '/' },
        });
        const insertCall = database.query.mock.calls.find(([query]) => String(query).includes('INSERT INTO feedback'));
        expect(insertCall?.[1]?.at(-1)).toBe('fierillo');
    });

    it('updates the implemented flag', async () => {
        database.query.mockResolvedValue([{ id: 4 }]);
        await expect(setFeedbackStatus(4, { implemented: true })).resolves.toBe(true);
        const updateCall = database.query.mock.calls.find(([query]) => String(query).includes('UPDATE feedback'));
        expect(updateCall?.[0]).toContain('implemented = $1');
        expect(updateCall?.[0]).toContain('rejected = $2');
        expect(updateCall?.[1]).toEqual([true, false, 4]);
    });

    it('marks feedback as rejected and clears implemented', async () => {
        database.query.mockResolvedValue([{ id: 4 }]);
        await expect(setFeedbackStatus(4, { rejected: true })).resolves.toBe(true);
        const updateCall = database.query.mock.calls.find(([query]) => String(query).includes('UPDATE feedback'));
        expect(updateCall?.[1]).toEqual([false, true, 4]);
    });
});
