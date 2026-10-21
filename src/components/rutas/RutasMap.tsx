'use client';

import { memo, useCallback, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import MethodologySection from '@/components/chart/MethodologySection';
import { TOOLTIP_BOX, TOOLTIP_OUTLINE_DARK } from '@/components/chart/ChartTooltip';
import { createHoverTooltipStore, type HoverTooltipStore } from '@/components/chart/hover-tooltip-store';
import { CROSSHAIR_DASH, CROSSHAIR_STROKE, CROSSHAIR_STROKE_WIDTH } from '@/components/chart/crosshair-style';
import { clientOf, localPoint, TOUCH_PRESS_STYLE, useTouchCrosshair } from '@/components/chart/useTouchCrosshair';
import { isTouchPointer, parseViewBox, type CrosshairState } from '@/lib/crosshair';
import IndicatorHeader from '@/components/IndicatorHeader';
import { readStoredConfig, useStoredConfig, writeStoredConfig } from '@/lib/chart-config-store';
import geometryAsset from '@/lib/rutas/geometry.json';
import {
    CONCESSION_COLORS,
    concessionedKm,
    concessionedShare,
    CONCESSION_SOURCE_NOTE,
    PAVEMENT_SOURCE_NOTE,
    RUTAS_METHODOLOGY,
    frameMapSize,
    paintRoutes,
    projectMap,
    routeSign,
    type ConcessionStage,
    type PaintedRoute,
    type ProjectedRoute,
    type ProjectedSegment,
    type RutaTramo,
    type RutasGeometry,
} from '@/lib/rutas/status';
import { routeColors as paletteForRoutes } from '@/lib/rutas/sectors';
import { parseRutasView, RUTAS_VIEW_KEY, type RutasFilter, type RutasView } from '@/lib/rutas/persist';
import { buildHitIndex, nearestInIndex, segmentPicked, toggleSelection, type TramoPick } from '@/lib/rutas/hit';
import { companiesOf, companiesOnRoute, routeCodes, type CompanyRoutes } from '@/lib/rutas/companies';
import { legendFor } from '@/lib/rutas/legend';
import { LEGEND_OUTLINE_COLOR, needsLegendOutline } from '@/lib/color-contrast';
import { tipAt, tipOferta, tipRow } from '@/lib/rutas/tooltip';
import type { RutaOferta } from '@/lib/rutas/ofertas';

const STORED_GEOMETRY = geometryAsset as RutasGeometry;
const DEFAULT_VIEW: RutasView = { mode: 'concesion', filterBy: 'ninguno', selected: [], pick: null };
const GOLD = 'var(--color-imperial-gold)';
const OUTLINE_FILL = '#0B2A66';
const ROUTE_GAP = '#020617';
const SIN_DATO_OPACITY = 0.5;
const DIMMED_ROUTE_OPACITY = 0.14;
const DIMMED_SEGMENT_OPACITY = 0.12;
const ROUTE_CASING_WIDTH = 3;
const ROUTE_STROKE_WIDTH = 1.5;
const HIT_STROKE_WIDTH = 5;
const GAP_DASH = '3 3';
const SHARE_OUTLINE = '1px #000';
const SHARE_FORMAT = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
const KM_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const HOVER_FILTER = 'brightness(1.6)';
const PICKED_FILTER = 'brightness(1.6) drop-shadow(0 0 1.5px #ffffff)';
const HOVER_HIT_PX = 8;
const TEXT_OUTLINE = { WebkitTextStroke: TOOLTIP_OUTLINE_DARK, paintOrder: 'stroke fill' as const };

type HoverTip = { code: string; segmentIndex: number | null };
type Anchor = { x: number; y: number };
/** Where the selection tooltip sits when nothing is hovered and the pick has no click position (sidebar, keyboard, reload). */
const PICK_ANCHOR: Anchor = { x: 24, y: 24 };
type DrawnSegment = { segment: ProjectedSegment; index: number; d: string };
type RouteLayer = { route: ProjectedRoute; missing: DrawnSegment[]; known: DrawnSegment[] };
/** Paint inputs shared by every route; per-route ones (hover, pick, route color) travel as primitives so routes re-render alone. */
type SegmentStyle = { mode: RutasView['mode']; filterBy: RutasFilter; selected: Set<string>; anyPick: boolean; stageById: Map<string, ConcessionStage> };

export default function RutasMap({ tramos, ofertas = [], geometry = STORED_GEOMETRY, title = 'Rutas nacionales' }: { tramos: RutaTramo[]; ofertas?: RutaOferta[]; geometry?: RutasGeometry; title?: string }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [tipStore] = useState(createHoverTooltipStore);
    const [hover, setHover] = useState<HoverTip | null>(null);
    // Mirrors `hover` for the click handler, so route handlers stay stable while the hover moves.
    const hoverRef = useRef<HoverTip | null>(null);
    const [pickAnchor, setPickAnchor] = useState<Anchor | null>(null);
    const [touchInput, setTouchInput] = useState(false);
    const view = useStoredConfig(RUTAS_VIEW_KEY, parseRutasView) ?? DEFAULT_VIEW;
    const { mode, filterBy, pick } = view;
    // Keyed by content: an equal selection written again keeps the same Set, so routes do not redraw.
    const selectedKey = view.selected.join('\u0000');
    const selected = useMemo(() => new Set(selectedKey ? selectedKey.split('\u0000') : []), [selectedKey]);
    // Read the stored view at call time so `save` and `pickTramo` stay stable across stored writes.
    const save = useCallback((patch: Partial<RutasView>) => writeStoredConfig(RUTAS_VIEW_KEY, { ...currentView(), ...patch }), []);

    const painted = useMemo(() => paintRoutes(geometry.routes, tramos, mode), [geometry.routes, tramos, mode]);
    const projected = useMemo(() => {
        const canvas = frameMapSize(geometry.outline, painted, 1000);
        return projectMap(geometry.outline, painted, canvas.width, canvas.height);
    }, [geometry.outline, painted]);
    const stageById = useMemo(() => new Map(tramos.map(tramo => [tramo.id, tramo.etapa])), [tramos]);
    const routeColors = useMemo(() => paletteForRoutes(geometry.routes.map(route => route.code)), [geometry.routes]);
    const share = useMemo(() => concessionedShare(painted, stageById), [painted, stageById]);
    const shareKm = useMemo(() => concessionedKm(painted, stageById), [painted, stageById]);
    const hitIndex = useMemo(() => buildHitIndex(projected.routes), [projected.routes]);
    const layers = useMemo(() => projected.routes.map(layerOf), [projected.routes]);
    const bounds = useMemo(() => parseViewBox(projected.viewBox), [projected.viewBox]);
    const aimAt = (svg: SVGSVGElement, next: CrosshairState) => {
        if (!next.point) return tipStore.clear();
        tipStore.set({ label: 'crosshair', ...tipAt(clientOf(svg, next.point), mapRef.current?.getBoundingClientRect()) });
    };
    const crosshair = useTouchCrosshair({ bounds, onChange: aimAt, tipBottom: () => mapRef.current?.querySelector('[data-crosshair-tip]')?.getBoundingClientRect().bottom ?? null });
    const crosshairPoint = crosshair.state.point;
    const touchHit = useMemo(
        () => crosshairPoint ? nearestInIndex(hitIndex, crosshairPoint, HOVER_HIT_PX / crosshair.state.scale) : null,
        [hitIndex, crosshairPoint, crosshair.state.scale],
    );
    const codes = useMemo(() => routeCodes(tramos), [tramos]);
    const companies = useMemo(() => companiesOf(tramos, projected.routes), [tramos, projected.routes]);
    const legend = useMemo(
        () => legendFor(filterBy, mode, selected, projected.routes.map(route => route.code), companies, routeColors),
        [filterBy, mode, selected, projected.routes, companies, routeColors],
    );

    const pickTramo = useCallback((next: TramoPick) => {
        const { pick, filterBy } = currentView();
        const patch: Partial<RutasView> = { pick: toggleSelection(pick, next) };
        if (next.company !== 'Sin dato' && filterBy === 'ruta') patch.selected = [next.code];
        if (next.company !== 'Sin dato' && filterBy === 'concesionaria') patch.selected = [next.company];
        save(patch);
    }, [save]);
    const toggleSelected = (id: string) => save({ pick: null, selected: selected.has(id) ? view.selected.filter(item => item !== id) : [...view.selected, id] });
    const changeFilter = (next: RutasFilter) => save({ filterBy: next, selected: [], pick: null });

    // Desktop only: on touch the selection never pins a tooltip.
    const pickTip = pick && !touchInput ? pickedTip(painted, pick) : null;
    const activeTip = touchHit ?? hover ?? pickTip;
    const active = painted.find(route => route.code === activeTip?.code) ?? null;
    const hoverTo = (next: HoverTip | null) => {
        hoverRef.current = next;
        setHover(current => current?.code === next?.code && current?.segmentIndex === next?.segmentIndex ? current : next);
    };
    const hoverAt = (event: PointerEvent<SVGSVGElement>) => {
        const hit = hitAt(event, hitIndex);
        if (hit) tipStore.set({ label: `${hit.code}:${hit.segmentIndex}`, ...tipAt(event, mapRef.current?.getBoundingClientRect()) });
        else tipStore.clear();
        hoverTo(hit);
    };
    const leaveMap = (event: PointerEvent<SVGSVGElement>) => {
        if (isTouchPointer(event)) return;
        tipStore.clear();
        hoverTo(null);
    };
    const touchDown = (event: PointerEvent<SVGSVGElement>) => {
        setTouchInput(isTouchPointer(event));
        crosshair.down(event);
    };
    const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (!crosshair.move(event)) hoverAt(event);
    };
    // Stable while only the crosshair or tooltip position moves, so RouteLayers skips those renders.
    const routeHandlers = useMemo<RouteHandlers>(() => ({
        leave: code => {
            if (hoverRef.current?.code === code) hoverRef.current = null;
            setHover(current => current?.code === code ? null : current);
        },
        click: (code, event) => {
            if (touchInput) return;
            const hovered = hoverRef.current;
            const target = hovered?.segmentIndex != null ? hovered : { code, segmentIndex: segmentIndexFrom(event.target) };
            const company = companyAt(painted, target.code, target.segmentIndex);
            if (!company) return;
            setPickAnchor(tipAt(event, mapRef.current?.getBoundingClientRect()));
            pickTramo({ code: target.code, company });
        },
        keyDown: (code, event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            const company = companyAt(painted, code, null);
            if (!company) return;
            setPickAnchor(null);
            pickTramo({ code, company });
        },
    }), [touchInput, painted, pickTramo]);
    const anyPick = pick != null;
    const segmentStyle = useMemo<SegmentStyle>(() => ({ mode, filterBy, selected, anyPick, stageById }), [mode, filterBy, selected, anyPick, stageById]);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-2 sm:p-6 lg:p-10">
            <IndicatorHeader title={title} subtitle="Dirección Nacional de Vialidad" feedbackContext={{ surface: 'chart', path: '/indicador/rutas-nacionales', metricId: 'rutas-nacionales', metricTitle: title, modeId: mode, modeTitle: mode === 'concesion' ? 'Concesión' : 'Pavimento' }} />

            <div data-testid="rutas-map" className="w-full sm:w-[96%] max-w-[1800px] border border-imperial-gold/60 bg-imperial-blue p-3 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div role="group" aria-label="Modo de color" className="flex gap-2">
                        <ModeButton active={mode === 'concesion'} onClick={() => save({ mode: 'concesion' })}>Concesión</ModeButton>
                        <ModeButton active={mode === 'pavimento'} onClick={() => save({ mode: 'pavimento' })}>Pavimento</ModeButton>
                    </div>
                    <ul aria-label="Referencias" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-imperial-ivory">
                        {legend.map(item => (
                            <li key={item.key} className="flex items-center gap-1.5">
                                <span data-company-color={item.color} className="inline-block h-2.5 w-6" style={{ backgroundColor: item.color, outline: needsLegendOutline(item.color) ? `1px solid ${LEGEND_OUTLINE_COLOR}` : undefined }} />
                                {item.label}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div ref={mapRef} className="relative min-w-0 flex-1">
                        {filterBy === 'ninguno' && mode === 'concesion' ? (
                            <div data-testid="concession-share" className="pointer-events-none absolute left-2 top-2 z-[1] flex max-w-[35%] sm:max-w-[45%] flex-col items-start sm:left-auto sm:right-4 sm:top-4" style={{ WebkitTextStroke: SHARE_OUTLINE, paintOrder: 'stroke fill' }}>
                                <span className="imperial-title text-2xl sm:text-5xl font-bold text-imperial-gold">{SHARE_FORMAT.format(share)}</span>
                                <span className="text-[10px] sm:text-sm font-bold text-imperial-gold">de la red nacional concesionada</span>
                                <span className="text-[10px] sm:text-sm font-bold text-imperial-gold">{KM_FORMAT.format(shareKm)} km</span>
                            </div>
                        ) : null}
                        <svg viewBox={projected.viewBox} role="group" aria-label="Mapa de rutas nacionales de Argentina" className={`block h-auto w-full select-none bg-background ${crosshair.touchAction === 'none' ? 'touch-none' : 'touch-pan-x touch-pan-y'}`} style={TOUCH_PRESS_STYLE} onContextMenu={crosshair.contextMenu} onPointerDown={touchDown} onPointerMove={pointerMove} onPointerUp={crosshair.up} onPointerCancel={crosshair.cancel} onPointerLeave={leaveMap}>
                            {projected.outlinePaths.map((path, index) => (
                                <path key={`outline-${index}`} d={path} fill={OUTLINE_FILL} stroke={GOLD} strokeWidth={1} />
                            ))}
                            <RouteLayers layers={layers} style={segmentStyle} routeColors={routeColors} pick={pick} activeCode={activeTip?.code ?? null} activeSegment={activeTip?.segmentIndex ?? null} handlers={routeHandlers} />
                            {crosshairPoint ? (
                                <g data-crosshair="true" pointerEvents="none">
                                    <line x1={crosshairPoint[0]} x2={crosshairPoint[0]} y1={bounds.minY} y2={bounds.maxY} stroke={CROSSHAIR_STROKE} strokeWidth={CROSSHAIR_STROKE_WIDTH} strokeDasharray={CROSSHAIR_DASH} vectorEffect="non-scaling-stroke" />
                                    <line x1={bounds.minX} x2={bounds.maxX} y1={crosshairPoint[1]} y2={crosshairPoint[1]} stroke={CROSSHAIR_STROKE} strokeWidth={CROSSHAIR_STROKE_WIDTH} strokeDasharray={CROSSHAIR_DASH} vectorEffect="non-scaling-stroke" />
                                </g>
                            ) : null}
                        </svg>
                        {active && activeTip ? <RouteTooltip route={active} ofertas={ofertas} segmentIndex={activeTip.segmentIndex} store={tipStore} follow={touchHit != null || hover != null} anchor={pickAnchor ?? PICK_ANCHOR} /> : null}
                    </div>
                    <RouteBars codes={codes} companies={companies} routes={projected.routes} filterBy={filterBy} selected={selected} pick={pick} onFilter={changeFilter} onToggle={toggleSelected} onPick={next => { setPickAnchor(null); pickTramo(next); }} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-foreground/80">{mode === 'pavimento' ? PAVEMENT_SOURCE_NOTE : CONCESSION_SOURCE_NOTE}</p>
                <MethodologySection methodology={RUTAS_METHODOLOGY} />
            </div>
        </div>
    );
}

type RouteHandlers = {
    leave: (code: string) => void;
    click: (code: string, event: MouseEvent) => void;
    keyDown: (code: string, event: { key: string; preventDefault: () => void }) => void;
};

/** The route paths; each route is memoized on its own so a hover or pick only redraws the routes it touches. */
function RouteLayers({ layers, style, routeColors, pick, activeCode, activeSegment, handlers }: { layers: RouteLayer[]; style: SegmentStyle; routeColors: Map<string, string>; pick: TramoPick | null; activeCode: string | null; activeSegment: number | null; handlers: RouteHandlers }) {
    const propsFor = (layer: RouteLayer): Omit<RouteGroupProps, 'part'> => {
        const { code } = layer.route;
        return {
            layer,
            style,
            handlers,
            routeColor: style.filterBy === 'ruta' ? routeColors.get(code) : undefined,
            pickedCompany: pick?.code === code ? pick.company : null,
            // 'all' marks every segment (keyboard/route-level tip), a number marks one, null none.
            marked: activeCode !== code ? null : activeSegment ?? 'all',
        };
    };
    return (
        <>
            {layers.map(layer => layer.missing.length === 0 ? null : <RouteGroup key={layer.known.length === 0 ? layer.route.code : `${layer.route.code}-sin-dato`} part="missing" {...propsFor(layer)} />)}
            {layers.map(layer => layer.known.length === 0 ? null : <RouteGroup key={layer.route.code} part="known" {...propsFor(layer)} />)}
        </>
    );
}

type RouteGroupProps = { layer: RouteLayer; part: 'missing' | 'known'; style: SegmentStyle; handlers: RouteHandlers; routeColor: string | undefined; pickedCompany: string | null; marked: number | 'all' | null };

const RouteGroup = memo(function RouteGroup({ layer, part, style, handlers, routeColor, pickedCompany, marked }: RouteGroupProps) {
    const { route } = layer;
    const entries = part === 'missing' ? layer.missing : layer.known;
    const focusable = part === 'known' || layer.known.length === 0;
    const pick = pickedCompany == null ? null : { code: route.code, company: pickedCompany };
    return (
        <g
            role={focusable ? 'button' : undefined}
            tabIndex={focusable ? 0 : undefined}
            aria-label={focusable ? route.label : undefined}
            data-route={route.code}
            stroke={route.color}
            opacity={routeDimmed(route.code, style.filterBy, style.selected) ? DIMMED_ROUTE_OPACITY : 1}
            className={focusable ? 'cursor-pointer' : undefined}
            onPointerLeave={() => handlers.leave(route.code)}
            onClick={event => handlers.click(route.code, event)}
            onKeyDown={focusable ? event => handlers.keyDown(route.code, event) : undefined}
        >
            {entries.map(entry => drawSegment(route.code, entry, style, pick, marked === 'all' || marked === entry.index, routeColor))}
        </g>
    );
});

function currentView(): RutasView {
    return readStoredConfig(RUTAS_VIEW_KEY, parseRutasView) ?? DEFAULT_VIEW;
}

function layerOf(route: ProjectedRoute): RouteLayer {
    const drawn = route.segments.map((segment, index) => ({ segment, index, d: segment.paths.join('') }));
    return { route, missing: drawn.filter(entry => entry.segment.concesionaria === 'Sin dato'), known: drawn.filter(entry => entry.segment.concesionaria !== 'Sin dato') };
}

/** Company of the segment at `segmentIndex`; without one, the route's first concessioned (else first) segment. */
function companyAt(routes: PaintedRoute[], code: string, segmentIndex: number | null): string | null {
    const segments = routes.find(route => route.code === code)?.segments ?? [];
    const segment = segmentIndex == null ? segments.find(item => item.tramoId) ?? segments[0] : segments[segmentIndex];
    return segment?.concesionaria ?? null;
}

/** The picked tramo's segment on its route; null when the pick no longer matches the map. */
function pickedTip(routes: PaintedRoute[], pick: TramoPick): HoverTip | null {
    const segmentIndex = routes.find(route => route.code === pick.code)?.segments.findIndex(segment => segment.concesionaria === pick.company) ?? -1;
    return segmentIndex < 0 ? null : { code: pick.code, segmentIndex };
}

/** Nearest tramo under the pointer; without a screen CTM (e.g. jsdom) falls back to the element hit. */
function hitAt(event: PointerEvent<SVGSVGElement>, index: ReturnType<typeof buildHitIndex>): HoverTip | null {
    const local = localPoint(event.currentTarget, event.clientX, event.clientY);
    if (local) return nearestInIndex(index, local.point, HOVER_HIT_PX / local.scale);
    const code = event.target instanceof Element ? event.target.closest('[data-route]')?.getAttribute('data-route') : null;
    return code ? { code, segmentIndex: segmentIndexFrom(event.target) } : null;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`border px-3 py-1.5 text-xs font-bold uppercase sm:text-sm ${active ? 'border-imperial-gold bg-imperial-gold text-imperial-blue' : 'border-imperial-gold/50 text-imperial-gold'}`}
        >
            {children}
        </button>
    );
}

