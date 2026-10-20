import { useEffect, useRef, useState } from 'react';
import { crosshairReducer, LONG_PRESS_MS, edgeScrollSpeed, tipScrollSpeed, IDLE_CROSSHAIR, isTouchPointer, type Bounds, type CrosshairAction, type CrosshairState, type Point } from '@/lib/crosshair';

/** Max finger travel (screen px) that still counts as a tap. */
const TAP_SLOP_PX = 10;

type Matrix = { a: number; d: number; e: number; f: number };
/** The pointer fields the hook reads; React and native pointer events both fit. */
type PointerEvent<E> = { pointerType?: string; pointerId: number; clientX: number; clientY: number; currentTarget: E };
/** `tipBottom` returns the tooltip box's bottom (screen Y) so the page also eases down when the tooltip is cut by the screen bottom. */
type Options<E extends Element> = { bounds: Bounds; onChange?: (element: E, next: CrosshairState) => void; tipBottom?: () => number | null };

/** SVG units → screen px; plain elements use their CSS pixel box. */
function screenMatrix(element: Element): Matrix | null {
    if (!(element instanceof SVGSVGElement)) {
        const { left, top } = element.getBoundingClientRect();
        return { a: 1, d: 1, e: left, f: top };
    }
    const ctm = element.getScreenCTM?.();
    return ctm && ctm.a !== 0 && ctm.d !== 0 ? ctm : null;
}

/** Screen point → element units (SVG units, or local CSS px), with the px-per-unit scale; null without a usable matrix. */
export function localPoint(element: Element, clientX: number, clientY: number): { point: Point; scale: number } | null {
    const ctm = screenMatrix(element);
    return ctm ? { point: [(clientX - ctm.e) / ctm.a, (clientY - ctm.f) / ctm.d], scale: ctm.a } : null;
}

export function clientOf(svg: Element, [x, y]: Point): { clientX?: number; clientY?: number } {
    const ctm = screenMatrix(svg);
    return ctm ? { clientX: x * ctm.a + ctm.e, clientY: y * ctm.d + ctm.f } : {};
}

/** Blocks the native long-press callout and text selection on the touch surface. */
export const TOUCH_PRESS_STYLE = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as const;

/**
 * Long-press-to-activate, relative-drag crosshair for touch/pen pointers over an SVG (SVG units) or any element (local CSS px), with edge auto-scroll.
 * While active, a simple tap anywhere (on the element or elsewhere on the page) deactivates it.
 * Handlers return true when they handled a touch pointer so the caller can keep its mouse behavior otherwise.
 * `touchAction` is the CSS value for the element: page scroll while inactive, none while active.
 */
