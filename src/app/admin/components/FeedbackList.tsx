import type { FeedbackRecord } from '@/types';

export default function FeedbackList({ data }: { data: FeedbackRecord[] }) {
    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-imperial-cyan">Feedback recibido</h2>
                <p className="mt-1 text-sm text-white/60">Mensajes ordenados desde el más reciente.</p>
            </div>
            {data.length === 0 ? (
                <div className="border border-imperial-gold/40 bg-imperial-blue p-6 text-center font-bold text-white/60">Todavía no hay feedback.</div>
            ) : (
                <div className="grid gap-3">
                    {data.map(feedback => <FeedbackItem key={feedback.id} feedback={feedback} />)}
                </div>
            )}
        </section>
    );
}

function FeedbackItem({ feedback }: { feedback: FeedbackRecord }) {
    const environment = feedback.surface === 'general_table' ? 'Tabla general' : 'Gráfico';
    const details = [
        feedback.metricTitle,
        feedback.chartTitle,
        feedback.viewTitle ? `Vista: ${feedback.viewTitle}` : null,
        feedback.modeTitle ? `Modo: ${feedback.modeTitle}` : null,
    ].filter(Boolean);

    return (
        <article className="border border-imperial-gold/40 bg-imperial-blue p-4 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <span className="inline-block bg-red-800 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">{environment}</span>
                    {details.length > 0 ? <p className="mt-2 text-sm font-bold text-imperial-cyan">{details.join(' · ')}</p> : null}
                    <p className="mt-1 text-xs text-white/50">{feedback.path}</p>
                </div>
                <time className="shrink-0 text-xs font-bold text-imperial-gold" dateTime={feedback.createdAt}>
                    {new Date(feedback.createdAt).toLocaleString('es-AR')}
                </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white">{feedback.message}</p>
        </article>
    );
}
