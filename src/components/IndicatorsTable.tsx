'use client';
import { Indicator } from '@/lib/indicators';
import { useRouter } from 'next/navigation';

export default function IndicatorsTable({ data }: { data: Indicator[] }) {
    const router = useRouter();

    if (!data || data.length === 0) {
        return <div className="text-center p-8 border-2 border-imperial-gold text-imperial-gold font-bold">Sin datos.</div>;
    }

    return (
        <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-imperial-gold text-imperial-blue text-sm sm:text-base uppercase tracking-wider">
                        <th className="p-3 font-bold border-r border-imperial-blue/20">Fecha</th>
                        <th className="p-3 font-bold border-r border-imperial-blue/20">Fuente</th>
                        <th className="p-3 font-bold border-r border-imperial-blue/20">Indicador</th>
                        <th className="p-3 font-bold border-r border-imperial-blue/20">Referencia</th>
                        <th className="p-3 font-bold">Dato</th>
                    </tr>
                </thead>
                <tbody className="text-sm sm:text-base">
                    {data.map((row, i) => (
                        <tr
                            key={row.id}
                            onClick={() => row.hasDetails && router.push(`/indicador/${row.id}`)}
                            className={`${i % 2 === 0 ? 'bg-imperial-blue' : 'bg-background'} border-t border-imperial-cyan/30 hover:bg-white/10 transition-colors ${row.hasDetails ? 'cursor-pointer hover:border-imperial-gold hover:shadow-inner' : ''}`}
                            title={row.hasDetails ? "Ver detalles del indicador" : ""}
                        >
                            <td className="p-3 text-imperial-gold font-bold whitespace-nowrap">{row.fecha}</td>
                            <td className="p-3 font-semibold whitespace-nowrap text-white">{row.fuente}</td>
                            <td className="p-3 font-bold text-white flex items-center gap-2">
                                {row.indicador}
                                {row.hasDetails && <span className="text-imperial-gold text-xs border border-imperial-gold px-1 rounded">▼</span>}
                            </td>
                            <td className="p-3 text-imperial-cyan font-semibold">{row.referencia}</td>
                            <td className={`p-3 font-bold ${row.trend === 'down' ? 'text-red-500' : row.trend === 'up' ? 'text-green-500' : 'text-imperial-gold'}`}>
                                {row.dato}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
