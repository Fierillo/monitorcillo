'use client';

import { Legend } from 'recharts';

interface CustomLegendProps {
    dimmedAreas: Set<string>;
    onToggleDim: (key: string) => void;
}

export default function CustomLegend({ dimmedAreas, onToggleDim }: CustomLegendProps) {
    return (
        <Legend
            wrapperStyle={{ color: '#FFD700', paddingTop: '10px' }}
            formatter={(value: string, entry: any) => {
                const key = entry?.payload?.dataKey;
                const isDimmed = key ? dimmedAreas.has(key) : false;
                return (
                    <span
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            marginRight: 10,
                            cursor: 'pointer',
                            opacity: isDimmed ? 0.5 : 1
                        }}
                        onClick={() => key && onToggleDim(key)}
                    >
                        {value}
                    </span>
                );
            }}
        />
    );
}
