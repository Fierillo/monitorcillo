import { describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { getFeedback, saveFeedback } from '../lib/db/feedback';

describe('feedback database', () => {
    it('stores context and returns newest feedback first', async () => {
        database.query.mockResolvedValue([]);
        await saveFeedback({
            message: 'Revisar escala',
            context: { surface: 'chart', path: '/indicador/emae', metricId: 'emae', metricTitle: 'EMAE' },
        });

        const insertCall = database.query.mock.calls.find(([query]) => String(query).includes('INSERT INTO feedback'));
        expect(insertCall?.[1]).toEqual(['Revisar escala', 'chart', '/indicador/emae', 'emae', 'EMAE', null, null, null, null, null]);

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
        })]);
        expect(database.query).toHaveBeenLastCalledWith('SELECT * FROM feedback ORDER BY created_at DESC', []);
    });
});
