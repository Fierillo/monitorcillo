'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Indicator } from '@/types';
import { argentinaToday, fechaToTimestamp } from '@/lib/normalize/dates';
import LoadingModal from '@/components/LoadingModal';

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

type SortKey = 'indicador' | 'fuente' | 'fecha' | 'proximaFecha' | 'referencia' | 'dato';
type SortDirection = 'ascending' | 'descending';
type Sort = { key: SortKey; direction: SortDirection };

const COLUMNS: { key: SortKey; label: string; fit?: boolean }[] = [
    { key: 'indicador', label: 'Indicador' },
    { key: 'fuente', label: 'Fuente' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'proximaFecha', label: 'Próxima', fit: true },
    { key: 'referencia', label: 'Referencia' },
    { key: 'dato', label: 'Último dato', fit: true },
];

/** Comparable value of a cell: dates as timestamps, values by their first number, the rest as text; null sorts last. */
function sortValue(row: Indicator, key: SortKey): number | string | null {
    const text = row[key] ?? '';
    if (key === 'fecha' || key === 'proximaFecha') return fechaToTimestamp(text) || null;
    if (key === 'dato') {
        const number = text.match(/-?\d[\d.]*(?:,\d+)?/)?.[0];
        return number ? Number(number.replace(/\./g, '').replace(',', '.')) : null;
    }
    return text || null;
}

