import type { Indicator } from '@/types';

type Props = {
    data: Indicator[];
    msg: string;
    onAdd: () => void;
    onPop: () => void;
    onSave: () => void;
    onCellChange: (index: number, field: keyof Indicator, value: string | boolean) => void;
};

export default function IndicatorsEditor({ data, msg, onAdd, onPop, onSave, onCellChange }: Props) {
    return (
        <div className="mb-4 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de Indicadores</p>
                <div className="flex gap-4">
                    <button onClick={onAdd} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-1 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">+ Agregar Fila</button>
                    <button onClick={onPop} className="border border-red-500 text-red-500 font-bold py-1 px-4 cursor-pointer hover:bg-red-500 hover:text-white transition-colors">- Eliminar Fila</button>
                </div>
            </div>
            <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">
                            {['Fecha', 'Fuente', 'Indicador', 'Referencia', 'Dato', 'Trend', 'Detalles'].map(label => <th key={label} className="p-2 border-r border-imperial-blue/20">{label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="text-sm bg-imperial-blue">
                        {data.map((row, i) => <IndicatorRow key={row.id} row={row} index={i} onCellChange={onCellChange} />)}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center gap-4 mt-2">
                <button onClick={onSave} className="bg-imperial-gold text-background font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">Guardar Cambios</button>
                {msg && <span className={`font-bold ${msg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{msg}</span>}
            </div>
        </div>
    );
}

function IndicatorRow({ row, index, onCellChange }: { row: Indicator; index: number; onCellChange: Props['onCellChange'] }) {
    return (
        <tr className="border-t border-imperial-cyan/30">
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.fecha} onChange={e => onCellChange(index, 'fecha', e.target.value)} className="w-full bg-transparent text-imperial-gold font-bold p-1 outline-none" /></td>
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.fuente} onChange={e => onCellChange(index, 'fuente', e.target.value)} className="w-full bg-transparent text-white font-semibold p-1 outline-none" /></td>
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.indicador} onChange={e => onCellChange(index, 'indicador', e.target.value)} className="w-full bg-transparent text-white font-bold p-1 outline-none" /></td>
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.referencia} onChange={e => onCellChange(index, 'referencia', e.target.value)} className="w-full bg-transparent text-imperial-cyan p-1 outline-none" /></td>
            <td className="p-1 border-r border-imperial-cyan/30"><input type="text" value={row.dato} onChange={e => onCellChange(index, 'dato', e.target.value)} className={`w-full bg-transparent font-bold p-1 outline-none ${row.trend === 'down' ? 'text-red-500' : 'text-imperial-gold'}`} /></td>
            <td className="p-1 border-r border-imperial-cyan/30">
                <select value={row.trend || 'neutral'} onChange={e => onCellChange(index, 'trend', e.target.value)} className="w-full bg-background border border-imperial-cyan text-white p-1 outline-none">
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                    <option value="neutral">Neutral</option>
                </select>
            </td>
            <td className="p-1 border-r border-imperial-cyan/30 text-center"><input type="checkbox" checked={!!row.hasDetails} onChange={e => onCellChange(index, 'hasDetails', e.target.checked)} className="cursor-pointer" /></td>
        </tr>
    );
}
