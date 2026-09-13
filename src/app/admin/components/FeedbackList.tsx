'use client';

import { useState } from 'react';
import type { FeedbackRecord } from '@/types';

export default function FeedbackList({ data }: { data: FeedbackRecord[] }) {
    const [items, setItems] = useState(data);

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-imperial-cyan">Feedback recibido</h2>
                <p className="mt-1 text-sm text-white/60">Mensajes ordenados desde el más reciente.</p>
            </div>
            {items.length === 0 ? (
                <div className="border border-imperial-gold/40 bg-imperial-blue p-6 text-center font-bold text-white/60">Todavía no hay feedback.</div>
            ) : (
                <div className="grid gap-3">
                    {items.map(feedback => (
                        <FeedbackItem
                            key={feedback.id}
                            feedback={feedback}
                            onImplementedChange={implemented => setItems(current => current.map(item => item.id === feedback.id ? { ...item, implemented } : item))}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function FeedbackItem({ feedback, onImplementedChange }: { feedback: FeedbackRecord; onImplementedChange: (implemented: boolean) => void }) {
    const environment = feedback.surface === 'general_table' ? 'Tabla general' : 'Gráfico';
    const details = [
        feedback.metricTitle,
        feedback.chartTitle,
        feedback.viewTitle ? `Vista: ${feedback.viewTitle}` : null,
        feedback.modeTitle ? `Modo: ${feedback.modeTitle}` : null,
    ].filter(Boolean);

    async function handleImplementedChange(implemented: boolean) {
        onImplementedChange(implemented);
        try {
            const response = await fetch('/api/feedback', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: feedback.id, implemented }),
            });
            if (!response.ok) throw new Error();
        } catch {
            onImplementedChange(!implemented);
        }
    }

    return (
        <article className={`border border-imperial-gold/40 bg-imperial-blue p-4 shadow-lg shadow-black/20 ${feedback.implemented ? 'opacity-60' : ''}`}>
            <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <span className="inline-block bg-red-800 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">{environment}</span>
                    {details.length > 0 ? <p className="mt-2 text-sm font-bold text-imperial-cyan">{details.join(' · ')}</p> : null}
                    <p className="mt-1 text-xs text-white/50">{feedback.path}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-imperial-gold">
                        <input
                            type="checkbox"
                            checked={feedback.implemented}
                            onChange={event => handleImplementedChange(event.target.checked)}
                            className="size-4 accent-imperial-gold"
                        />
                        Implementado
                    </label>
                    <time className="text-xs font-bold text-imperial-gold" dateTime={feedback.createdAt}>
                        {new Date(feedback.createdAt).toLocaleString('es-AR')}
                    </time>
                </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white">{feedback.message}</p>
            {feedback.twitterHandle ? (
                <p className="mt-2 text-sm">
                    <a
                        href={`https://x.com/${feedback.twitterHandle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-imperial-gold hover:underline"
                    >
                        @{feedback.twitterHandle}
                    </a>
                </p>
            ) : null}
        </article>
    );
}
