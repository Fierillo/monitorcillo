export type Point = [number, number];
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
/** `scale` = screen px per SVG unit. `travel` = SVG units slid since the finger went down; `cancelled` = the browser took the gesture (scroll); `held` = this press already was a long press. */
export type CrosshairState = { point: Point | null; finger: Point | null; travel: number; scale: number; cancelled: boolean; held: boolean };
export type CrosshairAction =
    | { type: 'down'; finger: Point; scale: number }
    | { type: 'move'; finger: Point }
    | { type: 'hold'; tapSlop: number }
    | { type: 'up'; tapSlop: number }
    | { type: 'cancel' }
    | { type: 'scroll'; dy: number }
    | { type: 'clear' };

export const IDLE_CROSSHAIR: CrosshairState = { point: null, finger: null, travel: 0, scale: 1, cancelled: false, held: false };
export const LONG_PRESS_MS = 500;
const EDGE_ZONE_PX = 56;
const EDGE_MAX_SPEED_PX = 16;

export function isTouchPointer(event: { pointerType?: string }): boolean {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
}

export function parseViewBox(viewBox: string): Bounds {
    const [minX, minY, width, height] = viewBox.split(/[\s,]+/).map(Number);
    return { minX, minY, maxX: minX + width, maxY: minY + height };
}

function clamp([x, y]: Point, bounds: Bounds): Point {
    return [Math.min(bounds.maxX, Math.max(bounds.minX, x)), Math.min(bounds.maxY, Math.max(bounds.minY, y))];
}

/**
 * Touch crosshair. Inactive: gestures belong to the page; only a long press (still finger) activates it at the finger.
 * Active: slides move it by the finger's delta; a simple tap deactivates it.
 */
export function crosshairReducer(state: CrosshairState, action: CrosshairAction, bounds: Bounds): CrosshairState {
    switch (action.type) {
        case 'clear':
            return IDLE_CROSSHAIR;
        case 'down':
            return { ...state, finger: action.finger, travel: 0, scale: action.scale, cancelled: false, held: false };
        case 'cancel':
            return { ...state, finger: null, travel: 0, cancelled: true };
        case 'scroll':
            if (!state.point || !state.finger) return state;
            return { ...state, point: clamp([state.point[0], state.point[1] + action.dy], bounds), finger: [state.finger[0], state.finger[1] + action.dy] };
        case 'move': {
            if (!state.finger) return state;
            const dx = action.finger[0] - state.finger[0];
            const dy = action.finger[1] - state.finger[1];
            const point = state.point ? clamp([state.point[0] + dx, state.point[1] + dy], bounds) : null;
            return { ...state, point, finger: action.finger, travel: state.travel + Math.hypot(dx, dy) };
        }
        case 'hold': {
            if (!state.finger || state.cancelled || state.travel > action.tapSlop) return state;
            return { ...state, point: state.point ?? clamp(state.finger, bounds), held: true };
        }
        case 'up': {
            if (!state.finger) return state;
            const tapped = !state.cancelled && !state.held && state.travel <= action.tapSlop;
            return tapped && state.point ? IDLE_CROSSHAIR : { ...state, finger: null, held: false };
        }
    }
}

/** Page scroll speed (px/frame) for a screen Y: negative near the top edge, positive near the bottom, scaled by proximity. */
export function edgeScrollSpeed(clientY: number, viewportHeight: number, zone = EDGE_ZONE_PX, maxSpeed = EDGE_MAX_SPEED_PX): number {
    const proximity = (distance: number) => Math.min(1, Math.max(0, 1 - distance / zone));
    const top = proximity(clientY);
    const bottom = proximity(viewportHeight - clientY);
    return Math.round((bottom - top) * maxSpeed * 100) / 100;
}

/** Max page scroll (px/frame) driven by the tooltip bottom: half the finger edge speed, so revealing the tooltip never jerks. */
const TIP_MAX_SPEED_PX = EDGE_MAX_SPEED_PX / 2;

/** Downward scroll speed (px/frame, ≥ 0) while the tooltip's bottom (screen Y) is near or below the screen bottom; eased in quadratically. */
export function tipScrollSpeed(tipBottom: number | null, viewportHeight: number, zone = EDGE_ZONE_PX, maxSpeed = TIP_MAX_SPEED_PX): number {
    if (tipBottom == null) return 0;
    const proximity = Math.min(1, Math.max(0, 1 - (viewportHeight - tipBottom) / zone));
    return Math.round(proximity * proximity * maxSpeed * 100) / 100;
}
