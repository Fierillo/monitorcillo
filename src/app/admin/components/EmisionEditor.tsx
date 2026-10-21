import type { EmisionAdminEditableField, EmisionAdminRow } from '@/types';
import { canEditRollover, formatNumber, formatRollover } from '../admin-utils';

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
    ['TOTAL', true, 'text-imperial-ivory/50'],
    ['CompraDolares', false, 'text-imperial-ivory'],
    ['TC', false, 'text-imperial-ivory'],
    ['BCRA', true, 'text-imperial-cyan'],
    ['Licitado', false, 'text-imperial-ivory'],
    ['Rollover', false, 'text-imperial-ivory'],
    ['Vencimientos', true, 'text-imperial-cyan'],
    ['Licitaciones', true, 'text-imperial-cyan'],
    ['Resultado fiscal', false, 'text-imperial-ivory'],
] as const;

export default function EmisionEditor({ data, msg, onAdd, onPop, onSave, onCellChange }: Props) {
    const actions = <EmisionActions msg={msg} onAdd={onAdd} onPop={onPop} onSave={onSave} />;

    return (
        <div className="mb-4 flex flex-col gap-4">
            <div>
                <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Emisión / Absorción</p>
                <p className="text-imperial-ivory/60 text-sm mt-1">Valores en millones de pesos; rollover en %. Desde el 14/10/2026, vencimientos calculados a partir de licitado y rollover. Los vencimientos anteriores se conservan.</p>
            </div>
            {actions}
            <div className="overflow-x-auto imperial-frame">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">
                            {['Fecha', ...COLUMNS.map(([key]) => key === 'Rollover' ? 'Rollover %' : key)].map(label => (
                                <th key={label} className="p-2 border-r border-imperial-blue/20">{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-sm bg-imperial-blue">
                        {[...data].reverse().map((row, displayIndex) => {
                            const index = data.length - 1 - displayIndex;
                            return <EmisionRow key={index} row={row} index={index} onCellChange={onCellChange} />;
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function EmisionActions({ msg, onAdd, onPop, onSave }: Pick<Props, 'msg' | 'onAdd' | 'onPop' | 'onSave'>) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex gap-4">
                <button onClick={onAdd} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-2 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">
                    + Agregar Día
                </button>
                <button onClick={onPop} className="border border-red-500 text-red-500 font-bold py-2 px-4 cursor-pointer hover:bg-red-500 hover:text-imperial-ivory transition-colors">
                    - Eliminar Día
                </button>
            </div>
            <div className="flex items-center gap-4">
                {msg && <span className={`font-bold ${msg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{msg}</span>}
                <button onClick={onSave} className="bg-imperial-gold text-imperial-blue font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">
                    Guardar
                </button>
            </div>
        </div>
    );
}

function EmisionRow({ row, index, onCellChange }: { row: EmisionAdminRow; index: number; onCellChange: Props['onCellChange'] }) {
    return (
        <tr className="border-t border-imperial-cyan/30">
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.fecha} onChange={e => onCellChange(index, 'fecha', e.target.value)} className="w-24 bg-transparent text-imperial-gold font-bold p-1 outline-none text-center" /></td>
            {COLUMNS.map(([key, computed, color]) => {
                const readOnly = computed || (key === 'Rollover' && !canEditRollover(row));
                const label = key === 'Rollover' ? 'Rollover %' : key;
                return <td key={key} className="p-1 border-r border-imperial-cyan/30 min-w-[90px]"><input type="text" aria-label={`${label} ${row.fecha}`} value={key === 'Rollover' ? formatRollover(row.Rollover) : formatNumber(row[key] || 0)} readOnly={readOnly} onChange={computed || readOnly ? undefined : e => onCellChange(index, key, e.target.value)} className={`w-full bg-transparent ${color} font-bold p-1 outline-none text-right ${readOnly ? 'pointer-events-none' : 'hover:bg-white/5 focus:bg-white/10'}`} /></td>;
            })}
        </tr>
    );
}
