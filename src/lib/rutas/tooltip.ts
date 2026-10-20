import { ofertaLabels, type RutaOferta } from '@/lib/rutas/ofertas';
import { CONCESSION_COLORS, type ConcessionStage, type PaintedRoute } from '@/lib/rutas/status';

const TIP_KM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const TIP_WIDTH = 280;
const TIP_HEIGHT = 132;
const TIP_GAP = 14;

export type TipRow = { tramo: string; concesionaria: string; statusLabel: string; kmLabel: string; color: string; stage: ConcessionStage | 'sin-dato' | null };
type Box = { left: number; top: number; width: number; height: number };

function concessionStage(status: string): ConcessionStage | 'sin-dato' | null {
    return status in CONCESSION_COLORS ? status as ConcessionStage | 'sin-dato' : null;
}

/** Tooltip rows for the hovered segment (or the route's first concessioned one). `stage` is null for pavement ratings. */
export function tipRow(route: PaintedRoute, segmentIndex: number | null): TipRow {
    const segment = tipSegment(route, segmentIndex);
    const assignment = segment ? route.assignments.find(item => item.concesionaria === segment.concesionaria && item.tramo === segment.tramo) : undefined;
    if (segment && assignment) {
        const { status, ...row } = assignment;
        return { ...row, color: segment.color, stage: concessionStage(status) };
    }
    if (segment) {
        const missing = segment.concesionaria === 'Sin dato';
        return {
            tramo: segment.tramo ?? 'Sin dato',
            concesionaria: segment.concesionaria,
            statusLabel: missing ? 'Sin dato' : route.statusLabel,
            kmLabel: segment.km == null ? 'Sin dato' : `${TIP_KM.format(segment.km)} km`,
            color: segment.color,
            stage: missing ? 'sin-dato' : concessionStage(route.status),
        };
    }
    return {
        tramo: route.tramo ?? 'Sin dato',
        concesionaria: route.concesionaria,
        statusLabel: route.statusLabel,
        kmLabel: route.kmLabel,
        color: route.color,
        stage: concessionStage(route.status),
    };
}

/** Offer labels for the hovered segment's tramo. */
export function tipOferta(route: PaintedRoute, segmentIndex: number | null, ofertas: RutaOferta[]) {
    return ofertaLabels(ofertas, tipSegment(route, segmentIndex)?.tramoId ?? null);
}

function tipSegment(route: PaintedRoute, segmentIndex: number | null) {
    return (segmentIndex == null ? null : route.segments[segmentIndex]) ?? route.segments.find(item => item.tramoId) ?? route.segments[0];
}

/** Tooltip position relative to the map box, flipped to stay inside it. */
export function tipAt(event: { clientX?: number; clientY?: number }, rect: Box | undefined): { x: number; y: number } {
    const x = rect && event.clientX != null ? event.clientX - rect.left : 16;
    const y = rect && event.clientY != null ? event.clientY - rect.top : 16;
    if (!rect || rect.width === 0) return { x: x + TIP_GAP, y: y + TIP_GAP };
    return {
        x: x + TIP_GAP + TIP_WIDTH > rect.width ? Math.max(8, x - TIP_WIDTH - TIP_GAP) : x + TIP_GAP,
        y: y + TIP_GAP + TIP_HEIGHT > rect.height ? Math.max(8, y - TIP_HEIGHT - TIP_GAP) : y + TIP_GAP,
    };
}
