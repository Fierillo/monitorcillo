'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { EmisionAdminEditableField, EmisionAdminRow, EmisionDataResponse, FeedbackRecord, Indicator } from '@/types';
import type { RutaTramo, RutaTramoDraft } from '@/lib/rutas/status';
import { newEmisionRow, newIndicatorRow, updateEmisionCell, withEmisionTotals } from './admin-utils';
import EmisionEditor from './components/EmisionEditor';
import IndicatorsEditor from './components/IndicatorsEditor';
import FeedbackList from './components/FeedbackList';
import RutasEditor from './components/RutasEditor';

type AdminTab = 'indicadores' | 'emision' | 'rutas' | 'feedback';

function emptyRutaDraft(): RutaTramoDraft {
    return { id: `tramo-${Date.now()}`, nombre: '', rutas: '', km: '', concesionaria: '', fechaTomaPosesion: '', obrasInicialesPct: '', fechaHabilitacionTarifa: '', etapa: 'sin-concesionar', pavimento: 'sin-dato' };
}

function toRutaDraft(tramo: RutaTramo): RutaTramoDraft {
    return {
        id: tramo.id,
        nombre: tramo.nombre,
        rutas: tramo.rutas.join(', '),
        km: tramo.km == null ? '' : String(tramo.km).replace('.', ','),
        concesionaria: tramo.concesionaria,
        fechaTomaPosesion: tramo.fechaTomaPosesion ?? '',
        obrasInicialesPct: tramo.obrasInicialesPct == null ? '' : String(tramo.obrasInicialesPct).replace('.', ','),
        fechaHabilitacionTarifa: tramo.fechaHabilitacionTarifa ?? '',
        etapa: tramo.etapa,
        pavimento: tramo.pavimento,
    };
}

export default function AdminDashboard({ initialData, initialFeedback }: { initialData: Indicator[]; initialFeedback: FeedbackRecord[] }) {
    const router = useRouter();
    const [data, setData] = useState<Indicator[]>(initialData);
    const [msg, setMsg] = useState('');
    const [emisionData, setEmisionData] = useState<EmisionAdminRow[]>([]);
    const [emisionMsg, setEmisionMsg] = useState('');
    const [rutasData, setRutasData] = useState<RutaTramoDraft[]>([]);
    const [rutasStored, setRutasStored] = useState<RutaTramoDraft[]>([]);
    const [rutasMsg, setRutasMsg] = useState('');
    const [activeTab, setActiveTab] = useState<AdminTab>('indicadores');

    useEffect(() => {
        fetch('/api/data?type=emision')
            .then(res => res.json())
            .then((response: EmisionDataResponse) => {
                if (response?.data) setEmisionData(withEmisionTotals(response.data));
            })
            .catch(err => console.error('Error cargando emisión:', err));
        fetch('/api/data?type=rutas')
            .then(res => res.json())
            .then((response: { data?: RutaTramo[] }) => {
                if (!response?.data) return;
                const drafts = response.data.map(toRutaDraft);
                setRutasData(drafts);
                setRutasStored(drafts);
            })
            .catch(err => console.error('Error cargando rutas:', err));
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

    async function handleSaveRutas() {
        try {
            const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'rutas', data: rutasData }) });
            const body = await res.json().catch(() => null) as { error?: string } | null;
            if (!res.ok) throw new Error(body?.error || 'Error al guardar rutas');
            setRutasStored(rutasData);
            setRutasMsg('Tramos guardados');
            setTimeout(() => setRutasMsg(''), 3000);
        } catch (error) {
            setRutasMsg(error instanceof Error ? error.message : 'Error al guardar rutas');
        }
    }

    return (
        <div className="p-8 text-foreground bg-background min-h-screen">
            <div className="flex justify-between items-center mb-6 border-b border-imperial-gold/40 pb-4">
                <h1 className="text-imperial-gold text-3xl font-bold uppercase tracking-widest">Dashboard Imperial</h1>
                <button onClick={handleLogout} className="bg-red-900 border border-red-500 text-imperial-ivory px-4 py-2 font-bold cursor-pointer hover:bg-red-800 transition-colors uppercase">Cerrar Sesión</button>
            </div>

            <AdminTabs activeTab={activeTab} onChange={setActiveTab} />
            {activeTab === 'indicadores' ? (
                <IndicatorsEditor data={data} msg={msg} onAdd={() => setData(prev => [...prev, newIndicatorRow()])} onPop={() => setData(prev => prev.slice(0, -1))} onSave={handleSave} onCellChange={handleCellChange} />
            ) : activeTab === 'emision' ? (
                <EmisionEditor data={emisionData} msg={emisionMsg} onAdd={() => setEmisionData(prev => [...prev, newEmisionRow(prev)])} onPop={() => setEmisionData(prev => prev.slice(0, -1))} onSave={handleSaveEmision} onCellChange={handleEmisionCellChange} />
            ) : activeTab === 'rutas' ? (
                <RutasEditor data={rutasData} stored={rutasStored} msg={rutasMsg} onAdd={() => setRutasData(prev => [...prev, emptyRutaDraft()])} onDelete={index => setRutasData(prev => prev.filter((_, rowIndex) => rowIndex !== index))} onSave={handleSaveRutas} onCellChange={(index, field, value) => setRutasData(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))} />
            ) : <FeedbackList data={initialFeedback} />}
        </div>
    );
}

function AdminTabs({ activeTab, onChange }: { activeTab: AdminTab; onChange: (tab: AdminTab) => void }) {
    return (
        <div className="flex gap-4 mb-6 border-b border-imperial-gold/30">
            <button onClick={() => onChange('indicadores')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'indicadores' ? 'text-imperial-gold border-b border-imperial-gold/40' : 'text-imperial-ivory/50 hover:text-imperial-ivory'}`}>
                Indicadores
            </button>
            <button onClick={() => onChange('emision')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'emision' ? 'text-imperial-gold border-b border-imperial-gold/40' : 'text-imperial-ivory/50 hover:text-imperial-ivory'}`}>
                Emisión / Absorción
            </button>
            <button onClick={() => onChange('rutas')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'rutas' ? 'text-imperial-gold border-b border-imperial-gold/40' : 'text-imperial-ivory/50 hover:text-imperial-ivory'}`}>
                Rutas nacionales
            </button>
            <button onClick={() => onChange('feedback')} className={`py-2 px-4 font-bold uppercase transition-colors ${activeTab === 'feedback' ? 'text-imperial-gold border-b border-imperial-gold/40' : 'text-imperial-ivory/50 hover:text-imperial-ivory'}`}>
                Feedback
            </button>
        </div>
    );
}
