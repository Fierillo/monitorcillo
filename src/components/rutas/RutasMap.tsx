'use client';

import Link from 'next/link';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import MethodologySection from '@/components/chart/MethodologySection';
import FeedbackButton from '@/components/FeedbackButton';
import geometryAsset from '@/lib/rutas/geometry.json';
import {
    CONCESSION_COLORS,
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
const SIN_DATO_OPACITY = 0.2;
const ROUTE_CASING_WIDTH = 3;
const ROUTE_STROKE_WIDTH = 1.5;
type ShieldFilter = 'ninguno' | 'ruta' | 'constructora';

const TOOLTIP_BACKGROUND = 'rgba(0, 20, 63, 0.4)';
const TOOLTIP_BLUR = 'blur(2px)';
const TOOLTIP_OUTLINE = '3px rgba(0, 0, 0, 0.85)';
const ROUTE_GAP = '#020617';

type PointerTip = { code: string; segmentIndex: number | null; x: number; y: number };

export default function RutasMap({ tramos, geometry = STORED_GEOMETRY, title = 'Rutas nacionales' }: { tramos: RutaTramo[]; geometry?: RutasGeometry; title?: string }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<ColorMode>('concesion');
    const [hover, setHover] = useState<PointerTip | null>(null);
    const [pinned, setPinned] = useState<PointerTip | null>(null);
    const [filterBy, setFilterBy] = useState<ShieldFilter>('ninguno');
    const [selected, setSelected] = useState<Set<string>>(new Set());
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
    const trackRoute = (code: string) => ({
        onPointerEnter: (event: PointerEvent) => setHover({ code, segmentIndex: segmentIndexFrom(event.target), ...tipAt(event, mapRef.current) }),
        onPointerMove: (event: PointerEvent) => setHover({ code, segmentIndex: segmentIndexFrom(event.target), ...tipAt(event, mapRef.current) }),
        onPointerLeave: () => setHover(current => current?.code === code ? null : current),
        onClick: (event: PointerEvent) => setPinned({ code, segmentIndex: segmentIndexFrom(event.target), ...tipAt(event, mapRef.current) }),
    });
    const legend = legendFor(filterBy, mode, selected, projected.routes, tramos);

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
                            <li key={item.key} className="flex items-center gap-1.5">
                                <span data-company-color={item.color} className="inline-block h-2.5 w-6" style={{ backgroundColor: item.color }} />
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
                    {projected.routes.map(route => {
                        const missing = indexedSegments(route).filter(entry => entry.segment.concesionaria === 'Sin dato');
                        const known = indexedSegments(route).filter(entry => entry.segment.concesionaria !== 'Sin dato');
                        if (missing.length === 0) return null;
                        const onlyMissing = known.length === 0;
                        return (
                            <g
                                key={onlyMissing ? route.code : `${route.code}-sin-dato`}
                                role={onlyMissing ? 'button' : undefined}
                                tabIndex={onlyMissing ? 0 : undefined}
                                aria-label={onlyMissing ? route.label : undefined}
                                data-route={route.code}
                                stroke={route.color}
                                opacity={routeDimmed(route.code, filterBy, selected) ? 0.14 : 1}
                                className={onlyMissing ? 'cursor-pointer' : undefined}
                                {...trackRoute(route.code)}
                                onKeyDown={onlyMissing ? (event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                    event.preventDefault();
                                    setPinned({ code: route.code, segmentIndex: null, x: 24, y: 24 });
                                } : undefined}
                            >
                                {missing.map(entry => drawSegment(route.code, entry, mode, filterBy, selected))}
                            </g>
                        );
                    })}
                    {projected.routes.map(route => {
                        const known = indexedSegments(route).filter(entry => entry.segment.concesionaria !== 'Sin dato');
                        if (known.length === 0) return null;
                        return (
                            <g
                                key={route.code}
                                role="button"
                                tabIndex={0}
                                aria-label={route.label}
                                data-route={route.code}
                                stroke={route.color}
                                opacity={routeDimmed(route.code, filterBy, selected) ? 0.14 : 1}
                                className="cursor-pointer"
                                {...trackRoute(route.code)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                    event.preventDefault();
                                    setPinned({ code: route.code, segmentIndex: null, x: 24, y: 24 });
                                }}
                            >
                                {known.map(entry => drawSegment(route.code, entry, mode, filterBy, selected))}
                            </g>
                        );
                    })}
                </svg>
                {active && activeTip ? <RouteTooltip route={active} segmentIndex={activeTip.segmentIndex} x={activeTip.x} y={activeTip.y} /> : null}
                </div>
                <RouteBars tramos={tramos} routes={projected.routes} filterBy={filterBy} selected={selected} onFilter={changeFilter} onToggle={toggleSelected} />
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

type DrawnSegment = { tramoId: string | null; concesionaria: string; color: string; paths: string[] };
type IndexedSegment = { segment: DrawnSegment; index: number };

function indexedSegments(route: { segments: DrawnSegment[] }): IndexedSegment[] {
    return route.segments.map((segment, index) => ({ segment, index }));
}

function routeDimmed(code: string, filterBy: ShieldFilter, selected: Set<string>): boolean {
    return filterBy === 'ruta' && selected.size > 0 && !selected.has(code);
}

function drawSegment(code: string, entry: IndexedSegment, mode: ColorMode, filterBy: ShieldFilter, selected: Set<string>) {
    const { segment, index } = entry;
    const missing = segment.concesionaria === 'Sin dato';
    const companyDimmed = filterBy === 'constructora' && selected.size > 0 && !selected.has(segment.concesionaria);
    const stroke = filterBy === 'ninguno' && mode === 'pavimento' && !missing ? undefined : segment.color;
    return (
        <g key={`${code}-${segment.tramoId ?? 'sin-dato'}-${index}`} data-route={code} data-company={segment.concesionaria} data-segment-index={index} opacity={companyDimmed ? 0.12 : missing ? SIN_DATO_OPACITY : 1}>
            <path d={segment.paths.join('')} stroke="transparent" strokeWidth={18} fill="none" pointerEvents="stroke" />
            <path d={segment.paths.join('')} stroke={ROUTE_GAP} strokeWidth={ROUTE_CASING_WIDTH} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            <path d={segment.paths.join('')} stroke={stroke} strokeWidth={ROUTE_STROKE_WIDTH} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        </g>
    );
}

type MapRoute = { code: string; segments: { tramoId: string | null; concesionaria: string; color: string }[] };
type LegendItem = { key: string; color: string; label: string };

function legendFor(filterBy: ShieldFilter, mode: 'concesion' | 'pavimento', selected: Set<string>, routes: MapRoute[], tramos: RutaTramo[]): LegendItem[] {
    const quiet = { key: 'sin-dato', color: CONCESSION_COLORS['sin-dato'], label: 'Sin dato' };
    if (filterBy === 'ninguno') {
        if (mode === 'pavimento') return (['bueno', 'regular', 'malo', 'sin-dato'] as const).map(status => ({ key: status, color: PAVEMENT_COLORS[status], label: PAVEMENT_LABELS[status] }));
        return [...uniqueCompanies(routes.flatMap(route => companiesOnRoute(route.segments))), quiet];
    }
    const companies = companiesOf(tramos, routes);
    if (filterBy === 'ruta') {
        const picked = routes.filter(route => selected.has(route.code));
        return [...uniqueCompanies(picked.flatMap(route => companiesOnRoute(route.segments))), quiet];
    }
    const routesOfCompanies = companies.filter(company => selected.has(company.name)).flatMap(company => company.rutas.map(code => ({
        key: `${company.name}-${code}`,
        color: company.color,
        label: `RN ${code}`,
    })));
    return [...routesOfCompanies, quiet];
}

function uniqueCompanies(companies: { name: string; color: string }[]): LegendItem[] {
    const items: LegendItem[] = [];
    for (const company of companies) {
        if (items.some(item => item.label === company.name)) continue;
        items.push({ key: company.name, color: company.color, label: company.name });
    }
    return items;
}

function RouteBars({ tramos, routes, filterBy, selected, onFilter, onToggle }: { tramos: RutaTramo[]; routes: MapRoute[]; filterBy: ShieldFilter; selected: Set<string>; onFilter: (filter: ShieldFilter) => void; onToggle: (id: string) => void }) {
    const dimOthers = selected.size > 0;
    const companies = companiesOf(tramos, routes);
    return (
        <aside aria-label="Rutas" className="route-scroll flex w-full shrink-0 flex-col gap-1.5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-52 lg:overflow-y-auto">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-imperial-gold">
                Filtrar por
                <select
                    aria-label="Filtrar por"
                    value={filterBy}
                    onChange={(event) => onFilter(event.target.value as ShieldFilter)}
                    className="w-full border border-imperial-gold bg-imperial-blue px-2 py-1.5 text-xs font-bold uppercase text-imperial-gold"
                >
                    <option value="ninguno">Ninguno</option>
                    <option value="ruta">Ruta</option>
                    <option value="constructora">Concesionaria</option>
                </select>
            </label>
            {filterBy === 'ruta' ? routeCodes(tramos).map(code => {
                const pressed = selected.has(code);
                const companiesOnThisRoute = companiesOnRoute(routes.find(route => route.code === code)?.segments ?? []);
                return (
                    <div key={code} className="flex flex-col gap-1">
                        <GoldBar label={`Escudo RN ${code}`} pressed={pressed} dimmed={dimOthers && !pressed} tall onClick={() => onToggle(code)}>
                            <SignFace code={code} sign={routeSign(code)} />
                        </GoldBar>
                        {pressed ? (
                            <ul aria-label={`Concesionarias de RN ${code}`} className="flex flex-col gap-1">
                                {companiesOnThisRoute.map(company => (
                                    <li key={company.name} className="flex items-center gap-1.5 border border-imperial-gold/60 px-1.5 py-1 text-[10px] font-bold uppercase text-imperial-gold">
                                        <span data-company-color={company.color} className="h-3 w-1 shrink-0" style={{ backgroundColor: company.color }} />
                                        <span className="truncate" title={company.name}>{company.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                );
            }) : null}
            {filterBy === 'constructora' ? companies.map(company => {
                const pressed = selected.has(company.name);
                return (
                    <div key={company.name} className="flex flex-col gap-1">
                        <GoldBar label={`Concesionaria ${company.name}`} pressed={pressed} dimmed={dimOthers && !pressed} onClick={() => onToggle(company.name)}>
                            <span data-company-color={company.color} className="h-3 w-1 shrink-0" style={{ backgroundColor: company.color }} />
                            <span className="truncate" title={company.name}>{company.name}</span>
                        </GoldBar>
                        {pressed ? (
                            <ul aria-label={`Rutas de ${company.name}`} className="flex flex-col items-center gap-1">
                                {company.rutas.map(code => (
                                    <li key={code}>
                                        <SignFace code={code} sign={routeSign(code)} />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                );
            }) : null}
        </aside>
    );
}

function GoldBar({ label, pressed, dimmed, tall = false, onClick, children }: { label: string; pressed: boolean; dimmed: boolean; tall?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={`flex w-full items-center gap-1.5 border px-1.5 text-[11px] font-bold uppercase tracking-wide ${tall ? 'justify-center py-1.5' : 'h-8 text-left'} ${pressed ? 'border-imperial-gold bg-imperial-gold text-imperial-blue' : 'border-imperial-gold/80 text-imperial-gold'} ${dimmed ? 'opacity-40' : 'opacity-100'}`}
        >
            {children}
        </button>
    );
}

function routeCodes(tramos: RutaTramo[]): string[] {
    const codes = new Set<string>();
    for (const tramo of tramos) for (const code of tramo.rutas) codes.add(code);
    return [...codes].sort(compareRoutes);
}

function compareRoutes(left: string, right: string): number {
    const leftRank = routeRank(left);
    const rightRank = routeRank(right);
    if (leftRank[0] !== rightRank[0]) return leftRank[0] - rightRank[0];
    if (leftRank[1] !== rightRank[1]) return leftRank[1] - rightRank[1];
    return left.localeCompare(right);
}

function routeRank(code: string): [number, number] {
    const number = Number(code.match(/\d+/)?.[0] ?? 9999);
    const kind = code.startsWith('A') ? 1 : /^\d+V/.test(code) ? 2 : 0;
    return [number, kind];
}

function companiesOnRoute(segments: { tramoId: string | null; concesionaria: string; color: string }[]): { name: string; color: string }[] {
    const rows: { name: string; color: string }[] = [];
    for (const segment of segments) {
        if (!segment.tramoId || rows.some(row => row.name === segment.concesionaria)) continue;
        rows.push({ name: segment.concesionaria, color: segment.color });
    }
    return rows;
}

function companiesOf(tramos: RutaTramo[], routes: { segments: { tramoId: string | null; concesionaria: string; color: string }[] }[]): { name: string; color: string; rutas: string[] }[] {
    const groups = new Map<string, { name: string; color: string; rutas: Set<string> }>();
    for (const tramo of tramos) {
        const name = tramo.concesionaria.trim() || 'Sin dato';
        const current = groups.get(name) ?? { name, color: colorOf(name, routes), rutas: new Set<string>() };
        for (const code of tramo.rutas) current.rutas.add(code);
        groups.set(name, current);
    }
    return [...groups.values()].map(company => ({ name: company.name, color: company.color, rutas: [...company.rutas].sort(compareRoutes) }));
}

function colorOf(name: string, routes: { segments: { concesionaria: string; color: string }[] }[]): string {
    for (const route of routes) {
        const segment = route.segments.find(item => item.concesionaria === name);
        if (segment) return segment.color;
    }
    return '#94A3B8';
}

function SignFace({ code, sign }: { code: string; sign: 'nacional' | 'provincial' }) {
    const fontSize = code.length >= 4 ? 8 : code.length === 3 ? 11 : 14;
    if (sign === 'provincial') {
        return (
            <svg data-sign="provincial" viewBox="0 0 48 48" className="h-16 w-16 shrink-0">
                <circle cx="24" cy="24" r="20" fill="#FFFFFF" stroke="#111827" strokeWidth={1.4} />
                <text x="24" y="25" textAnchor="middle" dominantBaseline="middle" fill="#111827" fontSize={fontSize} fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">{code}</text>
            </svg>
        );
    }
    return (
        <svg data-sign="nacional" viewBox="0 0 48 54" className="h-16 w-14 shrink-0">
            <path d="M7 4h34v24c0 8-8 16-17 22C15 44 7 36 7 28V4z" fill="#FFFFFF" stroke="#111827" strokeWidth={1.4} />
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

function segmentIndexFrom(target: EventTarget | null): number | null {
    const node = target instanceof Element ? target.closest('[data-segment-index]') : null;
    const value = node?.getAttribute('data-segment-index');
    return value == null ? null : Number(value);
}

const TIP_KM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

function RouteTooltip({ route, segmentIndex, x, y }: { route: PaintedRoute; segmentIndex: number | null; x: number; y: number }) {
    const row = tipRow(route, segmentIndex);
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-10"
            style={{ left: x, top: y, backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #FFD700', padding: '10px', color: '#FFF', maxWidth: 300, maxHeight: '46vh', overflow: 'hidden', fontSize: '14px', lineHeight: 1.35, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}
        >
            <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '4px', WebkitTextStroke: TOOLTIP_OUTLINE, paintOrder: 'stroke fill' }}>{route.label}</div>
            <TipRow color={row.color} name="Tramo" value={row.tramo} />
            <TipRow color={row.color} name="Concesionaria" value={row.concesionaria} />
            <TipRow color={row.color} name="Estado" value={row.statusLabel} />
            <TipRow color={row.color} name="Km" value={row.kmLabel} />
        </div>
    );
}

function tipRow(route: PaintedRoute, segmentIndex: number | null): { tramo: string; concesionaria: string; statusLabel: string; kmLabel: string; color: string } {
    const segment = (segmentIndex == null ? null : route.segments[segmentIndex]) ?? route.segments.find(item => item.tramoId) ?? route.segments[0];
    const assignment = segment ? route.assignments.find(item => item.concesionaria === segment.concesionaria && item.tramo === segment.tramo) : undefined;
    if (segment && assignment) return { ...assignment, color: segment.color };
    if (segment) {
        return {
            tramo: segment.tramo ?? 'Sin dato',
            concesionaria: segment.concesionaria,
            statusLabel: segment.concesionaria === 'Sin dato' ? 'Sin dato' : route.statusLabel,
            kmLabel: segment.km == null ? 'Sin dato' : `${TIP_KM.format(segment.km)} km`,
            color: segment.color,
        };
    }
    return {
        tramo: route.tramo ?? 'Sin dato',
        concesionaria: route.concesionaria,
        statusLabel: route.statusLabel,
        kmLabel: route.kmLabel,
        color: route.color,
    };
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
