'use client';

import type { CustomLegendProps } from '@/types/chart';

export default function CustomLegend({ areas, dimmedAreas, onToggleDim }: CustomLegendProps) {
    const legendAreas = areas.filter((area, index) => {
        if (area.hideInLegend) return false;
        const toggleKey = area.legendKey || area.key;
        return areas.findIndex((candidate) => (candidate.legendKey || candidate.key) === toggleKey && !candidate.hideInLegend) === index;
    });
    const preliminaryItems = areas.filter(area => area.preliminaryLabel);

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', paddingTop: '10px', paddingBottom: '10px' }}>
            {legendAreas.map(area => {
                const toggleKey = area.legendKey || area.key;
                const isDimmed = dimmedAreas.has(toggleKey);
                return (
                    <span
                        key={toggleKey}
                        onClick={() => onToggleDim(toggleKey)}
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            opacity: isDimmed ? 0.5 : 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                        }}
                    >
                        <svg width="10" height="10">
                            <circle cx="5" cy="5" r="5" fill={isDimmed ? '#666' : area.color} />
                        </svg>
                        {area.name}
                    </span>
                );
            })}
            {preliminaryItems.map(area => (
                <span
                    key={`${area.key}-preliminary`}
                    style={{
                        color: '#FFD700',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                    }}
                >
                    <svg width="14" height="10">
                        <rect x="1" y="1" width="12" height="8" fill={area.color} fillOpacity="0.45" stroke={area.color} strokeDasharray="3 2" />
                    </svg>
                    {area.preliminaryLabel}
                </span>
            ))}
        </div>
    );
}
