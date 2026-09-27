'use client';

import { useRef } from 'react';
import type { ChartDataRow } from '@/types/chart';
import { chartIndexForX, chartXForIndex } from './utils';
import { moveRangeSelection, releaseRangeSelection } from '@/lib/chart-range-selection';
import type { RangeSelection } from '@/lib/chart-range-selection';

export type MobileRangePickerProps = {
    data: ChartDataRow[];
    xAxisKey: 'iso_fecha' | 'fecha';
    labelByXAxisValue: Map<string, string>;
    selection: RangeSelection;
    maxIndex: number;
    visibleRange: [number, number];
    chartWidth: number;
    plotLeft: number;
    plotRight: number;
    hasBars: boolean;
    onSelectionChange: (selection: RangeSelection) => void;
    onCommit: (range: [number, number]) => void;
    onCancel: () => void;
};

function labelFor(data: ChartDataRow[], xAxisKey: string, index: number, labels: Map<string, string>): string {
    const row = data[index];
    if (!row) return '';
    const key = String(row[xAxisKey] ?? '');
    return labels.get(key) || String(row.fecha ?? key);
}

export default function MobileRangePicker({
    data,
    xAxisKey,
    labelByXAxisValue,
    selection,
    maxIndex,
    visibleRange,
    chartWidth,
    plotLeft,
    plotRight,
    hasBars,
    onSelectionChange,
    onCommit,
    onCancel,
}: MobileRangePickerProps) {
    const draggingRef = useRef(false);
    const guideRef = useRef<HTMLDivElement | null>(null);
    const dateRef = useRef<HTMLSpanElement | null>(null);
    const [visibleStart, visibleEnd] = visibleRange;
    const visibleCount = Math.max(1, visibleEnd - visibleStart + 1);
    const plotIndexFor = (fullIndex: number) => Math.min(visibleCount - 1, Math.max(0, fullIndex - visibleStart));
    const geometry = { count: visibleCount, hasBars, left: plotLeft, right: plotRight, width: chartWidth };
    const guideX = chartXForIndex({ ...geometry, index: plotIndexFor(selection.index) });
    const startX = chartXForIndex({ ...geometry, index: plotIndexFor(selection.startIndex) });
    const endX = chartXForIndex({ ...geometry, index: plotIndexFor(selection.endIndex) });
    const date = labelFor(data, xAxisKey, selection.index, labelByXAxisValue);

    const fullIndexFromEvent = (target: HTMLElement, clientX: number): number => {
        const offsetLeft = target.getBoundingClientRect().left;
        return visibleStart + chartIndexForX({ x: clientX - offsetLeft, ...geometry });
    };

    const paintDrag = (fullIndex: number) => {
        if (guideRef.current) guideRef.current.style.left = `${chartXForIndex({ ...geometry, index: plotIndexFor(fullIndex) })}px`;
        if (dateRef.current) dateRef.current.textContent = labelFor(data, xAxisKey, fullIndex, labelByXAxisValue);
    };

    return (
        <div
            data-testid="range-picker"
            className="absolute inset-0 z-30 touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={(event) => {
                draggingRef.current = true;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                paintDrag(moveRangeSelection(selection, fullIndexFromEvent(event.currentTarget, event.clientX), maxIndex).index);
            }}
            onPointerMove={(event) => {
                if (!draggingRef.current) return;
                paintDrag(moveRangeSelection(selection, fullIndexFromEvent(event.currentTarget, event.clientX), maxIndex).index);
            }}
            onPointerUp={(event) => {
                if (!draggingRef.current) return;
                draggingRef.current = false;
                const released = releaseRangeSelection(moveRangeSelection(selection, fullIndexFromEvent(event.currentTarget, event.clientX), maxIndex));
                if (released.committed) onCommit(released.committed);
                else onSelectionChange(released.selection);
            }}
            onPointerCancel={() => {
                draggingRef.current = false;
            }}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-imperial-gold/25" style={{ top: 5 }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-imperial-gold/25" />
            <div ref={guideRef} data-testid="range-picker-guide" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-imperial-gold shadow-[0_0_10px_rgba(255,215,0,0.8)]" style={{ left: `${guideX}px` }}>
                <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-imperial-gold" />
            </div>
            {selection.phase === 'end' ? (
                <>
                    <div className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-imperial-cyan/50" style={{ left: `${startX}px` }} />
                    <div className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-imperial-cyan/50" style={{ left: `${endX}px` }} />
                </>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14">
                <div className="flex flex-col items-center gap-1">
                    <span data-testid="range-picker-hint" className="border border-imperial-gold/60 bg-imperial-blue/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-imperial-cyan">
                        {selection.phase === 'start' ? 'Desde' : 'Hasta'}
                    </span>
                    <span ref={dateRef} data-testid="range-picker-date" className="border-2 border-imperial-gold bg-imperial-blue px-3 py-1 text-base font-bold tracking-wider text-imperial-gold shadow-lg shadow-imperial-blue/60">
                        {date}
                    </span>
                </div>
            </div>
            <button
                type="button"
                onClick={onCancel}
                className="no-capture absolute bottom-2 right-2 border border-imperial-gold bg-imperial-blue px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-imperial-gold"
            >
                Cancelar
            </button>
        </div>
    );
}
