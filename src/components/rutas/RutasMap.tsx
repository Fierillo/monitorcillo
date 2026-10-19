'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import MethodologySection from '@/components/chart/MethodologySection';
import FeedbackButton from '@/components/FeedbackButton';
import geometryAsset from '@/lib/rutas/geometry.json';
import {
    CONCESSION_COLORS,
    CONCESSION_LABELS,
    CONCESSION_SOURCE_NOTE,
    PAVEMENT_COLORS,
    PAVEMENT_LABELS,
    PAVEMENT_SOURCE_NOTE,
    RUTAS_METHODOLOGY,
    frameMapSize,
    paintRoutes,
    projectMap,
    routeSign,
    type ColorMode,
    type PaintedRoute,
    type RutaTramo,
    type RutasGeometry,
} from '@/lib/rutas/status';

const STORED_GEOMETRY = geometryAsset as RutasGeometry;
const CONCESSION_LEGEND = ['concesionado', 'en-licitacion', 'sin-concesionar', 'sin-dato'] as const;
type ShieldFilter = 'tramos' | 'constructoras';

const TOOLTIP_BACKGROUND = 'rgba(0, 20, 63, 0.4)';
const TOOLTIP_BLUR = 'blur(2px)';
const TOOLTIP_OUTLINE = '3px rgba(0, 0, 0, 0.85)';
const ROUTE_GAP = '#020617';

type PointerTip = { code: string; x: number; y: number };

export default function RutasMap({ tramos, geometry = STORED_GEOMETRY, title = 'Rutas nacionales' }: { tramos: RutaTramo[]; geometry?: RutasGeometry; title?: string }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<ColorMode>('concesion');
    const [hover, setHover] = useState<PointerTip | null>(null);
    const [pinned, setPinned] = useState<PointerTip | null>(null);
    const [filterBy, setFilterBy] = useState<ShieldFilter>('tramos');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const highlighted = highlightedRouteCodes(tramos, filterBy, selected);
    const toggleSelected = (id: string) => {
        setSelected(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const changeFilter = (next: ShieldFilter) => {
        setFilterBy(next);
        setSelected(new Set());
    };
    const painted = paintRoutes(geometry.routes, tramos, mode);
    const canvas = frameMapSize(geometry.outline, painted, 1000);
    const projected = projectMap(geometry.outline, painted, canvas.width, canvas.height);
    const activeTip = hover ?? pinned;
    const active = painted.find(route => route.code === activeTip?.code) ?? null;
    const legend = mode === 'concesion'
        ? CONCESSION_LEGEND.map(status => ({ status, color: CONCESSION_COLORS[status], label: CONCESSION_LABELS[status] }))
        : (['bueno', 'regular', 'malo', 'sin-dato'] as const).map(status => ({ status, color: PAVEMENT_COLORS[status], label: PAVEMENT_LABELS[status] }));

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-2 sm:p-6 lg:p-10">
            <header className="w-full sm:w-[96%] max-w-[1320px] mb-4 border-b-2 border-imperial-gold pb-4 mt-2 flex flex-col items-start gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                <div className="flex w-full items-stretch justify-end gap-2 sm:w-auto">
                    <FeedbackButton context={{ surface: 'chart', path: '/indicador/rutas-nacionales', metricId: 'rutas-nacionales', metricTitle: title, modeId: mode, modeTitle: mode === 'concesion' ? 'Concesión' : 'Pavimento' }} />
                    <Link href="/" className="flex shrink-0 items-center justify-center border-2 border-imperial-gold px-3 py-1 text-xs font-bold uppercase text-imperial-gold transition-colors hover:bg-imperial-gold hover:text-imperial-blue sm:px-4 sm:py-2 sm:text-base">Volver</Link>
                </div>
                <div>
                    <h1 className="imperial-title text-xl sm:text-3xl font-bold text-imperial-gold">{title}</h1>
                    <p className="text-imperial-cyan mt-1 text-xs sm:text-base font-bold">Dirección Nacional de Vialidad</p>
                </div>
            </header>

            <div data-testid="rutas-map" className="w-full sm:w-[96%] max-w-[1320px] border-2 border-imperial-gold bg-imperial-blue p-3 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div role="group" aria-label="Modo de color" className="flex gap-2">
                        <ModeButton active={mode === 'concesion'} onClick={() => setMode('concesion')}>Concesión</ModeButton>
                        <ModeButton active={mode === 'pavimento'} onClick={() => setMode('pavimento')}>Pavimento</ModeButton>
                    </div>
                    <ul aria-label="Referencias" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white">
                        {legend.map(item => (
                            <li key={item.status} className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-6" style={{ backgroundColor: item.color }} />
                                {item.label}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div ref={mapRef} className="relative min-w-0 flex-1">
                <svg viewBox={projected.viewBox} role="group" aria-label="Mapa de rutas nacionales de Argentina" className="block h-auto w-full bg-background">
                    {projected.outlinePaths.map((path, index) => (
                        <path key={`outline-${index}`} d={path} fill="#0B2A66" stroke="#FFD700" strokeWidth={1} />
                    ))}
                    {projected.routes.map(route => (
                        <g
                            key={route.code}
                            role="button"
                            tabIndex={0}
                            aria-label={route.label}
                            stroke={route.color}
                            opacity={highlighted && !highlighted.has(route.code) ? 0.22 : 1}
                            className="cursor-pointer"
                            onPointerEnter={(event) => setHover({ code: route.code, ...tipAt(event, mapRef.current) })}
                            onPointerMove={(event) => setHover({ code: route.code, ...tipAt(event, mapRef.current) })}
                            onPointerLeave={() => setHover(current => current?.code === route.code ? null : current)}
                            onClick={(event) => setPinned({ code: route.code, ...tipAt(event, mapRef.current) })}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                setPinned({ code: route.code, x: 24, y: 24 });
                            }}
                        >
                            <path d={route.paths.join('')} stroke="transparent" strokeWidth={18} fill="none" pointerEvents="stroke" />
                            <path d={route.paths.join('')} stroke={ROUTE_GAP} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                            <path d={route.paths.join('')} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                        </g>
                    ))}
                </svg>
                {active && activeTip ? <RouteTooltip route={active} x={activeTip.x} y={activeTip.y} /> : null}
                </div>
                <TramoShields tramos={tramos} filterBy={filterBy} selected={selected} onFilter={changeFilter} onToggle={toggleSelected} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-foreground/80">{mode === 'pavimento' ? PAVEMENT_SOURCE_NOTE : CONCESSION_SOURCE_NOTE}</p>
                <MethodologySection methodology={RUTAS_METHODOLOGY} />
            </div>
        </div>
    );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`border-2 px-3 py-1.5 text-xs font-bold uppercase sm:text-sm ${active ? 'border-imperial-gold bg-imperial-gold text-imperial-blue' : 'border-imperial-gold/50 text-imperial-gold'}`}
        >
            {children}
        </button>
    );
}