function routeDimmed(code: string, filterBy: RutasFilter, selected: Set<string>): boolean {
    return filterBy === 'ruta' && selected.size > 0 && !selected.has(code);
}

function drawSegment(code: string, { segment, index, d }: DrawnSegment, { mode, filterBy, selected, anyPick, stageById }: SegmentStyle, pick: TramoPick | null, marked: boolean, routeColor?: string) {
    const missing = segment.concesionaria === 'Sin dato';
    const companyDimmed = filterBy === 'concesionaria' && selected.size > 0 && !selected.has(segment.concesionaria);
    const stage = segment.tramoId ? stageById.get(segment.tramoId) : undefined;
    const byStage = filterBy === 'ninguno' && mode === 'concesion' && stage ? CONCESSION_COLORS[stage] : undefined;
    const stroke = routeColor ?? byStage ?? (filterBy === 'ninguno' && mode === 'pavimento' && !missing ? undefined : segment.color);
    const picked = segmentPicked(pick, code, segment.concesionaria);
    const quiet = picked ? 1 : companyDimmed || (anyPick && filterBy !== 'ninguno') ? DIMMED_SEGMENT_OPACITY : missing ? SIN_DATO_OPACITY : 1;
    return (
        <g key={`${code}-${segment.tramoId ?? 'sin-dato'}-${index}`} data-route={code} data-company={segment.concesionaria} data-segment-index={index} data-marked={marked ? 'true' : undefined} data-picked={picked ? 'true' : undefined} opacity={marked ? 1 : quiet}>
            <path d={d} stroke="transparent" strokeWidth={HIT_STROKE_WIDTH} fill="none" pointerEvents="stroke" />
            <path d={d} stroke={ROUTE_GAP} strokeWidth={ROUTE_CASING_WIDTH} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            <path data-fill="true" d={d} stroke={stroke} strokeDasharray={routeColor && missing ? GAP_DASH : undefined} strokeWidth={ROUTE_STROKE_WIDTH} style={picked ? { filter: PICKED_FILTER } : marked ? { filter: HOVER_FILTER } : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        </g>
    );
}

function RouteBars({ codes, companies, routes, filterBy, selected, pick, onFilter, onToggle, onPick }: { codes: string[]; companies: CompanyRoutes[]; routes: ProjectedRoute[]; filterBy: RutasFilter; selected: Set<string>; pick: TramoPick | null; onFilter: (filter: RutasFilter) => void; onToggle: (id: string) => void; onPick: (pick: TramoPick) => void }) {
    const dimOthers = selected.size > 0;
    return (
        <aside aria-label="Rutas" className="route-scroll flex w-full shrink-0 flex-col gap-1.5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-52 lg:overflow-y-auto">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-imperial-gold">
                Filtrar por
                <select
                    aria-label="Filtrar por"
                    value={filterBy}
                    onChange={(event) => onFilter(event.target.value as RutasFilter)}
                    className="w-full border border-imperial-gold bg-imperial-blue px-2 py-1.5 text-xs font-bold uppercase text-imperial-gold"
                >
                    <option value="ninguno">Ninguno</option>
                    <option value="ruta">Ruta</option>
                    <option value="concesionaria">Concesionaria</option>
                </select>
            </label>
            {filterBy === 'ruta' ? codes.map(code => {
                const pressed = selected.has(code);
                return (
                    <div key={code} className="flex flex-col gap-1">
                        <GoldBar label={`Escudo RN ${code}`} pressed={pressed} dimmed={dimOthers && !pressed} tall onClick={() => onToggle(code)}>
                            <SignFace code={code} sign={routeSign(code)} />
                        </GoldBar>
                        {pressed ? (
                            <ul aria-label={`Concesionarias de RN ${code}`} className="flex flex-col gap-1">
                                {companiesOnRoute(routes.find(route => route.code === code)?.segments ?? []).map(company => {
                                    const chosen = segmentPicked(pick, code, company.name);
                                    return (
                                        <li key={company.name}>
                                            <button type="button" aria-label={`Seleccionar ${company.name} en RN ${code}`} aria-pressed={chosen} onClick={() => onPick({ code, company: company.name })} className={`flex w-full items-center gap-1.5 border px-1.5 py-1 text-left text-[10px] font-bold uppercase ${chosen ? 'border-imperial-gold bg-imperial-gold/20 text-imperial-gold' : 'border-imperial-gold/60 text-imperial-gold'}`}>
                                                <span data-company-color={company.color} className="h-3 w-1 shrink-0" style={{ backgroundColor: company.color }} />
                                                <span className="truncate" title={company.name}>{company.name}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : null}
                    </div>
                );
            }) : null}
            {filterBy === 'concesionaria' ? companies.map(company => {
                const pressed = selected.has(company.name);
                return (
                    <div key={company.name} className="flex flex-col gap-1">
                        <GoldBar label={`Concesionaria ${company.name}`} pressed={pressed} dimmed={dimOthers && !pressed} onClick={() => onToggle(company.name)}>
                            <span data-company-color={company.color} className="h-3 w-1 shrink-0" style={{ backgroundColor: company.color }} />
                            <span className="truncate" title={company.name}>{company.name}</span>
                        </GoldBar>
                        {pressed ? (
                            <ul aria-label={`Rutas de ${company.name}`} className="flex flex-col items-center gap-1">
                                {company.rutas.map(code => {
                                    const chosen = segmentPicked(pick, code, company.name);
                                    return (
                                        <li key={code}>
                                            <button type="button" aria-label={`Seleccionar RN ${code} de ${company.name}`} aria-pressed={chosen} onClick={() => onPick({ code, company: company.name })} className={`border ${chosen ? 'border-imperial-gold' : 'border-transparent'}`}>
                                                <SignFace code={code} sign={routeSign(code)} />
                                            </button>
                                        </li>
                                    );
                                })}
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

function segmentIndexFrom(target: EventTarget | null): number | null {
    const node = target instanceof Element ? target.closest('[data-segment-index]') : null;
    const value = node?.getAttribute('data-segment-index');
    return value == null ? null : Number(value);
}

/** Follows the pointer through `store` while hovering; otherwise sits at the selection's `anchor`. */
function RouteTooltip({ route, ofertas, segmentIndex, store, follow, anchor }: { route: PaintedRoute; ofertas: RutaOferta[]; segmentIndex: number | null; store: HoverTooltipStore; follow: boolean; anchor: Anchor }) {
    const live = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const { x, y } = follow && live.label !== null ? live : anchor;
    const row = tipRow(route, segmentIndex);
    const oferta = tipOferta(route, segmentIndex, ofertas);
    return (
        <div
            role="status"
            aria-live="polite"
            data-crosshair-tip=""
            className="pointer-events-none absolute z-10"
            style={{ ...TOOLTIP_BOX, left: x, top: y, maxWidth: 300, maxHeight: '46vh', overflow: 'hidden', fontSize: '14px', lineHeight: 1.35 }}
        >
            <div style={{ color: GOLD, fontWeight: 'bold', marginBottom: '4px', ...TEXT_OUTLINE }}>{route.label}</div>
            <TipRow name="Tramo" value={row.tramo} />
            <TipRow color={row.color} name="Concesionaria" value={row.concesionaria} />
            <TipRow color={row.stage ? CONCESSION_COLORS[row.stage] : undefined} name="Estado" value={row.statusLabel} />
            <TipRow name="Km" value={row.kmLabel} />
            {oferta ? <TipRow labelColor={GOLD} color={GOLD} name="Tarifa ofertada" value={oferta.tarifa} /> : null}
            {oferta?.ofertas ? <TipRow labelColor={GOLD} color={GOLD} name="Ofertas" value={oferta.ofertas} /> : null}
        </div>
    );
}

function TipRow({ color = TOOLTIP_BOX.color, labelColor = TOOLTIP_BOX.color, name, value }: { color?: string; labelColor?: string; name: string; value: string }) {
    return (
        <div style={{ fontWeight: 'bold' }}>
            <span style={{ color: labelColor, ...TEXT_OUTLINE }}>{name}: </span>
            <span style={{ color, ...TEXT_OUTLINE }}>{value}</span>
        </div>
    );
}
