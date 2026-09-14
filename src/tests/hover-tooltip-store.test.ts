import { describe, expect, it, vi } from 'vitest';
import { createHoverTooltipStore } from '../components/chart/hover-tooltip-store';

describe('hover tooltip store', () => {
    it('notifies subscribers when the hover label or position changes', () => {
        const store = createHoverTooltipStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.set({ label: 'ENE 17', x: 10, y: 20, tooltipY: 30 });

        expect(listener).toHaveBeenCalledOnce();
        expect(store.getSnapshot()).toEqual({ label: 'ENE 17', x: 10, y: 20, tooltipY: 30 });
    });

    it('does not notify when the same hover snapshot is written again', () => {
        const store = createHoverTooltipStore();
        const listener = vi.fn();
        store.set({ label: 'ENE 17', x: 10, y: 20 });
        store.subscribe(listener);

        store.set({ label: 'ENE 17', x: 10, y: 20 });

        expect(listener).not.toHaveBeenCalled();
    });

    it('clears without notifying when already empty', () => {
        const store = createHoverTooltipStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.clear();

        expect(listener).not.toHaveBeenCalled();
    });
});
