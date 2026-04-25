'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        if (!res.ok) {
            setError('Credenciales invalidas');
            return;
        }

        router.refresh();
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <form onSubmit={handleSubmit} className="bg-imperial-blue border border-imperial-gold p-8 rounded shadow-lg flex flex-col gap-4">
                <h2 className="text-imperial-gold text-2xl font-bold mb-4 text-center">Panel Imperial</h2>
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="p-2 bg-background text-foreground border border-imperial-cyan outline-none"
                    placeholder="Contraseña"
                />
                {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
                <button type="submit" className="bg-imperial-gold text-background font-bold py-2 mt-2 cursor-pointer hover:bg-yellow-500 transition-colors">
                    Ingresar
                </button>
            </form>
        </div>
    );
}
