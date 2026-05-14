'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Indicator } from '@/types';

type ReferenceTooltip = { text: string; x: number; y: number } | null;

const TOOLTIP_WIDTH = 150;
const TOOLTIP_OFFSET = 6;

export default function IndicatorsTable({ data }: { data: Indicator[] }) {
    const [tooltip, setTooltip] = useState<ReferenceTooltip>(null);

    if (!data || data.length === 0) {
        return <div className="text-center p-8 border-2 border-imperial-gold text-imperial-gold font-bold">Sin datos.</div>;
    }

    const showReferenceTooltip = (text: string, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
        setTooltip({ text, x: Math.max(TOOLTIP_OFFSET, Math.min(rect.left, maxX)), y: rect.bottom + TOOLTIP_OFFSET });
    };

    return (
        <>
            <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 w-full">
                <table className="min-w-[600px] w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-imperial-gold text-imperial-blue text-xs sm:text-base uppercase tracking-wider imperial-title">
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Fecha</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Próxima</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Fuente</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Indicador</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20">Referencia</th>
                            <th scope="col" className="p-3 font-bold">Ultimo Dato</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs sm:text-base">
                        {data.map((row, i) => (
                            <tr
                                key={row.id}
                                className={`${i % 2 === 0 ? 'bg-imperial-blue' : 'bg-background'} border-t border-imperial-cyan/30 hover:bg-white/10 transition-colors ${row.hasDetails ? 'hover:border-imperial-gold hover:shadow-inner' : ''}`}
                            >
                                <td className="p-2 sm:p-3 text-imperial-gold font-bold whitespace-nowrap">{row.fecha}</td>
                                <td className="p-2 sm:p-3 text-imperial-cyan font-semibold whitespace-nowrap">
                                    <span
                                        tabIndex={row.proximaFechaDescription ? 0 : undefined}
                                        onBlur={() => setTooltip(null)}
                                        onFocus={(event) => row.proximaFechaDescription && showReferenceTooltip(row.proximaFechaDescription, event.currentTarget)}
                                        onMouseEnter={(event) => row.proximaFechaDescription && showReferenceTooltip(row.proximaFechaDescription, event.currentTarget)}
                                        onMouseLeave={() => setTooltip(null)}
                                        className="inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold"
                                    >
                                        {row.proximaFecha ?? '-'}
                                    </span>
                                </td>
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
                                <td className="p-2 sm:p-3 text-imperial-cyan font-semibold align-top">
                                    <span
                                        tabIndex={row.referenceDescription ? 0 : undefined}
                                        onBlur={() => setTooltip(null)}
                                        onFocus={(event) => row.referenceDescription && showReferenceTooltip(row.referenceDescription, event.currentTarget)}
                                        onMouseEnter={(event) => row.referenceDescription && showReferenceTooltip(row.referenceDescription, event.currentTarget)}
                                        onMouseLeave={() => setTooltip(null)}
                                        className="inline-flex max-w-52 focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold"
                                    >
                                        {row.referencia}
                                    </span>
                                </td>
                                <td className={`p-2 sm:p-3 font-bold ${row.trend === 'down' ? 'text-red-500' : 'text-imperial-gold'}`}>
                                    {row.dato}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {tooltip ? (
                <div
                    className="pointer-events-none fixed z-[9999] whitespace-normal border border-imperial-blue/30 bg-imperial-gold text-imperial-blue shadow-md shadow-imperial-blue/50"
                    style={{ left: tooltip.x, top: tooltip.y, width: 150, padding: '3px 5px', fontSize: '10px', lineHeight: '1.15', fontWeight: 700, letterSpacing: 0, textTransform: 'none', transform: 'scale(0.75)', transformOrigin: 'top left' }}
                >
                    {tooltip.text}
                </div>
            ) : null}
        </>
    );
}