function highlightedRouteCodes(tramos: RutaTramo[], filterBy: ShieldFilter, selected: Set<string>): Set<string> | null {
    if (selected.size === 0) return null;
    const codes = new Set<string>();
    for (const tramo of tramos) {
        const key = filterBy === 'tramos' ? tramo.id : companyName(tramo);
        if (!selected.has(key)) continue;
        for (const code of tramo.rutas) codes.add(code);
    }
    return codes;
}

function companyName(tramo: RutaTramo): string {
    return tramo.concesionaria.trim() || 'Sin dato';
}

function companiesOf(tramos: RutaTramo[]): { name: string; tramos: RutaTramo[] }[] {
    const groups = new Map<string, RutaTramo[]>();
    for (const tramo of tramos) {
        const name = companyName(tramo);
        const current = groups.get(name) ?? [];
        current.push(tramo);
        groups.set(name, current);
    }
    return [...groups.entries()].map(([name, rows]) => ({ name, tramos: rows }));
}

function TramoShields({ tramos, filterBy, selected, onFilter, onToggle }: { tramos: RutaTramo[]; filterBy: ShieldFilter; selected: Set<string>; onFilter: (next: ShieldFilter) => void; onToggle: (id: string) => void }) {
    const dimOthers = selected.size > 0;
    return (
        <aside aria-label="Tramos" className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-72 lg:overflow-y-auto">
            <div role="group" aria-label="Filtrar por" className="flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-imperial-gold">Filtrar por</p>
                <div className="flex gap-2">
                    <ModeButton active={filterBy === 'tramos'} onClick={() => onFilter('tramos')}>Tramos</ModeButton>
                    <ModeButton active={filterBy === 'constructoras'} onClick={() => onFilter('constructoras')}>Constructoras</ModeButton>
                </div>
            </div>
            {filterBy === 'tramos' ? tramos.map(tramo => {
                const pressed = selected.has(tramo.id);
                return (
                    <div key={tramo.id} className={`border-b border-imperial-gold/30 pb-3 ${dimOthers && !pressed ? 'opacity-40' : 'opacity-100'}`}>
                        <button type="button" aria-label={tramo.nombre} aria-pressed={pressed} onClick={() => onToggle(tramo.id)} className="flex cursor-pointer flex-wrap gap-1 border-0 bg-transparent p-0">
                            {tramo.rutas.map(code => <SignFace key={code} code={code} sign={routeSign(code)} pressed={pressed} />)}
                        </button>
                        {pressed ? <p className="mt-1 text-[11px] leading-tight text-white">{companyName(tramo)}</p> : null}
                    </div>
                );
            }) : companiesOf(tramos).map(company => {
                const pressed = selected.has(company.name);
                return (
                    <div key={company.name} className={`border-b border-imperial-gold/30 pb-3 ${dimOthers && !pressed ? 'opacity-40' : 'opacity-100'}`}>
                        <button type="button" aria-label={`Constructora ${company.name}`} aria-pressed={pressed} onClick={() => onToggle(company.name)} className={`cursor-pointer border-0 bg-transparent p-0 text-left text-xs font-bold text-white ${pressed ? 'text-imperial-gold' : ''}`}>
                            {company.name}
                        </button>
                        {pressed ? company.tramos.map(tramo => (
                            <div key={tramo.id} className="mt-2">
                                <p className="text-[11px] font-bold uppercase text-imperial-gold">{tramo.nombre}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {tramo.rutas.map(code => <SignFace key={code} code={code} sign={routeSign(code)} pressed />)}
                                </div>
                            </div>
                        )) : null}
                    </div>
                );
            })}
        </aside>
    );
}

