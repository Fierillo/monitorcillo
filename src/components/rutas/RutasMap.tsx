'use client';

import Link from 'next/link';
import { useState } from 'react';
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
    paintRoutes,
    projectMap,
    type ColorMode,
    type RutaTramo,
    type RutasGeometry,
} from '@/lib/rutas/status';

const STORED_GEOMETRY = geometryAsset as RutasGeometry;
const CONCESSION_LEGEND = ['concesionado', 'en-licitacion', 'sin-concesionar', 'sin-dato'] as const;

export default function RutasMap({ tramos, geometry = STORED_GEOMETRY, title = 'Rutas nacionales' }: { tramos: RutaTramo[]; geometry?: RutasGeometry; title?: string }) {
    const [mode, setMode] = useState<ColorMode>('concesion');
    const [hovered, setHovered] = useState<string | null>(null);
    const [pinned, setPinned] = useState<string | null>(null);
    const painted = paintRoutes(geometry.routes, tramos, mode);
    const projected = projectMap(geometry.outline, painted, 800, 1000);
    const active = painted.find(route => route.code === (hovered ?? pinned)) ?? null;
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

                <div className="overflow-x-auto">
                <svg viewBox={projected.viewBox} role="group" aria-label="Mapa de rutas nacionales de Argentina" className="h-auto w-full min-w-[760px] bg-background">
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
                            onPointerEnter={() => setHovered(route.code)}
                            onPointerLeave={() => setHovered(current => current === route.code ? null : current)}
                            onClick={() => setPinned(route.code)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                setPinned(route.code);
                            }}
                        >
                            <path d={route.paths.join('')} stroke="transparent" strokeWidth={28} fill="none" pointerEvents="stroke" />
                            <path d={route.paths.join('')} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                        </g>
                    ))}
                </svg>
                </div>

                <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-30 min-h-16 w-[min(42rem,calc(100%-1.5rem))] -translate-x-1/2 border border-imperial-gold/40 bg-imperial-blue px-3 py-2 text-sm text-white shadow-lg">
                    {active ? <RouteDetail route={active} /> : <p>Pasá el cursor o tocá una ruta para ver el número, los kilómetros, la concesionaria y el estado.</p>}
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

function RouteDetail({ route }: { route: { label: string; kmLabel: string; concesionaria: string; statusLabel: string; tramo: string | null } }) {
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <div><dt className="text-[10px] uppercase text-imperial-gold">Ruta</dt><dd>{route.label}</dd></div>
            <div><dt className="text-[10px] uppercase text-imperial-gold">Km</dt><dd>{route.kmLabel}</dd></div>
            <div><dt className="text-[10px] uppercase text-imperial-gold">Concesionaria</dt><dd>{route.concesionaria}</dd></div>
            <div><dt className="text-[10px] uppercase text-imperial-gold">Estado</dt><dd>{route.statusLabel}</dd></div>
            <div className="col-span-2 sm:col-span-4"><dt className="text-[10px] uppercase text-imperial-gold">Tramo</dt><dd>{route.tramo ?? 'Sin dato'}</dd></div>
        </dl>
    );
}
