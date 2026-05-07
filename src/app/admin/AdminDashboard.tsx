'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { EmisionAdminEditableField, EmisionAdminRow, EmisionDataResponse, Indicator } from '@/types';
import { newEmisionRow, newIndicatorRow, updateEmisionCell, withEmisionTotals } from './admin-utils';
import EmisionEditor from './components/EmisionEditor';
import IndicatorsEditor from './components/IndicatorsEditor';

type AdminTab = 'indicadores' | 'emision';

export default function AdminDashboard({ initialData }: { initialData: Indicator[] }) {
    const router = useRouter();
    const [data, setData] = useState<Indicator[]>(initialData);
    const [msg, setMsg] = useState('');
    const [emisionData, setEmisionData] = useState<EmisionAdminRow[]>([]);
    const [emisionMsg, setEmisionMsg] = useState('');
    const [activeTab, setActiveTab] = useState<AdminTab>('indicadores');

    useEffect(() => {
        fetch('/api/data?type=emision')
            .then(res => res.json())
            .then((response: EmisionDataResponse) => {
                if (response?.data) setEmisionData(withEmisionTotals(response.data));
            })
            .catch(err => console.error('Error cargando emisión:', err));
    }, []);

    async function handleLogout() {
        await fetch('/api/auth', { method: 'DELETE' });
        router.refresh();
    }

    async function handleSave() {
        try {
            const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error();
            setMsg('Guardado con exito!');
            setTimeout(() => setMsg(''), 3000);
            router.refresh();
        } catch {
            setMsg('Error de Red al guardar');
        }
    }

    async function handleSaveEmision() {
        try {
            const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'emision', data: emisionData }) });
            if (!res.ok) throw new Error();
            setEmisionMsg('Datos de emisión guardados!');
            setTimeout(() => setEmisionMsg(''), 3000);
        } catch {
            setEmisionMsg('Error al guardar emisión');
        }
    }

    const handleCellChange = (index: number, field: keyof Indicator, value: string | boolean) => {
        setData(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const handleEmisionCellChange = (index: number, field: EmisionAdminEditableField, value: string) => {
        setEmisionData(prev => updateEmisionCell(prev, index, field, value));
    };

    return (
        <div className="p-8 text-foreground bg-background min-h-screen">
            <div className="flex justify-between items-center mb-6 border-b-2 border-imperial-gold pb-4">
                <h1 className="text-imperial-gold text-3xl font-bold uppercase tracking-widest">Dashboard Imperial</h1>
                <button onClick={handleLogout} className="bg-red-900 border border-red-500 text-white px-4 py-2 font-bold cursor-pointer hover:bg-red-800 transition-colors uppercase">Cerrar Sesión</button>
            </div>

            <AdminTabs activeTab={activeTab} onChange={setActiveTab} />
            {activeTab === 'indicadores' ? (
                <IndicatorsEditor data={data} msg={msg} onAdd={() => setData(prev => [...prev, newIndicatorRow()])} onPop={() => setData(prev => prev.slice(0, -1))} onSave={handleSave} onCellChange={handleCellChange} />
            ) : (
                <EmisionEditor data={emisionData} msg={emisionMsg} onAdd={() => setEmisionData(prev => [...prev, newEmisionRow(prev)])} onPop={() => setEmisionData(prev => prev.slice(0, -1))} onSave={handleSaveEmision} onCellChange={handleEmisionCellChange} />
            )}
        </div>
    );
}

function AdminTabs({ activeTab, onChange }: { activeTab: AdminTab; onChange: (tab: AdminTab) => void }) {
    return (
        <div className="flex gap-4 mb-6 border-b border-imperial-gold/30">
            <button onClick={() => onChange('indicadores')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'indicadores' ? 'text-imperial-gold border-b-2 border-imperial-gold' : 'text-white/50 hover:text-white'}`}>
                Indicadores
            </button>
            <button onClick={() => onChange('emision')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'emision' ? 'text-imperial-gold border-b-2 border-imperial-gold' : 'text-white/50 hover:text-white'}`}>
                Emisión / Absorción
            </button>
        </div>
    );
}
