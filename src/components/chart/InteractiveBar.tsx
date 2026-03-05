'use client';

import { Bar, Rectangle } from 'recharts';
import { AreaConfig } from '@/types/chart';

interface InteractiveBarProps {
    areaConfig: AreaConfig;
    isDimmed: boolean;
    selectedMonth: string | null;
    activeMonth: string | null;
    onSelectMonth: (month: string | null) => void;
    onSetActiveMonth: (month: string | null) => void;
}

export default function InteractiveBar({
    areaConfig,
    isDimmed,
    selectedMonth,
    activeMonth,
    onSelectMonth,
    onSetActiveMonth
}: InteractiveBarProps) {
    return (
        <Bar
            dataKey={areaConfig.key}
            stackId={areaConfig.stackId || '1'}
            fill={areaConfig.color}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            onMouseEnter={(data: any) => {
                if (data?.mes && !selectedMonth) {
                    onSetActiveMonth(data.mes);
                }
            }}
            onMouseLeave={() => {
                if (!selectedMonth) {
                    onSetActiveMonth(null);
                }
            }}
            onClick={(data: any, index: number, event: any) => {
                if (event && event.stopPropagation) {
                    event.stopPropagation();
                }
                if (data?.mes) {
                    onSelectMonth(selectedMonth === data.mes ? null : data.mes);
                }
            }}
            shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const highlightMonth = selectedMonth || activeMonth;
                const isSelected = selectedMonth && payload?.mes === selectedMonth;
                const isActive = highlightMonth && payload?.mes === highlightMonth;
                const opacity = highlightMonth ? (isActive ? 1 : 0.15) : 1;

                return (
                    <Rectangle
                        {...props}
                        fill={areaConfig.color}
                        stroke={isSelected ? '#000000' : 'none'}
                        strokeWidth={isSelected ? 3 : 0}
                        style={{ opacity: isDimmed ? opacity * 0.2 : opacity, cursor: 'pointer', outline: 'none' }}
                    />
                );
            }}
        />
    );
}
