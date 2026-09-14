type HoverTooltipSnapshot = {
    label: string | null;
    x: number;
    y: number;
    tooltipY?: number;
};

const EMPTY_HOVER: HoverTooltipSnapshot = { label: null, x: 0, y: 0 };

export type HoverTooltipStore = {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => HoverTooltipSnapshot;
    set: (next: HoverTooltipSnapshot) => void;
    clear: () => void;
};

export function createHoverTooltipStore(): HoverTooltipStore {
    let snapshot: HoverTooltipSnapshot = EMPTY_HOVER;
    const listeners = new Set<() => void>();

    const emit = () => {
        listeners.forEach(listener => listener());
    };

    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot() {
            return snapshot;
        },
        set(next) {
            if (
                snapshot.label === next.label
                && snapshot.x === next.x
                && snapshot.y === next.y
                && snapshot.tooltipY === next.tooltipY
            ) {
                return;
            }
            snapshot = next;
            emit();
        },
        clear() {
            if (snapshot.label === null) return;
            snapshot = EMPTY_HOVER;
            emit();
        },
    };
}
