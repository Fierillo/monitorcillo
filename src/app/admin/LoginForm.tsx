'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingModal';

export default function LoginForm() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                body: JSON.stringify({ password })
            });

            if (!res.ok) {
                setError(res.status === 429 ? 'Demasiados intentos. Esperá 5 minutos.' : 'Credenciales invalidas');
                setLoading(false);
                return;
            }

            router.refresh();
        } catch {
            setError('No se pudo iniciar sesión. Intentá de nuevo.');
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <form onSubmit={handleSubmit} className="bg-imperial-blue border border-imperial-gold p-8 rounded shadow-lg flex flex-col gap-4">
                <h2 className="text-imperial-gold text-2xl font-bold mb-4 text-center">Panel Imperial</h2>
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    className="p-2 bg-background text-foreground border border-imperial-cyan outline-none disabled:opacity-60"
                    placeholder="Contraseña"
                />
                {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-imperial-gold text-imperial-blue font-bold py-2 mt-2 cursor-pointer hover:bg-yellow-500 transition-colors disabled:cursor-wait disabled:opacity-80 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <LoadingSpinner className="h-4 w-4 border-imperial-blue" />
                            Ingresando...
                        </>
                    ) : 'Ingresar'}
                </button>
            </form>
        </div>
    );
}
