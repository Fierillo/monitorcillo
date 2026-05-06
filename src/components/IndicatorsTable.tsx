'use client';
import Link from 'next/link';
import type { Indicator } from '@/types';

export default function IndicatorsTable({ data }: { data: Indicator[] }) {
    if (!data || data.length === 0) {
        return <div className="text-center p-8 border-2 border-imperial-gold text-imperial-gold font-bold">Sin datos.</div>;
    }

    return (
        <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 w-full">
            <table className="min-w-[600px] w-full text-left border-collapse">
                <thead>
                    <tr className="bg-imperial-gold text-imperial-blue text-xs sm:text-base uppercase tracking-wider imperial-title">
                        <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Fecha</th>
                        <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Fuente</th>
                        <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Indicador</th>
                        <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Referencia</th>
                        <th scope="col" className="p-3 font-bold">Dato</th>
                    </tr>
                </thead>
                <tbody className="text-xs sm:text-base">
                    {data.map((row, i) => (
                        <tr
                            key={row.id}
                            className={`${i % 2 === 0 ? 'bg-imperial-blue' : 'bg-background'} border-t border-imperial-cyan/30 hover:bg-white/10 transition-colors ${row.hasDetails ? 'hover:border-imperial-gold hover:shadow-inner' : ''}`}
                        >
                            <td className="p-2 sm:p-3 text-imperial-gold font-bold whitespace-nowrap">{row.fecha}</td>
                            <td className="p-2 sm:p-3 font-semibold whitespace-nowrap text-white">{row.fuente}</td>
                            <td className="p-2 sm:p-3 font-bold text-white flex items-center gap-2">
                                {row.hasDetails ? (
                                    <Link
                                        href={`/indicador/${row.id}`}
                                        className="inline-flex items-center gap-2 text-white hover:text-imperial-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold"
                                    >
                                        {row.indicador}
                                        <span aria-hidden="true" className="text-imperial-gold text-[10px] sm:text-xs border border-imperial-gold px-1 rounded">▼</span>
                                    </Link>
                                ) : row.indicador}
                            </td>
                            <td className="p-2 sm:p-3 text-imperial-cyan font-semibold">
                                <span className="group/reference relative inline-flex items-center focus-within:outline-none">
                                    <span tabIndex={row.referenceDescription ? 0 : undefined} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold">
                                        {row.referencia}
                                    </span>
                                    {row.referenceDescription ? (
                                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-56 -translate-x-1/2 border border-imperial-gold bg-imperial-blue px-3 py-2 text-xs font-bold uppercase tracking-wide text-imperial-gold opacity-0 shadow-lg shadow-imperial-blue/60 transition-opacity duration-75 group-hover/reference:opacity-100 group-focus-within/reference:opacity-100">
                                            {row.referenceDescription}
                                        </span>
                                    ) : null}
                                </span>
                            </td>
                            <td className={`p-2 sm:p-3 font-bold ${row.trend === 'down' ? 'text-red-500' : row.trend === 'up' ? 'text-green-500' : 'text-imperial-gold'}`}>
                                {row.dato}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
