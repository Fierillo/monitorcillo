'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Indicator } from '@/types';
import { fechaToTimestamp } from '@/lib/normalize/dates';

type ReferenceTooltip = { text: string; x: number; y: number } | null;

const TOOLTIP_WIDTH = 150;
const TOOLTIP_OFFSET = 6;
const MINIMUM_FONT_SIZE = 6;

export function fitTextToWidth(element: HTMLElement, minimumFontSize = MINIMUM_FONT_SIZE): void {
    element.style.fontSize = '';
    let fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
    if (!Number.isFinite(fontSize)) fontSize = 16;

    while (element.scrollWidth > element.clientWidth && fontSize > minimumFontSize) {
        fontSize = Math.max(minimumFontSize, fontSize - 1);
        element.style.fontSize = `${fontSize}px`;
    }
}

export function compactText(value: string): string {
    return value
        .replace('Poder adquisitivo (ajustado por IPC nucleo)', 'Poder adquisitivo')
        .replace('EMAE (Estimador Mensual de Actividad Económica)', 'EMAE')
        .replace('MECON y prensa especializada', 'MECON y prensa')
        .replace('INDEC, Equilibra e IPC Online', 'INDEC y consultoras')
        .replace(/^(USD [\d.]+ M) aprobados$/, '$1')
        .replace('Mismo semestre año anterior', 'Mismo semestre año ant.')
        .replace('Mismo mes año anterior', 'Mismo mes año ant.')
        .replace('Mes anterior desest.', 'Mes anterior desestac.');
}

export function sortIndicatorsByDate(data: Indicator[]): Indicator[] {
    return [...data].sort((first, second) => {
        const firstDate = fechaToTimestamp(first.fecha);
        const secondDate = fechaToTimestamp(second.fecha);
        if (!firstDate) return secondDate ? 1 : 0;
        if (!secondDate) return -1;
        return firstDate - secondDate;
    });
}

function FitText({ children, className = '' }: { children: string; className?: string }) {
    const textRef = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const element = textRef.current;
        if (!element) return;

        const desktop = window.matchMedia('(min-width: 1024px)');
        const fit = () => {
            element.style.fontSize = '';
            if (desktop.matches) fitTextToWidth(element);
        };
        fit();
        desktop.addEventListener('change', fit);
        if (typeof ResizeObserver === 'undefined') return () => desktop.removeEventListener('change', fit);

        const observer = new ResizeObserver(fit);
        observer.observe(element);
        if (element.parentElement) observer.observe(element.parentElement);
        return () => {
            observer.disconnect();
            desktop.removeEventListener('change', fit);
        };
    }, [children]);

    return <span ref={textRef} className={`block w-max min-w-full whitespace-nowrap lg:w-full lg:min-w-0 lg:overflow-hidden ${className}`}>{children}</span>;
}

