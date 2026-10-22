import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeedbackList from '../app/admin/components/FeedbackList';

const feedback = {
    id: 3,
    message: 'Fierillo, podrías poner la serie interanual de inflación?',
    surface: 'chart' as const,
    path: '/indicador/inflacion',
    metricTitle: 'Inflación (IPC)',
    createdAt: '2026-09-10T22:00:16.943Z',
    implemented: false,
    rejected: false,
};

describe('admin feedback list', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('shows a twitter handle when the user asked for credits', () => {
        render(<FeedbackList data={[{ ...feedback, twitterHandle: 'fierillo' }]} />);
        expect(screen.getByRole('link', { name: '@fierillo' }).getAttribute('href')).toBe('https://x.com/fierillo');
    });

    it('toggles implemented and persists it', async () => {
        render(<FeedbackList data={[feedback]} />);
        const checkbox = screen.getByRole('checkbox', { name: 'Implementado' }) as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/feedback', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 3, implemented: true, rejected: false }),
        }));
    });

    it('sends rejected feedback to the bottom', async () => {
        const older = { ...feedback, id: 1, message: 'SIPA', createdAt: '2026-09-03T22:57:42.237Z', rejected: false };
        const newer = { ...feedback, id: 2, message: 'Colores', createdAt: '2026-09-10T22:00:16.943Z', rejected: false };
        render(<FeedbackList data={[newer, older]} />);
        const articles = screen.getAllByRole('article');
        expect(articles[0].textContent).toContain('Colores');
        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Rechazado' })[0]);
        await waitFor(() => expect(screen.getAllByRole('article')[1].textContent).toContain('Colores'));
        expect(fetch).toHaveBeenCalledWith('/api/feedback', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 2, implemented: false, rejected: true }),
        });
    });
});
