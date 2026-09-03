'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { FeedbackContext } from '@/types';

const MAX_MESSAGE_LENGTH = 500;

export default function FeedbackButton({ context }: { context: FeedbackContext }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    function close() {
        if (isSubmitting) return;
        setIsOpen(false);
        setStatus('');
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setStatus('');

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, context }),
            });
            const body = await response.json() as { error?: string };
            if (!response.ok) {
                setStatus(body.error ?? 'No se pudo enviar el feedback.');
                return;
            }
            setMessage('');
            setStatus('Feedback enviado. Gracias por ayudar a mejorar Monitorcillo.');
        } catch {
            setStatus('No se pudo conectar. Intentá nuevamente.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setStatus('');
                    setIsOpen(true);
                }}
                className="no-capture inline-flex items-center justify-center gap-2 border-2 border-red-400 bg-red-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-700"
                aria-label="Enviar feedback"
            >
                <FeedbackIcon />
                Feedback
            </button>
            {isOpen ? (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => {
                    if (event.target === event.currentTarget) close();
                }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="w-full max-w-lg border-2 border-red-400 bg-imperial-blue p-5 text-left shadow-2xl">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h2 id="feedback-title" className="text-lg font-bold text-white">Enviar feedback</h2>
                                <p className="mt-1 text-sm text-imperial-cyan">Contanos qué viste y qué debería mejorar. Máximo {MAX_MESSAGE_LENGTH} caracteres.</p>
                            </div>
                            <button type="button" onClick={close} className="border border-white/40 px-2 py-1 text-sm font-bold text-white hover:bg-white/10" aria-label="Cerrar formulario">X</button>
                        </div>
                        <form onSubmit={submit}>
                            <label htmlFor="feedback-message" className="mb-2 block text-xs font-bold uppercase tracking-wider text-imperial-gold">Mensaje</label>
                            <textarea
                                id="feedback-message"
                                value={message}
                                onChange={event => setMessage(event.target.value)}
                                minLength={3}
                                maxLength={MAX_MESSAGE_LENGTH}
                                required
                                autoFocus
                                rows={5}
                                className="w-full resize-y border border-imperial-cyan bg-[#000d2a] p-3 text-sm text-white placeholder:text-white/40 focus:border-imperial-gold"
                                placeholder="Ej.: En este gráfico no se distingue la serie..."
                            />
                            <div className="mt-1 text-right text-xs text-white/50">{message.length}/{MAX_MESSAGE_LENGTH}</div>
                            {status ? <p role="status" className={`mt-3 text-sm font-bold ${status.startsWith('Feedback enviado') ? 'text-green-400' : 'text-red-300'}`}>{status}</p> : null}
                            <div className="mt-4 flex justify-end gap-3">
                                <button type="button" onClick={close} disabled={isSubmitting} className="border border-white/40 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">Cancelar</button>
                                <button type="submit" disabled={isSubmitting || message.trim().length < 3} className="bg-red-700 px-5 py-2 text-sm font-bold uppercase text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">
                                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            ) : null}
        </>
    );
}

function FeedbackIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 3h18v14H8l-5 4V3Zm8 3v6h2V6h-2Zm0 8v2h2v-2h-2Z" />
        </svg>
    );
}
