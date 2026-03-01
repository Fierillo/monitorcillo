'use client';

import { Indicator } from '@/lib/indicators';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface EmisionData {
    fecha: string;
    TOTAL: number;
    ACUMULADO?: number;
    CompraDolares: number;
    TC: number;
    BCRA: number;
    Vencimientos: number;
    Licitado: number;
    Licitaciones: number;
    'Resultado fiscal': number;
}

export default function AdminDashboard({ initialData }: { initialData: Indicator[] }) {
    const router = useRouter();
    const [data, setData] = useState<Indicator[]>(initialData);
    const [msg, setMsg] = useState('');

    // Estado para datos de emisión
    const [emisionData, setEmisionData] = useState<EmisionData[]>([]);
    const [emisionMsg, setEmisionMsg] = useState('');
    const [activeTab, setActiveTab] = useState<'indicadores' | 'emision'>('indicadores');

    // Cargar datos de emisión al montar
    useEffect(() => {
        fetch('/api/data?type=emision')
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    let runningSum = 0;
                    const withTotals = data.data.map((r: any) => {
                        const total = (r.BCRA || 0) + (r.Licitaciones || 0) + (r['Resultado fiscal'] || 0);
                        runningSum += total;
                        return {
                            ...r,
                            CompraDolares: r.CompraDolares || 0,
                            TC: r.TC || 0,
                            Vencimientos: r.Vencimientos || 0,
                            Licitado: r.Licitado || 0,
                            TOTAL: total,
                            ACUMULADO: runningSum
                        };
                    });
                    setEmisionData(withTotals);
                }
            })
            .catch(err => console.error('Error cargando emisión:', err));
    }, []);

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

    const popRow = () => {
        if (data.length === 0) return;
        const newData = [...data];
        newData.pop();
        setData(newData);
    };

    // Funciones para manejar datos de emisión
    const handleEmisionCellChange = (index: number, field: keyof EmisionData, value: string) => {
        const newData = [...emisionData];
        if (field === 'fecha') {
            newData[index] = { ...newData[index], [field]: value };
        } else {
            if (value === '-') {
                newData[index] = { ...newData[index], [field]: '-' as any };
            } else {
                const cleaned = value.replace(/\./g, '');
                const num = isNaN(Number(cleaned)) ? 0 : Number(cleaned);
                newData[index] = { ...newData[index], [field]: num };
            }
            newData[index].BCRA = (Number(newData[index].CompraDolares) || 0) * (Number(newData[index].TC) || 0);
            newData[index].Licitaciones = (Number(newData[index].Vencimientos) || 0) - (Number(newData[index].Licitado) || 0);
            newData[index].TOTAL = (Number(newData[index].BCRA) || 0) + (Number(newData[index].Licitaciones) || 0) + (Number(newData[index]['Resultado fiscal']) || 0);

            // Recalcular el acumulado para toda la serie
            let runningSum = 0;
            for (let j = 0; j < newData.length; j++) {
                runningSum += (Number(newData[j].TOTAL) || 0);
                newData[j].ACUMULADO = runningSum;
            }
        }
        setEmisionData(newData);
    };

    const formatNumber = (val: number | string) => {
        if (val === '-') return '-';
        if (val === 0 || !val) return '0';
        return Number(val).toLocaleString('es-AR');
    };

    const getNextWorkingDate = (prevDateStr: string) => {
        if (!prevDateStr) return '';
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const parts = prevDateStr.toLowerCase().split('-');
        if (parts.length < 2) return '';
        const day = parseInt(parts[0], 10);
        let monthStr = parts[1];
        if (monthStr === 'sept') monthStr = 'sep';
        const month = months.indexOf(monthStr);
        if (month === -1 || isNaN(day)) return '';

        let year = new Date().getFullYear();
        if (parts.length === 3) {
            let y = parseInt(parts[2], 10);
            if (!isNaN(y)) {
                year = y < 100 ? 2000 + y : y;
            }
        } else {
            // Se asume el año 2026 como base predeterminada por su configuración de fines de semana.
            year = 2026;
        }

        const d = new Date(year, month, day);

        const isHoliday = (date: Date) => {
            const dayNum = date.getDate();
            const monthNum = date.getMonth(); // 1 is Feb
            const yearNum = date.getFullYear();
            // Carnavales 2026: Feb 16 and 17
            if (yearNum === 2026 && monthNum === 1 && (dayNum === 16 || dayNum === 17)) return true;
            return false;
        };

        do {
            d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d));

        let nextMonth = months[d.getMonth()];
        if (nextMonth === 'sep' && prevDateStr.toLowerCase().includes('sept')) nextMonth = 'sept';

        if (parts.length === 3) {
            const nextYear = d.getFullYear().toString().slice(-2);
            return `${d.getDate()}-${nextMonth}-${nextYear}`;
        }
        return `${d.getDate()}-${nextMonth}`;
    };

    const addEmisionRow = () => {
        let nextDate = '';
        if (emisionData.length > 0) {
            nextDate = getNextWorkingDate(emisionData[emisionData.length - 1].fecha);
        }
        setEmisionData([...emisionData, {
            fecha: nextDate,
            TOTAL: 0,
            CompraDolares: 0,
            TC: 0,
            BCRA: 0,
            Vencimientos: 0,
            Licitado: 0,
            Licitaciones: 0,
            'Resultado fiscal': 0
        }]);
    };

    const popEmisionRow = () => {
        if (emisionData.length === 0) return;
        const newData = [...emisionData];
        newData.pop();
        setEmisionData(newData);
    };


    async function handleSaveEmision() {
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'emision', data: emisionData })
            });
            if (!res.ok) throw new Error();
            setEmisionMsg('Datos de emisión guardados!');
            setTimeout(() => setEmisionMsg(''), 3000);
        } catch {
            setEmisionMsg('Error al guardar emisión');
        }
    }

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

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-imperial-gold/30">
                <button
                    onClick={() => setActiveTab('indicadores')}
                    className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'indicadores' ? 'text-imperial-gold border-b-2 border-imperial-gold' : 'text-white/50 hover:text-white'}`}
                >
                    Indicadores
                </button>
                <button
                    onClick={() => setActiveTab('emision')}
                    className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'emision' ? 'text-imperial-gold border-b-2 border-imperial-gold' : 'text-white/50 hover:text-white'}`}
                >
                    Emisión / Absorción
                </button>
            </div>

            {activeTab === 'indicadores' ? (
                <div className="mb-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Indicadores</p>
                        <div className="flex gap-4">
                            <button onClick={addRow} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-1 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">
                                + Agregar Fila
                            </button>
                            <button onClick={popRow} className="border border-red-500 text-red-500 font-bold py-1 px-4 cursor-pointer hover:bg-red-500 hover:text-white transition-colors">
                                - Eliminar Fila
                            </button>
                        </div>
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
            ) : (
                <div className="mb-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Emisión / Absorción</p>
                            <p className="text-white/60 text-sm mt-1">Valores en millones de pesos</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">
                                    <th className="p-2 border-r border-imperial-blue/20">Fecha</th>
                                    <th className="p-2 border-r border-imperial-blue/20" title="Acumulado Histórico">ACUMULADO</th>
                                    <th className="p-2 border-r border-imperial-blue/20">TOTAL</th>
                                    <th className="p-2 border-r border-imperial-blue/20" title="Compra de dólares">Compra(u$s)</th>
                                    <th className="p-2 border-r border-imperial-blue/20">TC</th>
                                    <th className="p-2 border-r border-imperial-blue/20" title="Emisión ARS">Emisión BCRA</th>
                                    <th className="p-2 border-r border-imperial-blue/20">Vencimientos</th>
                                    <th className="p-2 border-r border-imperial-blue/20">Licitado</th>
                                    <th className="p-2 border-r border-imperial-blue/20" title="Sobrante ARS">Sobrante</th>
                                    <th className="p-2 border-r border-imperial-blue/20">R. Fiscal</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm bg-imperial-blue">
                                {emisionData.map((row, i) => (
                                    <tr key={i} className="border-t border-imperial-cyan/30">
                                        <td className="p-1 border-r border-imperial-cyan/30">
                                            <input
                                                type="text"
                                                value={row.fecha}
                                                onChange={e => handleEmisionCellChange(i, 'fecha', e.target.value)}
                                                className="w-20 bg-transparent text-imperial-gold font-bold p-1 outline-none text-center"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30">
                                            <input
                                                type="text"
                                                value={formatNumber(row.ACUMULADO || 0)}
                                                readOnly
                                                className="w-full bg-transparent text-red-500 font-bold p-1 outline-none pointer-events-none text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30">
                                            <input
                                                type="text"
                                                value={formatNumber(row.TOTAL)}
                                                readOnly
                                                className="w-full bg-transparent text-white/50 font-bold p-1 outline-none pointer-events-none text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 min-w-[90px]">
                                            <input
                                                type="text"
                                                value={formatNumber(row.CompraDolares)}
                                                onChange={e => handleEmisionCellChange(i, 'CompraDolares', e.target.value)}
                                                className="w-full bg-transparent text-white font-bold p-1 outline-none hover:bg-white/5 focus:bg-white/10 text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 w-16">
                                            <input
                                                type="text"
                                                value={formatNumber(row.TC)}
                                                onChange={e => handleEmisionCellChange(i, 'TC', e.target.value)}
                                                className="w-full bg-transparent text-white font-bold p-1 outline-none hover:bg-white/5 focus:bg-white/10 text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30">
                                            <input
                                                type="text"
                                                value={formatNumber(row.BCRA)}
                                                readOnly
                                                className="w-full bg-transparent text-imperial-cyan font-bold p-1 outline-none pointer-events-none text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 min-w-[100px]">
                                            <input
                                                type="text"
                                                value={formatNumber(row.Vencimientos)}
                                                onChange={e => handleEmisionCellChange(i, 'Vencimientos', e.target.value)}
                                                className="w-full bg-transparent text-white font-bold p-1 outline-none hover:bg-white/5 focus:bg-white/10 text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 min-w-[100px]">
                                            <input
                                                type="text"
                                                value={formatNumber(row.Licitado)}
                                                onChange={e => handleEmisionCellChange(i, 'Licitado', e.target.value)}
                                                className="w-full bg-transparent text-white font-bold p-1 outline-none hover:bg-white/5 focus:bg-white/10 text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 min-w-[100px]">
                                            <input
                                                type="text"
                                                value={formatNumber(row.Licitaciones)}
                                                readOnly
                                                className="w-full bg-transparent text-imperial-cyan font-bold p-1 outline-none pointer-events-none text-right"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-imperial-cyan/30 min-w-[100px]">
                                            <input
                                                type="text"
                                                value={formatNumber(row['Resultado fiscal'])}
                                                onChange={e => handleEmisionCellChange(i, 'Resultado fiscal', e.target.value)}
                                                className="w-full bg-transparent text-white font-bold p-1 outline-none hover:bg-white/5 focus:bg-white/10 text-right"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-4">
                            <button onClick={addEmisionRow} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-2 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">
                                + Agregar Día
                            </button>
                            <button onClick={popEmisionRow} className="border border-red-500 text-red-500 font-bold py-2 px-4 cursor-pointer hover:bg-red-500 hover:text-white transition-colors">
                                - Eliminar Día
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            {emisionMsg && <span className={`font-bold ${emisionMsg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{emisionMsg}</span>}
                            <button onClick={handleSaveEmision} className="bg-imperial-gold text-background font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