function sortIndicators(data: Indicator[], { key, direction }: Sort): Indicator[] {
    const sign = direction === 'ascending' ? 1 : -1;
    return [...data].sort((first, second) => {
        const a = sortValue(first, key);
        const b = sortValue(second, key);
        if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
        return sign * (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es'));
    });
}

export function sortIndicatorsByDate(data: Indicator[]): Indicator[] {
    return sortIndicators(data, { key: 'fecha', direction: 'ascending' });
}

/** Ids of the non-daily indicators published today (Buenos Aires) or, failing that, with the soonest next release from today on. */
function nextReleaseIds(data: Indicator[]): Set<string> {
    const todayIso = argentinaToday();
    const nonDaily = data.filter(row => !row.daily);
    const publishedToday = nonDaily.filter(row => row.publishedAt === todayIso);
    if (publishedToday.length > 0) return new Set(publishedToday.map(({ id }) => id));

    const today = Date.parse(todayIso);
    const upcoming = nonDaily
        .map(row => ({ id: row.id, date: fechaToTimestamp(row.proximaFecha ?? '') }))
        .filter(({ date }) => date >= today);
    const soonest = Math.min(...upcoming.map(({ date }) => date));
    return new Set(upcoming.filter(({ date }) => date === soonest).map(({ id }) => id));
}

function isModifiedNavigation(event: React.MouseEvent): boolean {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
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
    const [isNavigating, setIsNavigating] = useState(false);
    const [sort, setSort] = useState<Sort | null>(null);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);

    // Moving a row in the DOM restarts its date's CSS animation; pin every pulse to the page clock so sorting keeps them in phase.
    useLayoutEffect(() => {
        tbodyRef.current?.querySelectorAll('[data-next-release-date]').forEach(date => date.getAnimations?.().forEach(animation => { animation.startTime = 0; }));
    }, [sort, data]);

    if (!data || data.length === 0) {
        return <div className="text-center p-8 border border-imperial-gold/60 text-imperial-gold font-bold">Sin datos.</div>;
    }

    const nextRelease = nextReleaseIds(data);
    const byDate = sortIndicatorsByDate(data);
    const rows = sort
        ? sortIndicators(data, sort)
        : [...byDate.filter(row => nextRelease.has(row.id)), ...byDate.filter(row => !nextRelease.has(row.id))];
    const toggleSort = (key: SortKey) => setSort(current => ({
        key,
        direction: current?.key === key && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));
    const showReferenceTooltip = (text: string, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
        setTooltip({ text, x: Math.max(TOOLTIP_OFFSET, Math.min(rect.left, maxX)), y: rect.bottom + TOOLTIP_OFFSET });
    };

    const tooltipTrigger = (text?: string | null) => ({
        tabIndex: text ? 0 : undefined,
        onBlur: () => setTooltip(null),
        onFocus: (event: React.FocusEvent<HTMLElement>) => text && showReferenceTooltip(text, event.currentTarget),
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) => text && showReferenceTooltip(text, event.currentTarget),
        onMouseLeave: () => setTooltip(null),
    });

    const handleMetricClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (isNavigating) {
            event.preventDefault();
            return;
        }
        if (isModifiedNavigation(event)) return;
        setTooltip(null);
        setIsNavigating(true);
    };

    return (
        <>
            <div
                className="overflow-x-auto imperial-frame w-full"
                inert={isNavigating ? true : undefined}
                aria-busy={isNavigating}
            >
                <table className="w-max min-w-full table-auto border-separate border-spacing-x-1 border-spacing-y-0 text-left lg:w-full lg:min-w-[900px] lg:border-collapse lg:border-spacing-0">
                    <thead>
                        <tr className="h-12 bg-imperial-night text-imperial-gold border-b border-imperial-gold/60 text-xs sm:text-base uppercase tracking-wider imperial-title">
                            {COLUMNS.map(({ key, label, fit }, index) => {
                                const active = sort?.key === key ? sort.direction : undefined;
                                return (
                                    <th key={key} scope="col" aria-sort={active} className={`p-0 font-bold whitespace-nowrap lg:overflow-hidden ${index < COLUMNS.length - 1 ? 'border-r border-imperial-gold/20' : ''}`}>
                                        <button
                                            type="button"
                                            onClick={() => toggleSort(key)}
                                            className="flex w-full items-center gap-1 p-3 text-left uppercase tracking-wider hover:text-imperial-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:overflow-hidden"
                                        >
                                            {fit ? <FitText>{label}</FitText> : label}
                                            {active ? <span data-sort-indicator aria-hidden="true" className="shrink-0 text-[0.7em] text-imperial-gold-light">{active === 'ascending' ? '▲' : '▼'}</span> : null}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody ref={tbodyRef}>
                        {rows.map((row, i) => {
                            const source = compactText(row.fuente);
                            const indicator = compactText(row.indicador);
                            const reference = compactText(row.referencia);
                            const value = compactText(row.dato);
                            return (
                                <tr
                                    key={row.id}
                                    className={`h-14 ${i % 2 === 0 ? 'bg-imperial-blue' : 'bg-imperial-night'} border-t border-imperial-gold/15 hover:bg-imperial-gold/5 transition-colors ${row.hasDetails ? 'hover:border-imperial-gold hover:shadow-inner' : ''}`}
                                >
                                    <td title={row.indicador} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base font-bold whitespace-nowrap align-middle text-imperial-ivory lg:overflow-hidden">
                                        {nextRelease.has(row.id) ? <span className="sr-only">Próximo dato a publicarse</span> : null}
                                        {row.hasDetails ? (
                                            <Link
                                                href={`/indicador/${row.id}`}
                                                onClick={handleMetricClick}
                                                tabIndex={isNavigating ? -1 : undefined}
                                                aria-disabled={isNavigating}
                                                className="inline-flex w-max items-center gap-1.5 whitespace-nowrap text-imperial-ivory hover:text-imperial-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:flex lg:w-full lg:min-w-0 lg:max-w-full lg:overflow-hidden"
                                            >
                                                <FitText className="lg:flex-1">{indicator}</FitText>
                                                <span aria-hidden="true" className="shrink-0 text-imperial-gold text-[10px] sm:text-xs border border-imperial-gold px-1 rounded">▼</span>
                                            </Link>
                                        ) : <FitText>{indicator}</FitText>}
                                    </td>
                                    <td title={row.fuente} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base font-semibold whitespace-nowrap align-middle text-imperial-ivory lg:overflow-hidden">
                                        <FitText>{source}</FitText>
                                    </td>
                                    <td className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-gold font-bold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <span {...tooltipTrigger(row.fechaDescription)} data-next-release-date={nextRelease.has(row.id) || undefined} className="block w-max min-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:w-full lg:min-w-0 lg:overflow-hidden">
                                            <FitText>{row.fecha}</FitText>
                                        </span>
                                    </td>
                                    <td className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-cyan font-semibold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <span
                                            {...tooltipTrigger(row.proximaFechaDescription)}
                                            className="block w-max min-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-imperial-gold lg:w-full lg:min-w-0 lg:overflow-hidden"
                                        >
                                            <FitText>{row.proximaFecha ?? '-'}</FitText>
                                        </span>
                                    </td>
                                    <td title={row.referencia} className="p-2 sm:p-3 text-xs sm:text-sm lg:text-base text-imperial-cyan font-semibold whitespace-nowrap align-middle lg:overflow-hidden">
                                        <span
                                            {...tooltipTrigger(row.referenceDescription)}
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
            {tooltip && !isNavigating ? (
                <div
                    className="pointer-events-none fixed z-[9999] line-clamp-2 whitespace-normal border border-imperial-blue/30 bg-imperial-gold text-imperial-blue shadow-md shadow-imperial-blue/50"
                    style={{ left: tooltip.x, top: tooltip.y, width: 150, padding: '3px 5px', fontSize: '10px', lineHeight: '1.15', fontWeight: 700, letterSpacing: 0, textTransform: 'none', transform: 'scale(0.75)', transformOrigin: 'top left' }}
                >
                    {tooltip.text}
                </div>
            ) : null}
            {isNavigating ? <LoadingModal message="Cargando métrica..." /> : null}
        </>
    );
}
