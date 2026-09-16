'use client';

import { useState } from 'react';
import type { FeedbackRecord } from '@/types';

function sortFeedback(items: FeedbackRecord[]): FeedbackRecord[] {
    return [...items].sort((left, right) => {
        if (left.rejected !== right.rejected) return left.rejected ? 1 : -1;
        return right.createdAt.localeCompare(left.createdAt);
    });
}

function articleTone(feedback: FeedbackRecord): string {
    if (feedback.rejected) return 'border-red-800/45 bg-red-950/35 text-red-200/75';
    if (feedback.implemented) return 'border-imperial-gold/25 bg-imperial-gold/8 text-imperial-gold/70';
    return 'border-imperial-gold/40 bg-imperial-blue text-white';
}

export default function FeedbackList({ data }: { data: FeedbackRecord[] }) {
    const [items, setItems] = useState(() => sortFeedback(data));

    function applyStatus(id: number, status: Pick<FeedbackRecord, 'implemented' | 'rejected'>) {
        setItems(current => sortFeedback(current.map(item => item.id === id ? { ...item, ...status } : item)));
    }

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-imperial-cyan">Feedback recibido</h2>
                <p className="mt-1 text-sm text-white/60">Los rechazados van al final.</p>
            </div>
            {items.length === 0 ? (
                <div className="border border-imperial-gold/40 bg-imperial-blue p-6 text-center font-bold text-white/60">Todavía no hay feedback.</div>
            ) : (
                <div className="grid gap-3">
                    {items.map(feedback => (
                        <FeedbackItem
                            key={feedback.id}
                            feedback={feedback}
                            onStatusChange={status => applyStatus(feedback.id, status)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function FeedbackItem({ feedback, onStatusChange }: { feedback: FeedbackRecord; onStatusChange: (status: Pick<FeedbackRecord, 'implemented' | 'rejected'>) => void }) {
    const environment = feedback.surface === 'general_table' ? 'Tabla general' : 'Gráfico';
    const details = [
        feedback.metricTitle,
        feedback.chartTitle,
        feedback.viewTitle ? `Vista: ${feedback.viewTitle}` : null,
        feedback.modeTitle ? `Modo: ${feedback.modeTitle}` : null,
    ].filter(Boolean);

    async function persist(status: Pick<FeedbackRecord, 'implemented' | 'rejected'>) {
        const previous = { implemented: feedback.implemented, rejected: feedback.rejected };
        onStatusChange(status);
        try {
            const response = await fetch('/api/feedback', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: feedback.id, ...status }),
            });
            if (!response.ok) throw new Error();
        } catch {
            onStatusChange(previous);
        }
    }

    return (
        <article className={`border p-4 ${articleTone(feedback)}`}>
            <div className="flex flex-col gap-2 border-b border-current/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <span className={`inline-block px-2 py-1 text-xs font-bold uppercase tracking-wider ${feedback.rejected ? 'bg-red-900/80 text-red-100/80' : feedback.implemented ? 'bg-imperial-gold/20 text-imperial-gold/80' : 'bg-red-800 text-white'}`}>{environment}</span>
                    {details.length > 0 ? <p className={`mt-2 text-sm font-bold ${feedback.rejected ? 'text-red-300/70' : feedback.implemented ? 'text-imperial-gold/65' : 'text-imperial-cyan'}`}>{details.join(' · ')}</p> : null}
                    <p className="mt-1 text-xs opacity-50">{feedback.path}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <input
                            type="checkbox"
                            checked={feedback.implemented}
                            onChange={event => persist({ implemented: event.target.checked, rejected: false })}
                            className="size-4 accent-imperial-gold"
                        />
                        Implementado
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <input
                            type="checkbox"
                            checked={feedback.rejected}
                            onChange={event => persist({ implemented: false, rejected: event.target.checked })}
                            className="size-4 accent-red-700"
                        />
                        Rechazado
                    </label>
                    <time className="text-xs font-bold" dateTime={feedback.createdAt}>
                        {new Date(feedback.createdAt).toLocaleString('es-AR')}
                    </time>
                </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{feedback.message}</p>
            {feedback.twitterHandle ? (
                <p className="mt-2 text-sm">
                    <a
                        href={`https://x.com/${feedback.twitterHandle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold hover:underline"
                    >
                        @{feedback.twitterHandle}
                    </a>
                </p>
            ) : null}
        </article>
    );
}
