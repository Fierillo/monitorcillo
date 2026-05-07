import type { EmisionAdminEditableField, EmisionAdminRow } from '@/types';
import { formatNumber } from '../admin-utils';

type Props = {
    data: EmisionAdminRow[];
    msg: string;
    onAdd: () => void;
    onPop: () => void;
    onSave: () => void;
    onCellChange: (index: number, field: EmisionAdminEditableField, value: string) => void;
};

const COLUMNS = [
    ['ACUMULADO', true, 'text-red-500'],
    ['TOTAL', true, 'text-white/50'],
    ['CompraDolares', false, 'text-white'],
    ['TC', false, 'text-white'],
    ['BCRA', true, 'text-imperial-cyan'],
    ['Vencimientos', false, 'text-white'],
    ['Licitado', false, 'text-white'],
    ['Licitaciones', true, 'text-imperial-cyan'],
    ['Resultado fiscal', false, 'text-white'],
] as const;

export default function EmisionEditor({ data, msg, onAdd, onPop, onSave, onCellChange }: Props) {
    return (
        <div className="mb-4 flex flex-col gap-4">
            <div><p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Emisión / Absorción</p><p className="text-white/60 text-sm mt-1">Valores en millones de pesos</p></div>
            <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50">
                <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">{['Fecha', ...COLUMNS.map(([key]) => key)].map(label => <th key={label} className="p-2 border-r border-imperial-blue/20">{label}</th>)}</tr></thead>
                    <tbody className="text-sm bg-imperial-blue">{data.map((row, i) => <EmisionRow key={i} row={row} index={i} onCellChange={onCellChange} />)}</tbody>
                </table>
            </div>
            <div className="flex items-center justify-between mt-2">
                <div className="flex gap-4"><button onClick={onAdd} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-2 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">+ Agregar Día</button><button onClick={onPop} className="border border-red-500 text-red-500 font-bold py-2 px-4 cursor-pointer hover:bg-red-500 hover:text-white transition-colors">- Eliminar Día</button></div>
                <div className="flex items-center gap-4">{msg && <span className={`font-bold ${msg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{msg}</span>}<button onClick={onSave} className="bg-imperial-gold text-imperial-blue font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">Guardar</button></div>
            </div>
        </div>
    );
}

function EmisionRow({ row, index, onCellChange }: { row: EmisionAdminRow; index: number; onCellChange: Props['onCellChange'] }) {
    return (
        <tr className="border-t border-imperial-cyan/30">
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.fecha} onChange={e => onCellChange(index, 'fecha', e.target.value)} className="w-24 bg-transparent text-imperial-gold font-bold p-1 outline-none text-center" /></td>
            {COLUMNS.map(([key, readOnly, color]) => <td key={key} className="p-1 border-r border-imperial-cyan/30 min-w-[90px]"><input type="text" value={formatNumber(row[key] || 0)} readOnly={readOnly} onChange={readOnly ? undefined : e => onCellChange(index, key, e.target.value)} className={`w-full bg-transparent ${color} font-bold p-1 outline-none text-right ${readOnly ? 'pointer-events-none' : 'hover:bg-white/5 focus:bg-white/10'}`} /></td>)}
        </tr>
    );
}
