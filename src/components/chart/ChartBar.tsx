'use client';

import { Bar, Rectangle } from 'recharts';
import { AreaConfig } from '@/types/chart';

interface ChartBarProps {
    areaConfig: AreaConfig;
    isDimmed: boolean;
    selectedMonth: string | null;
    activeMonth: string | null;
    onSelectMonth: (month: string | null) => void;
    onSetActiveMonth: (month: string | null) => void;
}

export default function ChartBar({
    areaConfig,
    isDimmed,
    selectedMonth,
    onSelectMonth,
}: Omit<ChartBarProps, 'activeMonth' | 'onSetActiveMonth'>) {
    return (
        <Bar
            dataKey={areaConfig.key}
            stackId={areaConfig.stackId || '1'}
            fill={areaConfig.color}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            onClick={(data: any, index: number, event: any) => {
                if (event && event.stopPropagation) {
                    event.stopPropagation();
                }
                if (data?.iso_fecha) {
                    onSelectMonth(selectedMonth === data.iso_fecha ? null : data.iso_fecha);
                }
            }}
            shape={(props: any) => {
                const { payload } = props;
                const isSelected = selectedMonth && payload?.iso_fecha === selectedMonth;
                const opacity = selectedMonth ? (isSelected ? 1 : 0.3) : 1;

                return (
                    <Rectangle
                        {...props}
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
