'use client';

import type { ChartDataRow, ChartTooltipProps } from '@/types/chart';
import { SPANISH_MONTHS, formatValueByType } from './utils';

export default function ChartTooltip({
    chartData,
    areaConfigs,
    valueFormat,
    tooltipProps
}: ChartTooltipProps) {
    if (!tooltipProps.active || !tooltipProps.label) return null;

    const tooltipLabel = String(tooltipProps.label);
    const rowData = chartData.find((row) => row.fecha === tooltipLabel || row.iso_fecha === tooltipLabel);

    if (!rowData) return null;

    const month = rowData.mes;
    if (rowData.pctPbi && month) {
        const monthlyComparison = chartData
            .filter((row) => row.mes === month && row.pctPbi)
            .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

        const rows = monthlyComparison.map((row) => {
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
                    {SPANISH_MONTHS[month]} {String(row.year).slice(-2)}: {Number(row.pctPbi ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% PIB
                </div>
            );
        });

        return (
            <div key={tooltipLabel} style={{ backgroundColor: 'rgba(0, 20, 63, 0.85)', border: '1px solid #FFD700', padding: '10px', color: '#FFF', minWidth: '180px', backdropFilter: 'blur(4px)' }}>
                {rows}
            </div>
        );
    }

    const valueRows = areaConfigs
        .map(area => renderValueRow(rowData, area, valueFormat))
        .filter((row): row is NonNullable<ReturnType<typeof renderValueRow>> => row !== null);

    if (valueRows.length === 0) return null;

    return (
        <div key={tooltipLabel} style={{ backgroundColor: 'rgba(0, 20, 63, 0.85)', border: '1px solid #FFD700', padding: '10px', color: '#FFF', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{rowData.fecha}</div>
            {valueRows}
        </div>
    );
}

function renderValueRow(rowData: ChartDataRow, area: ChartTooltipProps['areaConfigs'][number], valueFormat: ChartTooltipProps['valueFormat']) {
    const value = rowData[area.key];
    if (value === null || value === undefined) return null;

    return (
        <div key={area.key} style={{ color: area.color, fontWeight: 'bold' }}>
            {area.name}: {formatValueByType(Number(value), valueFormat, 1)}
        </div>
    );
}