export default function IndicatorsTable({ data }: { data: Indicator[] }) {
    const [tooltip, setTooltip] = useState<ReferenceTooltip>(null);

    if (!data || data.length === 0) {
        return <div className="text-center p-8 border-2 border-imperial-gold text-imperial-gold font-bold">Sin datos.</div>;
    }

    const rows = sortIndicatorsByDate(data);
    const showReferenceTooltip = (text: string, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
        setTooltip({ text, x: Math.max(TOOLTIP_OFFSET, Math.min(rect.left, maxX)), y: rect.bottom + TOOLTIP_OFFSET });
    };

    return (
        <>
            <div className="overflow-x-auto border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 w-full">
                <table className="w-max min-w-full table-auto border-separate border-spacing-x-1 border-spacing-y-0 text-left lg:w-full lg:min-w-[900px] lg:border-collapse lg:border-spacing-0">
                    <thead>
                        <tr className="h-12 bg-imperial-gold text-imperial-blue text-xs sm:text-base uppercase tracking-wider imperial-title">
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20 whitespace-nowrap lg:overflow-hidden">Fecha</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20 whitespace-nowrap lg:overflow-hidden"><FitText>Próxima</FitText></th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20 whitespace-nowrap lg:overflow-hidden">Fuente</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20 whitespace-nowrap lg:overflow-hidden">Indicador</th>
                            <th scope="col" className="p-3 font-bold border-r border-imperial-blue/20 whitespace-nowrap lg:overflow-hidden">Referencia</th>
                            <th scope="col" className="p-3 font-bold whitespace-nowrap lg:overflow-hidden"><FitText>Último dato</FitText></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => {
                            const source = compactText(row.fuente);
                            const indicator = compactText(row.indicador);
                            const reference = compactText(row.referencia);
                            const value = compactText(row.dato);
                            return (
                                <tr
                                    key={row.id}
                                    className={`h-14 ${i % 2 === 0 ? 'bg-imperial-blue' : 'bg-background'} border-t border-imperial-cyan/30 hover:bg-white/10 transition-colors ${row.hasDetails ? 'hover:border-imperial-gold hover:shadow-inner' : ''}`}
                                >
                                    <td className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-gold font-bold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <FitText>{row.fecha}</FitText>
                                    </td>
                                    <td className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-cyan font-semibold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <span
                                            tabIndex={row.proximaFechaDescription ? 0 : undefined}
                                            onBlur={() => setTooltip(null)}
                                            onFocus={(event) => row.proximaFechaDescription && showReferenceTooltip(row.proximaFechaDescription, event.currentTarget)}
                                            onMouseEnter={(event) => row.proximaFechaDescription && showReferenceTooltip(row.proximaFechaDescription, event.currentTarget)}
                                            onMouseLeave={() => setTooltip(null)}
                                            className="block w-max min-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:w-full lg:min-w-0 lg:overflow-hidden"
                                        >
                                            <FitText>{row.proximaFecha ?? '-'}</FitText>
                                        </span>
                                    </td>
                                    <td title={row.fuente} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base font-semibold whitespace-nowrap align-middle text-white lg:overflow-hidden">
                                        <FitText>{source}</FitText>
                                    </td>
                                    <td title={row.indicador} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base font-bold whitespace-nowrap align-middle text-white lg:overflow-hidden">
                                        {row.hasDetails ? (
                                            <Link
                                                href={`/indicador/${row.id}`}
                                                className="inline-flex w-max items-center gap-1.5 whitespace-nowrap text-white hover:text-imperial-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:flex lg:w-full lg:min-w-0 lg:max-w-full lg:overflow-hidden"
                                            >
                                                <FitText className="lg:flex-1">{indicator}</FitText>
                                                <span aria-hidden="true" className="shrink-0 text-imperial-gold text-[10px] sm:text-xs border border-imperial-gold px-1 rounded">▼</span>
                                            </Link>
                                        ) : <FitText>{indicator}</FitText>}
                                    </td>
                                    <td title={row.referencia} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-cyan font-semibold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <span
                                            tabIndex={row.referenceDescription ? 0 : undefined}
                                            onBlur={() => setTooltip(null)}
                                            onFocus={(event) => row.referenceDescription && showReferenceTooltip(row.referenceDescription, event.currentTarget)}
                                            onMouseEnter={(event) => row.referenceDescription && showReferenceTooltip(row.referenceDescription, event.currentTarget)}
                                            onMouseLeave={() => setTooltip(null)}
                                            className="block w-max min-w-full whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:w-full lg:min-w-0 lg:overflow-hidden"
                                        >
                                            <FitText>{reference}</FitText>
                                        </span>
                                    </td>
                                    <td title={row.dato} className={`p-2 sm:p-3 text-xs sm:text-sm lg:text-base font-bold whitespace-nowrap align-middle lg:overflow-hidden ${row.trend === 'down' ? 'text-red-500' : 'text-imperial-gold'}`}>
                                        <FitText>{value}</FitText>
                                    </td>
                                </tr>
                            );
                        })}
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
