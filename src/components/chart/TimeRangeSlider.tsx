'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartDataRow } from '@/types/chart';

export type TimeRangeSliderProps = {
    data: ChartDataRow[];
    startIndex: number;
    endIndex: number;
    xAxisKey: 'iso_fecha' | 'fecha';
    labelByXAxisValue: Map<string, string>;
    onChange: (startIndex: number, endIndex: number) => void;
};

function getLabel(row: ChartDataRow | undefined, xAxisKey: string, labelMap: Map<string, string>): string {
    if (!row) return '';
    const key = String(row[xAxisKey] ?? '');
    return labelMap.get(key) || key;
}

export default function TimeRangeSlider({
    data,
    startIndex,
    endIndex,
    xAxisKey,
    labelByXAxisValue,
    onChange,
}: TimeRangeSliderProps) {
    const maxIndex = Math.max(0, data.length - 1);

    const safeStart = Math.min(startIndex, maxIndex);
    const safeEnd = Math.min(endIndex, maxIndex);

    const startPct = maxIndex === 0 ? 0 : (safeStart / maxIndex) * 100;
    const endPct = maxIndex === 0 ? 100 : (safeEnd / maxIndex) * 100;

    const startLabel = useMemo(
        () => getLabel(data[safeStart], xAxisKey, labelByXAxisValue),
        [data, safeStart, xAxisKey, labelByXAxisValue]
    );
    const endLabel = useMemo(
        () => getLabel(data[safeEnd], xAxisKey, labelByXAxisValue),
        [data, safeEnd, xAxisKey, labelByXAxisValue]
    );

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (value > safeEnd) {
            onChange(safeEnd, safeEnd);
        } else {
            onChange(value, safeEnd);
        }
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (value < safeStart) {
            onChange(safeStart, safeStart);
        } else {
            onChange(safeStart, value);
        }
    };

    const trackGradient = `linear-gradient(to right, #ffffff22 0%, #ffffff22 ${startPct}%, #FFD700 ${startPct}%, #FFD700 ${endPct}%, #ffffff22 ${endPct}%, #ffffff22 100%)`;

    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef(0);
    const dragStartIndicesRef = useRef({ start: 0, end: 0 });

    const handleRangePointerDown = (e: React.PointerEvent) => {
        if (!containerRef.current) return;
        containerRef.current.setPointerCapture(e.pointerId);
        dragStartXRef.current = e.clientX;
        dragStartIndicesRef.current = { start: safeStart, end: safeEnd };
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const dx = e.clientX - dragStartXRef.current;
            const indexDelta = Math.round((dx / rect.width) * maxIndex);

            const newStart = Math.max(0, Math.min(dragStartIndicesRef.current.start + indexDelta, maxIndex));
            const newEnd = Math.max(0, Math.min(dragStartIndicesRef.current.end + indexDelta, maxIndex));

            if (newStart !== safeStart || newEnd !== safeEnd) {
                onChange(newStart, newEnd);
            }
        };

        const handlePointerUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, maxIndex, onChange, safeStart, safeEnd]);

    return (
        <div className="w-full px-1 py-3 select-none">
            <div ref={containerRef} className="relative h-6">
                {/* Track background */}
                <div
                    className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full"
                    style={{ background: trackGradient }}
                />

                {/* Draggable selected range overlay */}
                {maxIndex > 0 && (
                    <div
                        className="absolute top-0 h-full cursor-grab active:cursor-grabbing"
                        style={{
                            left: `${startPct}%`,
                            width: `${endPct - startPct}%`,
                            zIndex: 1,
                        }}
                        onPointerDown={handleRangePointerDown}
                    />
                )}

                {/* Start range input */}
                <input
                    type="range"
                    min={0}
                    max={maxIndex}
                    value={safeStart}
                    onChange={handleStartChange}
                    className="slider-thumb"
                    style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}
                />

                {/* End range input */}
                <input
                    type="range"
                    min={0}
                    max={maxIndex}
                    value={safeEnd}
                    onChange={handleEndChange}
                    className="slider-thumb"
                    style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 3, pointerEvents: 'none' }}
                />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-2">
                <span className="text-[10px] sm:text-xs font-bold text-imperial-cyan uppercase tracking-wider">
                    {startLabel}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-imperial-cyan uppercase tracking-wider">
                    {endLabel}
                </span>
            </div>

            <style>{`
                .slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    cursor: pointer;
                }
                .slider-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 16px;
                    border-radius: 1px;
                    background: #FFD700;
                    border: 2px solid #00143F;
                    pointer-events: auto;
                    cursor: grab;
                    box-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
                    margin-top: -8px;
                }
                .slider-thumb::-moz-range-thumb {
                    width: 12px;
                    height: 16px;
                    border-radius: 1px;
                    background: #FFD700;
                    border: 2px solid #00143F;
                    pointer-events: auto;
                    cursor: grab;
                    box-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
                    margin-top: -8px;
                }
                .slider-thumb::-webkit-slider-runnable-track {
                    -webkit-appearance: none;
                    appearance: none;
                    height: 0;
                    background: transparent;
                }
                .slider-thumb::-moz-range-track {
                    height: 0;
                    background: transparent;
                }
            `}</style>
        </div>
    );
}
