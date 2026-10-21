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
        fireEvent.change(screen.getByLabelText('Usuario de X (opcional)'), { target: { value: '@fierillo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await screen.findByText('Feedback enviado. Gracias por ayudar a mejorar Monitorcillo.');
        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe('/api/feedback');
        expect(JSON.parse(request[1].body)).toEqual({
            message: 'Agregar otra métrica',
            twitterHandle: '@fierillo',
            context: { surface: 'general_table', path: '/' },
        });
    });

    it('renders a hidden honeypot field and forwards it when a bot fills it', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { container } = render(<FeedbackButton context={{ surface: 'general_table', path: '/' }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
        const honeypot = container.ownerDocument.querySelector('input[name="website"]') as HTMLInputElement;
        expect(honeypot).not.toBeNull();
        expect(honeypot.tabIndex).toBe(-1);
        expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
        fireEvent.change(honeypot, { target: { value: 'http://spam.example' } });
        fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Agregar otra métrica' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).website).toBe('http://spam.example');
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
