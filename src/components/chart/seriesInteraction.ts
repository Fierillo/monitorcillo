import type { ChartSeriesClickEvent } from '@/types/chart';

export function handleSeriesCtrlClick(event: ChartSeriesClickEvent | undefined, onCtrlClick: () => void): boolean {
    if (!event?.ctrlKey) return false;
    event.stopPropagation?.();
    onCtrlClick();
    return true;
}
