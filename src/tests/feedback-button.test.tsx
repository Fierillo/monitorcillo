import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FeedbackButton from '../components/FeedbackButton';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('FeedbackButton', () => {
    it('submits the message with its page context', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);
        render(<FeedbackButton context={{ surface: 'general_table', path: '/' }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
        fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Agregar otra métrica' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await screen.findByText('Feedback enviado. Gracias por ayudar a mejorar Monitorcillo.');
        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe('/api/feedback');
        expect(JSON.parse(request[1].body)).toEqual({
            message: 'Agregar otra métrica',
            context: { surface: 'general_table', path: '/' },
        });
    });

    it('shows the API rate-limit message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Ya enviaste feedback recientemente. Intentá de nuevo en 5 minutos.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        })));
        render(<FeedbackButton context={{ surface: 'general_table', path: '/' }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
        fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Otro mensaje' } });
        fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!);

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Intentá de nuevo en 5 minutos'));
    });
});
