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
    if (!tooltipProps.active || !tooltipProps.label) return null;

    const tooltipLabel = String(tooltipProps.label);
    const rowData = chartData.find((row: any) => row.fecha === tooltipLabel || row.iso_fecha === tooltipLabel);



    if (!rowData) return null;

    if (rowData.pctPbi && rowData.mes) {
        const monthlyComparison = chartData
            .filter((row: any) => row.mes === rowData.mes && row.pctPbi)
            .sort((a: any, b: any) => b.year - a.year);

        const rows = monthlyComparison.map((row: any) => {
            const isCurrent = row.year === rowData.year;
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
                    {SPANISH_MONTHS[rowData.mes]} {String(row.year).slice(-2)}: {row.pctPbi.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% PIB
                </div>
            );
        });

        return (
            <div key={tooltipLabel} style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF', minWidth: '180px' }}>
                {rows}
            </div>
        );
    }

    const valueRows = areaConfigs.map(area => {
        const value = rowData[area.key];
        if (value === null || value === undefined) return null;

        return (
            <div key={area.key} style={{ color: area.color, fontWeight: 'bold' }}>
                {area.name}: {formatValueByType(Number(value), valueFormat, 1)}
            </div>
        );
    }).filter(Boolean);

    if (valueRows.length === 0) return null;

    return (
            <div key={tooltipLabel} style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{rowData.fecha}</div>
                {valueRows}
            </div>
    );
}
