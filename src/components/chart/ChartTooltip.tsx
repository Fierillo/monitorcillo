'use client';

import type { ChartDataRow, ChartTooltipProps } from '@/types/chart';
import { SPANISH_MONTHS, formatValueByType } from './utils';

export default function ChartTooltip({
    chartData,
    areaConfigs,
    valueFormat,
    tooltipProps,
    compact = false,
}: ChartTooltipProps) {
    if (!tooltipProps.active || !tooltipProps.label) return null;

    const tooltipLabel = String(tooltipProps.label);
    const rowData = chartData.find((row) => row.fecha === tooltipLabel || row.iso_fecha === tooltipLabel);

    if (!rowData) return null;

    const month = rowData.mes;
    const showsAggregatePctPbi = areaConfigs.some(area => area.key === 'pctPbi');
    if (showsAggregatePctPbi && rowData.pctPbi && month) {
        const monthlyComparison = chartData
            .filter((row) => row.mes === month && row.pctPbi)
            .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

        const rows = monthlyComparison.map((row) => {
            const isCurrent = row.year === rowData.year;
            return (
                <div
                    key={row.year}
                    style={{
                        fontSize: compact ? (isCurrent ? '11px' : '9px') : (isCurrent ? '14px' : '12px'),
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        color: isCurrent ? '#FFD700' : '#9B59B6',
                        marginBottom: compact ? '1px' : '2px',
                        borderBottom: isCurrent ? '1px solid #666' : 'none',
                        paddingBottom: isCurrent ? (compact ? '2px' : '4px') : '0'
                    }}
                >
                    {SPANISH_MONTHS[month]} {String(row.year).slice(-2)}: {Number(row.pctPbi ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% PIB
                </div>
            );
        });

        return (
            <div key={tooltipLabel} style={{ backgroundColor: 'rgba(0, 20, 63, 0.92)', border: '1px solid #FFD700', padding: compact ? '6px' : '10px', color: '#FFF', minWidth: compact ? '140px' : '180px', maxHeight: compact ? '45vh' : undefined, overflowY: compact ? 'auto' : undefined, backdropFilter: 'blur(4px)' }}>
                {rows}
            </div>
        );
    }

    const valueRows = areaConfigs
        .map(area => renderValueRow(rowData, area, valueFormat))
        .filter((row): row is NonNullable<ReturnType<typeof renderValueRow>> => row !== null);

    if (valueRows.length === 0) return null;

    const showStackTotal = areaConfigs.some(area => area.stackId) && valueRows.length > 1;
    const total = showStackTotal ? valueRows.reduce((sum, row) => sum + row.value, 0) : null;
    const totalFormat = valueRows[0]?.format ?? valueFormat;

    return (
        <div key={tooltipLabel} style={{ backgroundColor: 'rgba(0, 20, 63, 0.92)', border: '1px solid #FFD700', padding: compact ? '6px' : '10px', color: '#FFF', maxWidth: compact ? '220px' : undefined, maxHeight: compact ? '55vh' : undefined, overflowY: compact ? 'auto' : undefined, fontSize: compact ? '10px' : undefined, lineHeight: compact ? 1.15 : undefined, backdropFilter: 'blur(4px)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: compact ? '2px' : '4px' }}>{rowData.fecha}</div>
            {valueRows.map(row => compact ? (
                <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: row.color, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                    <span>{row.formatted}</span>
                </div>
            ) : row.node)}
            {showStackTotal && total != null ? (
                <div style={{ marginTop: compact ? '3px' : '6px', paddingTop: compact ? '3px' : '6px', borderTop: '1px solid #666', color: '#FFD700', fontWeight: 'bold' }}>
                    Total: {formatValueByType(total, totalFormat, 1)}
                </div>
            ) : null}
        </div>
    );
}

function renderValueRow(rowData: ChartDataRow, area: ChartTooltipProps['areaConfigs'][number], valueFormat: ChartTooltipProps['valueFormat']) {
    const value = rowData[area.key];
    if (value === null || value === undefined) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const format = area.valueFormat ?? valueFormat;

    return {
        key: area.key,
        name: area.name,
        color: area.color,
        value: numericValue,
        format,
        formatted: formatValueByType(numericValue, format, 1),
        node: (
            <div key={area.key} style={{ color: area.color, fontWeight: 'bold' }}>
                {area.name}: {formatValueByType(numericValue, format, 1)}
            </div>
        ),
    };
}
