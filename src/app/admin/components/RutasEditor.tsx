import type { RutaTramoDraft } from '@/lib/rutas/status';

type Field = keyof RutaTramoDraft;

type Props = {
    data: RutaTramoDraft[];
    msg: string;
    onAdd: () => void;
    onDelete: (index: number) => void;
    onSave: () => void;
    onCellChange: (index: number, field: Field, value: string) => void;
};

const TEXT_FIELDS = [
    ['nombre', 'Nombre'],
    ['rutas', 'Rutas'],
    ['km', 'Km'],
    ['concesionaria', 'Concesionaria'],
    ['fechaTomaPosesion', 'Toma de posesión'],
    ['obrasInicialesPct', '% obras iniciales'],
    ['fechaHabilitacionTarifa', 'Habilitación de tarifa'],
] as const;

export default function RutasEditor({ data, msg, onAdd, onDelete, onSave, onCellChange }: Props) {
    return (
        <div className="mb-4 flex flex-col gap-4">
            <div>
                <p className="text-imperial-cyan font-bold uppercase tracking-widest text-lg">Editor de rutas nacionales</p>
                <p className="text-white/60 text-sm mt-1">Cargá a mano cada tramo. La etapa sale de novedades de Vialidad Nacional y del Boletín Oficial. El pavimento, del Informe Anual 2023-2024 o de una fuente posterior. Rutas: 9, 12, A012. Fechas: AAAA-MM-DD. Dejá vacío lo que no esté publicado.</p>
            </div>
            <div className="flex items-center justify-between gap-4">
                <button type="button" onClick={onAdd} className="bg-imperial-blue border border-imperial-cyan text-imperial-cyan font-bold py-2 px-4 cursor-pointer hover:bg-imperial-cyan hover:text-imperial-blue transition-colors">+ Agregar tramo</button>
                <div className="flex items-center gap-4">
                    {msg ? <span className={`font-bold ${msg === 'Tramos guardados' ? 'text-green-500' : 'text-red-500'}`}>{msg}</span> : null}
                    <button type="button" onClick={onSave} className="bg-imperial-gold text-imperial-blue font-bold py-2 px-6 uppercase cursor-pointer hover:bg-yellow-500 transition-colors">Guardar</button>
                </div>
            </div>
            <div className="overflow-x-auto border-2 border-imperial-gold">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-imperial-gold text-imperial-blue text-sm uppercase tracking-wider">
                            {TEXT_FIELDS.map(([, label]) => <th key={label} className="p-2 border-r border-imperial-blue/20">{label}</th>)}
                            <th className="p-2 border-r border-imperial-blue/20">Etapa</th>
                            <th className="p-2 border-r border-imperial-blue/20">Pavimento</th>
                            <th className="p-2"> </th>
                        </tr>
                    </thead>
                    <tbody className="text-sm bg-imperial-blue">
                        {data.map((row, index) => <RutaRow key={row.id ?? index} row={row} index={index} onCellChange={onCellChange} onDelete={onDelete} />)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RutaRow({ row, index, onCellChange, onDelete }: { row: RutaTramoDraft; index: number; onCellChange: Props['onCellChange']; onDelete: Props['onDelete'] }) {
    const labelFor = (field: string) => `${field} ${row.nombre || index + 1}`;
    return (
        <tr className="border-t border-imperial-cyan/30">
            {TEXT_FIELDS.map(([field, label]) => (
                <td key={field} className="p-1 border-r border-imperial-cyan/30">
                    <input aria-label={labelFor(label)} value={row[field]} onChange={event => onCellChange(index, field, event.target.value)} className="w-full min-w-28 bg-transparent p-1 text-white" />
                </td>
            ))}
            <td className="p-1 border-r border-imperial-cyan/30">
                <select aria-label={labelFor('Etapa')} value={row.etapa} onChange={event => onCellChange(index, 'etapa', event.target.value)} className="w-full bg-imperial-blue p-1 text-white">
                    <option value="concesionado">Concesionado</option>
                    <option value="en-licitacion">En licitación</option>
                    <option value="sin-concesionar">Sin concesionar</option>
                </select>
            </td>
            <td className="p-1 border-r border-imperial-cyan/30">
                <select aria-label={labelFor('Pavimento')} value={row.pavimento} onChange={event => onCellChange(index, 'pavimento', event.target.value)} className="w-full bg-imperial-blue p-1 text-white">
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="malo">Malo</option>
                    <option value="sin-dato">Sin dato</option>
                </select>
            </td>
            <td className="p-1">
                <button type="button" onClick={() => onDelete(index)} className="border border-red-500 px-2 py-1 text-red-500">Eliminar {row.nombre}</button>
            </td>
        </tr>
    );
}