export function useTouchCrosshair<E extends Element = SVGSVGElement>({ bounds, onChange, tipBottom }: Options<E>) {
    const [state, setState] = useState<CrosshairState>(IDLE_CROSSHAIR);
    const latest = useRef({ state, bounds, onChange, tipBottom });
    /** Set by the first touch pointer event; activation needs a touch press, so the active-state effect below always finds it. */
    const svgRef = useRef<E | null>(null);
    const frame = useRef<number | null>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouch = useRef(false);
    useEffect(() => {
        latest.current = { ...latest.current, bounds, onChange, tipBottom };
    });
    useEffect(() => () => {
        if (frame.current != null) cancelAnimationFrame(frame.current);
        if (holdTimer.current != null) clearTimeout(holdTimer.current);
    }, []);

    const apply = (action: CrosshairAction) => {
        const next = crosshairReducer(latest.current.state, action, latest.current.bounds);
        latest.current.state = next;
        setState(next);
        if (svgRef.current) latest.current.onChange?.(svgRef.current, next);
        return next;
    };
    const stopHold = () => {
        if (holdTimer.current != null) clearTimeout(holdTimer.current);
        holdTimer.current = null;
    };
    const stopScroll = () => {
        if (frame.current != null) cancelAnimationFrame(frame.current);
        frame.current = null;
    };
    const speedNow = () => {
        const { point, finger } = latest.current.state;
        const svg = svgRef.current;
        if (!point || !finger || !svg) return 0;
        const { clientY } = clientOf(svg, point);
        const edge = clientY == null ? 0 : edgeScrollSpeed(clientY, window.innerHeight);
        return edge < 0 ? edge : Math.max(edge, tipScrollSpeed(latest.current.tipBottom?.() ?? null, window.innerHeight));
    };
    const tick = () => {
        frame.current = null;
        const speed = speedNow();
        if (speed === 0) return;
        const before = window.scrollY;
        window.scrollBy({ top: speed });
        const scrolled = window.scrollY - before;
        if (scrolled === 0) return;
        apply({ type: 'scroll', dy: scrolled / latest.current.state.scale });
        frame.current = requestAnimationFrame(tick);
    };
    const maybeScroll = () => {
        if (frame.current == null && speedNow() !== 0) frame.current = requestAnimationFrame(tick);
    };
    const fingerOf = (event: PointerEvent<E>): { finger: Point; scale: number } | null => {
        lastTouch.current = isTouchPointer(event);
        if (!lastTouch.current) return null;
        svgRef.current = event.currentTarget;
        const local = localPoint(event.currentTarget, event.clientX, event.clientY);
        return local ? { finger: local.point, scale: local.scale } : null;
    };

    const active = state.point != null;
    useEffect(() => {
        const element = svgRef.current;
        if (!active || !element) return;
        // A press that turned into the crosshair keeps its finger: stop the page from panning mid-gesture.
        const blockPan = (event: Event) => event.preventDefault();
        let tapStart: Point | null = null;
        // Controls marked `data-keep-crosshair` (e.g. Guardar) act on the crosshair, so tapping them must not dismiss it.
        const outside = (event: globalThis.PointerEvent) => isTouchPointer(event)
            && !(event.target instanceof Node && element.contains(event.target))
            && !(event.target instanceof Element && event.target.closest('[data-keep-crosshair]'));
        const pageDown = (event: globalThis.PointerEvent) => {
            tapStart = outside(event) ? [event.clientX, event.clientY] : null;
        };
        const pageUp = (event: globalThis.PointerEvent) => {
            if (tapStart && outside(event) && Math.hypot(event.clientX - tapStart[0], event.clientY - tapStart[1]) <= TAP_SLOP_PX) apply({ type: 'clear' });
            tapStart = null;
        };
        element.addEventListener('touchmove', blockPan, { passive: false });
        window.addEventListener('pointerdown', pageDown, true);
        window.addEventListener('pointerup', pageUp, true);
        return () => {
            element.removeEventListener('touchmove', blockPan);
            window.removeEventListener('pointerdown', pageDown, true);
            window.removeEventListener('pointerup', pageUp, true);
        };
    }, [active]);
    return {
        state,
        touchAction: state.point ? 'none' : 'pan-x pan-y',
        /** Suppresses the native long-press menu after a touch press; mouse right-click is untouched. */
        contextMenu(event: { preventDefault: () => void }) {
            if (lastTouch.current) event.preventDefault();
        },
        down(event: PointerEvent<E>) {
            const hit = fingerOf(event);
            if (!hit) return false;
            if (latest.current.state.point) event.currentTarget.setPointerCapture?.(event.pointerId);
            apply({ type: 'down', ...hit });
            stopHold();
            holdTimer.current = setTimeout(() => {
                holdTimer.current = null;
                apply({ type: 'hold', tapSlop: TAP_SLOP_PX / latest.current.state.scale });
            }, LONG_PRESS_MS);
            return true;
        },
        move(event: PointerEvent<E>) {
            const hit = fingerOf(event);
            if (!hit) return false;
            apply({ type: 'move', finger: hit.finger });
            maybeScroll();
            return true;
        },
        up(event: PointerEvent<E>) {
            if (!isTouchPointer(event)) return false;
            stopHold();
            stopScroll();
            apply({ type: 'up', tapSlop: TAP_SLOP_PX / latest.current.state.scale });
            return true;
        },
        cancel(event: PointerEvent<E>) {
            if (!isTouchPointer(event)) return false;
            stopHold();
            stopScroll();
            apply({ type: 'cancel' });
            return true;
        },
    };
}
