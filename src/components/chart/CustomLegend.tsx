'use client';

import type { CustomLegendProps } from '@/types/chart';

export default function CustomLegend({ areas, highlightedAreas, onToggleHighlight }: CustomLegendProps) {
    const legendAreas = areas.filter((area, index) => {
        if (area.hideInLegend) return false;
        const toggleKey = area.legendKey || area.key;
        return areas.findIndex((candidate) => (candidate.legendKey || candidate.key) === toggleKey && !candidate.hideInLegend) === index;
    });
    const preliminaryItems = areas.filter(area => area.preliminaryLabel);
    const hasHighlights = highlightedAreas.size > 0;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', paddingTop: '10px', paddingBottom: '10px' }}>
            {legendAreas.map(area => {
                const toggleKey = area.legendKey || area.key;
                const isHighlighted = highlightedAreas.has(toggleKey);
                const isDimmed = hasHighlights && !isHighlighted;
                return (
                    <span
                        key={toggleKey}
                        onClick={() => onToggleHighlight(toggleKey)}
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            opacity: isDimmed ? 0.45 : 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            fontWeight: isHighlighted ? 800 : 600,
                        }}
                        title="Click para destacar u ocultar el destacado"
                    >
                        <svg width="10" height="10">
                            <circle cx="5" cy="5" r="5" fill={area.legendFilled === false ? 'transparent' : (isDimmed ? '#666' : area.color)} stroke={isDimmed ? '#666' : area.color} strokeWidth={area.legendFilled === false ? 1.5 : 0} />
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