function SignFace({ code, sign, pressed }: { code: string; sign: 'nacional' | 'provincial'; pressed: boolean }) {
    const stroke = pressed ? '#FFD700' : '#111827';
    const strokeWidth = pressed ? 2.5 : 1.4;
    const fontSize = code.length >= 4 ? 8 : code.length === 3 ? 11 : 14;
    if (sign === 'provincial') {
        return (
            <svg data-sign="provincial" viewBox="0 0 48 48" className="h-11 w-11">
                <circle cx="24" cy="24" r="20" fill="#FFFFFF" stroke={stroke} strokeWidth={strokeWidth} />
                <text x="24" y="25" textAnchor="middle" dominantBaseline="middle" fill="#111827" fontSize={fontSize} fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">{code}</text>
            </svg>
        );
    }
    return (
        <svg data-sign="nacional" viewBox="0 0 48 54" className="h-12 w-10">
            <path d="M7 4h34v24c0 8-8 16-17 22C15 44 7 36 7 28V4z" fill="#FFFFFF" stroke={stroke} strokeWidth={strokeWidth} />
            <text x="24" y="24" textAnchor="middle" dominantBaseline="middle" fill="#111827" fontSize={fontSize} fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">{code}</text>
        </svg>
    );
}

function tipAt(event: { clientX?: number; clientY?: number }, map: HTMLDivElement | null) {
    const rect = map?.getBoundingClientRect();
    const x = rect && event.clientX != null ? event.clientX - rect.left : 16;
    const y = rect && event.clientY != null ? event.clientY - rect.top : 16;
    const width = 280;
    const height = 132;
    const gap = 14;
    if (!rect || rect.width === 0) return { x: x + gap, y: y + gap };
    return {
        x: x + gap + width > rect.width ? Math.max(8, x - width - gap) : x + gap,
        y: y + gap + height > rect.height ? Math.max(8, y - height - gap) : y + gap,
    };
}

function RouteTooltip({ route, x, y }: { route: PaintedRoute; x: number; y: number }) {
    const rows = route.assignments.length > 0 ? route.assignments : [{
        tramo: route.tramo ?? 'Sin dato',
        concesionaria: route.concesionaria,
        statusLabel: route.statusLabel,
        kmLabel: route.kmLabel,
    }];
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-10"
            style={{ left: x, top: y, backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #FFD700', padding: '10px', color: '#FFF', maxWidth: 300, maxHeight: '46vh', overflow: 'hidden', fontSize: '14px', lineHeight: 1.35, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}
        >
            <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '4px', WebkitTextStroke: TOOLTIP_OUTLINE, paintOrder: 'stroke fill' }}>{route.label}</div>
            {rows.map((row, index) => (
                <div key={`${row.tramo}-${index}`} style={index > 0 ? { marginTop: 6, paddingTop: 6, borderTop: '1px solid #666' } : undefined}>
                    <TipRow color={route.color} name="Tramo" value={row.tramo} />
                    <TipRow color={route.color} name="Concesionaria" value={row.concesionaria} />
                    <TipRow color={route.color} name="Estado" value={row.statusLabel} />
                    <TipRow color={route.color} name="Km" value={row.kmLabel} />
                </div>
            ))}
        </div>
    );
}

function TipRow({ color, name, value }: { color: string; name: string; value: string }) {
    const outline = { WebkitTextStroke: TOOLTIP_OUTLINE, paintOrder: 'stroke fill' as const };
    return (
        <div style={{ fontWeight: 'bold' }}>
            <span style={{ color, ...outline }}>{name}: </span>
            <span style={{ color, ...outline }}>{value}</span>
        </div>
    );
}
