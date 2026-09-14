type LoadingModalProps = {
    message?: string;
    fullscreen?: boolean;
};

export function LoadingSpinner({ className = 'h-8 w-8 border-imperial-gold' }: { className?: string }) {
    return (
        <div
            role="status"
            aria-label="Cargando"
            className={`animate-spin rounded-full border-2 border-t-transparent ${className}`}
        />
    );
}

export default function LoadingModal({ message = 'Cargando...', fullscreen = true }: LoadingModalProps) {
    return (
        <div
            className={`${fullscreen ? 'fixed inset-0 z-[10000]' : 'flex min-h-screen'} flex items-center justify-center bg-background/80 p-4`}
            role="dialog"
            aria-modal="true"
            aria-busy="true"
            aria-label={message}
        >
            <div className="flex flex-col items-center gap-4 border-2 border-imperial-gold bg-imperial-blue px-10 py-8 shadow-lg shadow-black/40">
                <LoadingSpinner className="h-10 w-10 border-imperial-gold" />
                <p className="text-sm font-bold uppercase tracking-widest text-imperial-gold">{message}</p>
            </div>
        </div>
    );
}
