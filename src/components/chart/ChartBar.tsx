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
            stackId={areaConfig.stackId || '1'}
            fill={areaConfig.color}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
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
                const monthValue = selectByMonth ? payload?.iso_fecha?.slice(5, 7) : payload?.iso_fecha;
                const isSelected = selectedMonth && monthValue === selectedMonth;
                const opacity = selectedMonth ? (isSelected ? 1 : 0.3) : 1;

                return (
                    <Rectangle
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={areaConfig.color}
                        stroke={isSelected ? '#FFFFFF' : 'none'}
                        strokeWidth={isSelected ? 1 : 0}
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
