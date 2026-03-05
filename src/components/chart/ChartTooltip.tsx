'use client';

import { AreaConfig, ValueFormat } from '@/types/chart';
import { SPANISH_MONTHS, formatValueByType } from './utils';

interface ChartTooltipProps {
    chartData: any[];
    areaConfigs: AreaConfig[];
    valueFormat: ValueFormat;
    tooltipProps: {
        active?: boolean;
        label?: string | number;
        payload?: readonly any[];
    };
}

export default function ChartTooltip({ 
    chartData, 
    areaConfigs, 
    valueFormat, 
    tooltipProps 
}: ChartTooltipProps) {
    if (!tooltipProps.active || !tooltipProps.payload || tooltipProps.payload.length === 0) {
        return (
            <div style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF' }}>
                {tooltipProps.label}
            </div>
        );
    }

    const tooltipLabel = tooltipProps.label as string;
    const rowData = chartData.find((row: any) => row.fecha === tooltipLabel);
    const firstPayload = tooltipProps.payload[0]?.payload;

    if (firstPayload?.pctPbi && firstPayload?.mes) {
        const monthlyComparison = chartData
            .filter((row: any) => row.mes === firstPayload.mes && row.pctPbi)
            .sort((a: any, b: any) => b.year - a.year);

        const rows = monthlyComparison.map((row: any) => {
            const isCurrent = row.year === firstPayload.year;
            return (
                <div
                    key={row.year}
                    style={{
                        fontSize: isCurrent ? '14px' : '12px',
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        color: isCurrent ? '#FFD700' : '#9B59B6',
                        marginBottom: '2px',
                        borderBottom: isCurrent ? '1px solid #666' : 'none',
                        paddingBottom: isCurrent ? '4px' : '0'
                    }}
                >
                    {SPANISH_MONTHS[firstPayload.mes]} {String(row.year).slice(-2)}: {row.pctPbi.toFixed(1)}% PIB
                </div>
            );
        });

        return (
            <div style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF', minWidth: '180px' }}>
                {rows}
            </div>
        );
    }

    const valueRows = areaConfigs.map(area => {
        const value = rowData?.[area.key];
        if (value === null || value === undefined) return null;

        return (
            <div key={area.key} style={{ color: area.color, fontWeight: 'bold' }}>
                {area.name}: {formatValueByType(Number(value), valueFormat)}
            </div>
        );
    }).filter(Boolean);

    return (
        <div style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{tooltipLabel}</div>
            {valueRows}
        </div>
    );
}
