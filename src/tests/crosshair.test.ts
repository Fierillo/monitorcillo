import { describe, expect, it } from 'vitest';
import { crosshairReducer, edgeScrollSpeed, tipScrollSpeed, IDLE_CROSSHAIR, isTouchPointer, parseViewBox, type Bounds, type CrosshairAction } from '@/lib/crosshair';

const bounds: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 200 };
const SLOP = 2;
const press = (x: number, y: number): CrosshairAction[] => [{ type: 'down', finger: [x, y], scale: 1 }, { type: 'up', tapSlop: SLOP }];
const longPress = (x: number, y: number): CrosshairAction[] => [{ type: 'down', finger: [x, y], scale: 1 }, { type: 'hold', tapSlop: SLOP }, { type: 'up', tapSlop: SLOP }];
const run = (actions: CrosshairAction[]) => actions.reduce((state, action) => crosshairReducer(state, action, bounds), IDLE_CROSSHAIR);

describe('crosshairReducer', () => {
    it('stays inactive on a short tap and on a drag that starts while inactive', () => {
        expect(run(press(10, 20)).point).toBeNull();
        expect(run([{ type: 'down', finger: [10, 20], scale: 1 }, { type: 'move', finger: [10, 60] }, { type: 'hold', tapSlop: SLOP }, { type: 'up', tapSlop: SLOP }]).point).toBeNull();
    });

    it('a long press anywhere activates it at the finger; a scroll (cancel) does not', () => {
        expect(run(longPress(10, 20)).point).toEqual([10, 20]);
        expect(run(longPress(95, 150)).point).toEqual([95, 150]);
        expect(run([{ type: 'down', finger: [10, 20], scale: 1 }, { type: 'cancel' }, { type: 'hold', tapSlop: SLOP }]).point).toBeNull();
    });

    it('while active, slides move it by the finger delta, clamped to the bounds', () => {
        expect(run([...longPress(10, 20), { type: 'down', finger: [80, 80], scale: 1 }, { type: 'move', finger: [83, 90] }]).point).toEqual([13, 30]);
        expect(run([...longPress(80, 20), { type: 'down', finger: [0, 0], scale: 1 }, { type: 'move', finger: [60, -40] }]).point).toEqual([100, 0]);
    });

    it('while active, a simple tap anywhere deactivates it, but a slide does not', () => {
        expect(run([...longPress(10, 20), ...press(50, 60)])).toEqual(IDLE_CROSSHAIR);
        expect(run([...longPress(10, 20), { type: 'down', finger: [50, 50], scale: 1 }, { type: 'move', finger: [60, 50] }, { type: 'up', tapSlop: SLOP }]).point).toEqual([20, 20]);
    });

    it('page scroll advances the crosshair and the finger together over the map', () => {
        const state = run([...longPress(10, 20), { type: 'down', finger: [50, 50], scale: 1 }, { type: 'scroll', dy: 15 }, { type: 'move', finger: [50, 65] }]);
        expect(state.point).toEqual([10, 35]);
        expect(run([...longPress(10, 195), { type: 'down', finger: [50, 50], scale: 1 }, { type: 'scroll', dy: 15 }]).point).toEqual([10, 200]);
    });

    it('ignores moves without a finger down and clears', () => {
        expect(run([{ type: 'move', finger: [5, 5] }])).toEqual(IDLE_CROSSHAIR);
        expect(run([...longPress(1, 1), { type: 'clear' }])).toEqual(IDLE_CROSSHAIR);
    });
});

describe('edgeScrollSpeed', () => {
    it('is zero away from the edges and grows towards them', () => {
        expect(edgeScrollSpeed(400, 800)).toBe(0);
        expect(edgeScrollSpeed(100, 800)).toBe(0);
        expect(edgeScrollSpeed(0, 800)).toBeLessThan(edgeScrollSpeed(30, 800));
        expect(edgeScrollSpeed(30, 800)).toBeLessThan(0);
        expect(edgeScrollSpeed(800, 800)).toBeGreaterThan(edgeScrollSpeed(770, 800));
        expect(edgeScrollSpeed(770, 800)).toBeGreaterThan(0);
        expect(edgeScrollSpeed(-50, 800)).toBe(-edgeScrollSpeed(850, 800));
    });
});

describe('tipScrollSpeed', () => {
    it('scrolls down only while the tooltip bottom is near or below the screen bottom, gently and smoothly', () => {
        expect(tipScrollSpeed(null, 800)).toBe(0);
        expect(tipScrollSpeed(600, 800)).toBe(0);
        expect(tipScrollSpeed(770, 800)).toBeGreaterThan(0);
        expect(tipScrollSpeed(840, 800)).toBeGreaterThan(tipScrollSpeed(790, 800));
        // Never harsher than half the finger edge scroll, and eases in near the zone border.
        expect(tipScrollSpeed(2000, 800)).toBeLessThanOrEqual(edgeScrollSpeed(2000, 800) / 2);
        expect(tipScrollSpeed(750, 800)).toBeLessThan(1);
    });
});

it('treats touch and pen as touch, mouse as mouse', () => {
    expect(isTouchPointer({ pointerType: 'touch' })).toBe(true);
    expect(isTouchPointer({ pointerType: 'pen' })).toBe(true);
    expect(isTouchPointer({ pointerType: 'mouse' })).toBe(false);
});

it('parses an SVG viewBox into bounds', () => {
    expect(parseViewBox('0 0 480 1000')).toEqual({ minX: 0, minY: 0, maxX: 480, maxY: 1000 });
});
