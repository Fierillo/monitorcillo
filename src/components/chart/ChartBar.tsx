'use client';

import { Bar, Rectangle } from 'recharts';
import type { ChartBarClickEvent, ChartBarProps, ChartBarShapeProps } from '@/types/chart';

export default function ChartBar({
    areaConfig,
    isDimmed,
    selectedMonth,
    onSelectMonth,
    selectByMonth,
}: ChartBarProps) {
    return (
        <Bar
            dataKey={areaConfig.key}
            stackId={areaConfig.stackId}
            maxBarSize={areaConfig.maxBarSize}
            fill={areaConfig.color}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            isAnimationActive
            onClick={(data: unknown, _index: number, event: ChartBarClickEvent) => {
                if (event && event.stopPropagation) {
                    event.stopPropagation();
                }
                const isoFecha = getBarIsoFecha(data);
                if (isoFecha) {
                    const monthValue = selectByMonth ? isoFecha.slice(5, 7) : isoFecha;
                    onSelectMonth(selectedMonth === monthValue ? null : monthValue);
                }
            }}
            shape={(props: ChartBarShapeProps) => {
                const { payload, x, y, width, height } = props;
                const barHeight = height ?? 0;
                const barY = barHeight < 0 ? (y ?? 0) + barHeight : y;
                const barAbsHeight = Math.abs(barHeight);
                const monthValue = selectByMonth ? payload?.iso_fecha?.slice(5, 7) : payload?.iso_fecha;
                const isSelected = selectedMonth && monthValue === selectedMonth;
                const isPreliminary = areaConfig.preliminaryKey ? payload?.[areaConfig.preliminaryKey] === true : false;
                const opacity = selectedMonth ? (isSelected ? 1 : 0.3) : 1;
                const fillOpacity = isPreliminary ? 0.45 : (areaConfig.fill === false ? 0 : 1);
                const strokeColor = areaConfig.borderColor ?? (isSelected ? '#FFFFFF' : isPreliminary ? areaConfig.color : 'none');
                const strokeWidth = areaConfig.borderWidth ?? (isSelected || isPreliminary ? 1 : 0);
                const dash = areaConfig.dash;
                if (isPreliminary) {
                    return (
                        <Rectangle
                            x={x}
                            y={barY}
                            width={width}
                            height={barAbsHeight}
                            fill={areaConfig.preliminaryColor ?? areaConfig.color}
                            stroke={areaConfig.color}
                            strokeWidth={1}
                            style={{ opacity: isDimmed ? opacity * 0.2 : opacity, cursor: 'pointer', outline: 'none' }}
                        />
                    );
                }

                return (
                    <Rectangle
                        x={x}
                        y={barY}
                        width={width}
                        height={barAbsHeight}
                        fill={areaConfig.color}
                        fillOpacity={fillOpacity}
                        stroke={strokeColor}
                        strokeDasharray={dash ? dash.join(' ') : (isPreliminary && !isSelected ? '4 3' : undefined)}
                        strokeWidth={strokeWidth}
                        style={{ 
                            opacity: isDimmed ? opacity * 0.2 : opacity, 
                            cursor: 'pointer', 
                            outline: 'none'
                        }}
                    />
                );
            }}
        />
    );
}

function getBarIsoFecha(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const row = data as Record<string, unknown>;
    if (typeof row.iso_fecha === 'string') return row.iso_fecha;

    const payload = row.payload;
    if (!payload || typeof payload !== 'object') return null;
    const payloadRow = payload as Record<string, unknown>;
    return typeof payloadRow.iso_fecha === 'string' ? payloadRow.iso_fecha : null;
}
