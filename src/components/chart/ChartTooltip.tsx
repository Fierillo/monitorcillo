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

    const total = valueRows.reduce((sum, row) => sum + row.value, 0);
    const totalFormat = valueRows[0]?.format ?? valueFormat;

    return (
        <div key={tooltipLabel} style={{ backgroundColor: 'rgba(0, 20, 63, 0.85)', border: '1px solid #FFD700', padding: '10px', color: '#FFF', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{rowData.fecha}</div>
            {valueRows.map(row => row.node)}
            {valueRows.length > 1 ? (
                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #666', color: '#FFD700', fontWeight: 'bold' }}>
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
        value: numericValue,
        format,
        node: (
            <div key={area.key} style={{ color: area.color, fontWeight: 'bold' }}>
                {area.name}: {formatValueByType(numericValue, format, 1)}
            </div>
        ),
    };
}
