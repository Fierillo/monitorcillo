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
    type ColorMode,
    type RutaTramo,
    type RutasGeometry,
} from '@/lib/rutas/status';

const STORED_GEOMETRY = geometryAsset as RutasGeometry;
const CONCESSION_LEGEND = ['concesionado', 'en-licitacion', 'sin-concesionar', 'sin-dato'] as const;
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
            <header className="w-full sm:w-[96%] max-w-[1100px] mb-4 border-b-2 border-imperial-gold pb-4 mt-2 flex flex-col items-start gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                <div className="flex w-full items-stretch justify-end gap-2 sm:w-auto">
                    <FeedbackButton context={{ surface: 'chart', path: '/indicador/rutas-nacionales', metricId: 'rutas-nacionales', metricTitle: title, modeId: mode, modeTitle: mode === 'concesion' ? 'Concesión' : 'Pavimento' }} />
                    <Link href="/" className="flex shrink-0 items-center justify-center border-2 border-imperial-gold px-3 py-1 text-xs font-bold uppercase text-imperial-gold transition-colors hover:bg-imperial-gold hover:text-imperial-blue sm:px-4 sm:py-2 sm:text-base">Volver</Link>
                </div>
                <div>
                    <h1 className="imperial-title text-xl sm:text-3xl font-bold text-imperial-gold">{title}</h1>
                    <p className="text-imperial-cyan mt-1 text-xs sm:text-base font-bold">Dirección Nacional de Vialidad</p>
                </div>
            </header>

            <div data-testid="rutas-map" className="w-full sm:w-[96%] max-w-[1100px] border-2 border-imperial-gold bg-imperial-blue p-3 sm:p-5">
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

                <div ref={mapRef} className="relative">
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

function RouteTooltip({ route, x, y }: { route: { label: string; kmLabel: string; concesionaria: string; statusLabel: string; tramo: string | null; color: string }; x: number; y: number }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-10"
            style={{ left: x, top: y, backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #FFD700', padding: '10px', color: '#FFF', maxWidth: 280, fontSize: '14px', lineHeight: 1.35, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}
        >
            <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '4px', WebkitTextStroke: TOOLTIP_OUTLINE, paintOrder: 'stroke fill' }}>{route.label}</div>
            <TipRow color={route.color} name="Tramo" value={route.tramo ?? 'Sin dato'} />
            <TipRow color={route.color} name="Concesionaria" value={route.concesionaria} />
            <TipRow color={route.color} name="Estado" value={route.statusLabel} />
            <TipRow color={route.color} name="Km" value={route.kmLabel} />
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
