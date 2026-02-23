'use client';

import { Indicator } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminDashboard({ initialData }: { initialData: Indicator[] }) {
    const router = useRouter();
    const [data, setData] = useState<Indicator[]>(initialData);
    const [msg, setMsg] = useState('');

    async function handleLogout() {
        await fetch('/api/auth', { method: 'DELETE' });
        router.refresh();
    }

    async function handleSave() {
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error();
            setMsg('Guardado con exito!');
            setTimeout(() => setMsg(''), 3000);
            router.refresh();
        } catch {
            setMsg('Error de Red al guardar');
        }
    }

    const handleCellChange = (index: number, field: keyof Indicator, value: string | boolean) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [field]: value };
        setData(newData);
    };

    const addRow = () => {
        setData([...data, {
            id: Date.now().toString(),
            fecha: '',
            fuente: '',
            indicador: '',
            referencia: '',
            dato: '',
            trend: 'neutral',
            hasDetails: false
        }]);
    };

    const deleteRow = (index: number) => {
        const newData = [...data];
        newData.splice(index, 1);
        setData(newData);
    };

    return (
        <div className="p-8 text-foreground bg-background min-h-screen">
            <div className="flex justify-between items-center mb-6 border-b-2 border-imperial-gold pb-4">
                <h1 className="text-imperial-gold text-3xl font-bold uppercase tracking-widest">Dashboard Imperial</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-900 border border-red-500 text-white px-4 py-2 font-bold cursor-pointer hover:bg-red-800 transition-colors uppercase"
                >
                    Cerrar Sesión
                </button>
            </div>

            <div className="mb-4 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Indicadores</p>
                    <button onClick={addRow} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-1 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">
                        + Agregar Fila
                    </button>
                </div>

                <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">
                                <th className="p-2 border-r border-imperial-blue/20">Fecha</th>
                                <th className="p-2 border-r border-imperial-blue/20">Fuente</th>
                                <th className="p-2 border-r border-imperial-blue/20">Indicador</th>
                                <th className="p-2 border-r border-imperial-blue/20">Referencia</th>
                                <th className="p-2 border-r border-imperial-blue/20">Dato</th>
                                <th className="p-2 border-r border-imperial-blue/20">Trend</th>
                                <th className="p-2 border-r border-imperial-blue/20">Detalles</th>
                                <th className="p-2">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm bg-imperial-blue">
                            {data.map((row, i) => (
                                <tr key={row.id} className="border-t border-imperial-cyan/30">
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <input type="text" value={row.fecha} onChange={e => handleCellChange(i, 'fecha', e.target.value)} className="w-full bg-transparent text-imperial-gold font-bold p-1 outline-none" />
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <input type="text" value={row.fuente} onChange={e => handleCellChange(i, 'fuente', e.target.value)} className="w-full bg-transparent text-white font-semibold p-1 outline-none" />
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <input type="text" value={row.indicador} onChange={e => handleCellChange(i, 'indicador', e.target.value)} className="w-full bg-transparent text-white font-bold p-1 outline-none" />
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <input type="text" value={row.referencia} onChange={e => handleCellChange(i, 'referencia', e.target.value)} className="w-full bg-transparent text-imperial-cyan p-1 outline-none" />
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <input type="text" value={row.dato} onChange={e => handleCellChange(i, 'dato', e.target.value)} className={`w-full bg-transparent font-bold p-1 outline-none ${row.trend === 'down' ? 'text-red-500' : row.trend === 'up' ? 'text-green-500' : 'text-imperial-gold'}`} />
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30">
                                        <select value={row.trend || 'neutral'} onChange={e => handleCellChange(i, 'trend', e.target.value)} className="w-full bg-background border border-imperial-cyan text-white p-1 outline-none">
                                            <option value="up">Up</option>
                                            <option value="down">Down</option>
                                            <option value="neutral">Neutral</option>
                                        </select>
                                    </td>
                                    <td className="p-1 border-r border-imperial-cyan/30 text-center">
                                        <input type="checkbox" checked={!!row.hasDetails} onChange={e => handleCellChange(i, 'hasDetails', e.target.checked)} className="cursor-pointer" />
                                    </td>
                                    <td className="p-1 text-center">
                                        <button onClick={() => deleteRow(i)} className="text-red-500 font-bold px-2 py-1 hover:bg-white/10 transition-colors">X</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center gap-4 mt-2">
                    <button onClick={handleSave} className="bg-imperial-gold text-background font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">
                        Guardar Cambios
                    </button>
                    {msg && <span className={`font-bold ${msg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{msg}</span>}
                </div>
            </div>
        </div>
    );
}
