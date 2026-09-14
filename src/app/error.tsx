'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="imperial-title text-2xl sm:text-3xl font-bold uppercase tracking-widest text-imperial-gold">
                No se pudieron cargar los datos
            </h1>
            <p className="max-w-prose text-sm text-imperial-cyan sm:text-base">
                La base de datos no respondió. Los indicadores siguen guardados: esto es una falla temporal de lectura, no una pérdida de información.
            </p>
            <button
                onClick={reset}
                className="border-2 border-imperial-gold px-4 py-2 text-sm uppercase tracking-widest text-imperial-gold hover:bg-imperial-gold hover:text-background"
            >
                Reintentar
            </button>
        </div>
    );
}
