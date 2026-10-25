'use client';

import type { ChartDataRow, ChartTooltipProps } from '@/types/chart';
import { SPANISH_MONTHS, formatValueByType } from './utils';

export const TOOLTIP_BACKGROUND = 'rgba(11, 20, 38, 0.4)';
export const TOOLTIP_BLUR = 'blur(2px)';
export const TOOLTIP_OUTLINE_DARK = '3px rgba(0, 0, 0, 0.85)';
export const TOOLTIP_BOX = { backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #C9A44C', padding: '10px', color: '#E8E2D0', backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR } as const;
const TOOLTIP_OUTLINE_LIGHT = '3px rgba(255, 255, 255, 0.9)';

/** Long headers and names wrap to the next line inside this width instead of widening (and being clipped). */
const tooltipMaxWidth = (compact: boolean) => compact ? 'min(176px, 70vw)' : 'min(260px, 90vw)';
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' } as const;

function tooltipTextOutline(color = '#C9A44C') {
    return {
        WebkitTextStroke: isNearBlack(color) ? TOOLTIP_OUTLINE_LIGHT : TOOLTIP_OUTLINE_DARK,
        paintOrder: 'stroke fill',
    } as const;
}

function isNearBlack(color: string) {
    const normalized = color.trim().toLowerCase();
    if (normalized === '#000' || normalized === '#000000' || normalized === 'black') return true;
    const match = /^#([0-9a-f]{6})$/i.exec(normalized);
    if (!match) return false;
    const value = Number.parseInt(match[1], 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return (red + green + blue) / 3 < 32;
}

export default function ChartTooltip({
    chartData,
    areaConfigs,
    valueFormat,
    tooltipProps,
    compact = false,
    showTotal = false,
    isCapturing = false,
}: ChartTooltipProps) {
    if (!tooltipProps.active || !tooltipProps.label) return null;

    const tooltipLabel = String(tooltipProps.label);
    const rowData = chartData.find((row) => row.fecha === tooltipLabel || row.iso_fecha === tooltipLabel);

    if (!rowData) return null;

    if (areaConfigs.some(area => area.comparisonMode === 'mandate-month') && typeof rowData.comparison_group === 'string') {
        const comparisons = chartData.filter(row => row.comparison_group === rowData.comparison_group && typeof row.icg === 'number');
        return (
            <div key={tooltipLabel} data-crosshair-tip="" data-compact={compact || undefined} style={{ backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #C9A44C', padding: compact ? '4px' : '10px', color: '#E8E2D0', maxWidth: compact ? '176px' : undefined, maxHeight: compact ? '38vh' : undefined, overflowY: compact ? 'auto' : undefined, fontSize: compact ? '12px' : '14px', lineHeight: compact ? 1.05 : undefined, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}>
                <div style={{ fontWeight: 'bold', marginBottom: compact ? '2px' : '4px', ...tooltipTextOutline() }}>{rowData.fecha}</div>
                {comparisons.map(row => {
                    const primaryColor = String(row.mandate_color ?? '#C9A44C');
                    const secondaryColor = typeof row.mandate_secondary_color === 'string' ? row.mandate_secondary_color : primaryColor;
                    return (
                        <div key={String(row.iso_fecha)} style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            <span style={{ color: primaryColor, ...tooltipTextOutline(primaryColor) }}>{row.mandate_name}: </span>
                            <span style={{ color: secondaryColor, ...tooltipTextOutline(secondaryColor) }}>{Number(row.icg).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

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
                        fontSize: compact ? (isCurrent ? '13px' : '12px') : (isCurrent ? '15px' : '14px'),
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        color: isCurrent ? '#C9A44C' : '#9B59B6',
                        marginBottom: compact ? '1px' : '2px',
                        borderBottom: isCurrent ? '1px solid #666' : 'none',
                        paddingBottom: isCurrent ? (compact ? '2px' : '4px') : '0',
                        ...tooltipTextOutline(isCurrent ? '#C9A44C' : '#9B59B6'),
                    }}
                >
                    {SPANISH_MONTHS[month]} {String(row.year).slice(-2)}: {Number(row.pctPbi ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% PIB
                </div>
            );
        });

        return (
            <div key={tooltipLabel} data-crosshair-tip="" data-compact={compact || undefined} style={{ backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #C9A44C', padding: compact ? '4px' : '10px', color: '#E8E2D0', minWidth: compact ? '112px' : '180px', maxWidth: compact ? '176px' : undefined, maxHeight: compact ? '38vh' : undefined, overflowY: compact ? 'auto' : undefined, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}>
                {rows}
            </div>
        );
    }

    const allRows = areaConfigs
        .filter(area => !area.hideInTooltip)
        .map(area => renderValueRow(rowData, area, valueFormat))
        .filter((row): row is NonNullable<ReturnType<typeof renderValueRow>> => row !== null);

    if (allRows.length === 0) return null;

    const valueRows = allRows.filter(row => !row.section);
    const sections = [...new Set(allRows.flatMap(row => row.section ? [row.section] : []))];
    const header = typeof rowData.tooltipHeader === 'string' ? rowData.tooltipHeader : rowData.fecha;

    const stackRows = valueRows.filter(row => row.countsTowardTotal);
    const separatedRows = valueRows.filter(row => !row.countsTowardTotal);
    const showStackTotal = showTotal && stackRows.length > 1;
    const total = showStackTotal ? stackRows.reduce((sum, row) => sum + row.value, 0) : null;
    const totalFormat = stackRows[0]?.format ?? valueFormat;
    const separateFooter = separatedRows.length > 0 && stackRows.length > 0;

    const renderRow = (row: (typeof valueRows)[number]) => compact || isCapturing ? (
        <div key={row.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: compact ? 'space-between' : 'flex-start', gap: compact ? '4px' : '4px', height: isCapturing ? '22px' : undefined, lineHeight: isCapturing ? '22px' : undefined, padding: row.tooltipBackgroundColor ? '1px 4px' : undefined, backgroundColor: row.tooltipBackgroundColor, borderRadius: row.tooltipBackgroundColor ? '2px' : undefined, fontWeight: 'bold' }}>
            <span style={{ color: row.color, minWidth: 0, ...WRAP, ...tooltipTextOutline(row.color) }}>{row.name}</span>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0, color: row.secondaryColor ?? row.color, ...tooltipTextOutline(row.secondaryColor ?? row.color) }}>{compact ? row.formatted : `: ${row.formatted}`}</span>
        </div>
    ) : row.node;

    return (
        <div key={tooltipLabel} data-crosshair-tip="" data-compact={compact || undefined} style={{ backgroundColor: TOOLTIP_BACKGROUND, border: '1px solid #C9A44C', padding: compact ? '4px' : '10px', color: '#E8E2D0', maxWidth: tooltipMaxWidth(compact), maxHeight: compact ? '38vh' : undefined, overflowY: compact ? 'auto' : undefined, fontSize: compact ? '12px' : '14px', lineHeight: compact ? 1.2 : 1.35, ...WRAP, backdropFilter: TOOLTIP_BLUR, WebkitBackdropFilter: TOOLTIP_BLUR }}>
            <div style={{ height: isCapturing ? '24px' : undefined, lineHeight: isCapturing ? '20px' : undefined, color: '#C9A44C', fontWeight: 'bold', marginBottom: compact ? '2px' : '4px', ...tooltipTextOutline() }}>{header}</div>
            {(separateFooter ? stackRows : valueRows).map(renderRow)}
            {separateFooter ? (
                <div style={{ marginTop: compact ? '3px' : '6px', paddingTop: compact ? '3px' : '6px', borderTop: '1px solid #666' }}>
                    {separatedRows.map(renderRow)}
                </div>
            ) : null}
            {showStackTotal && total != null ? (
                <div style={{ marginTop: compact ? '3px' : '6px', paddingTop: compact ? '3px' : '6px', borderTop: '1px solid #666', color: '#C9A44C', fontWeight: 'bold', ...tooltipTextOutline() }}>
                    Total: {formatValueByType(total, totalFormat, 1)}
                </div>
            ) : null}
            {sections.map(section => (
                <div key={section} data-tooltip-section="" style={{ marginTop: compact ? '4px' : '8px', padding: compact ? '2px 4px' : '4px 6px', border: '1px dotted #C9A44C', borderRadius: '3px' }}>
                    <div style={{ color: '#C9A44C', fontWeight: 'bold', marginBottom: compact ? '1px' : '2px', ...tooltipTextOutline() }}>{section}</div>
                    {allRows.filter(row => row.section === section).map(renderRow)}
                </div>
            ))}
        </div>
    );
}

function renderValueRow(rowData: ChartDataRow, area: ChartTooltipProps['areaConfigs'][number], valueFormat: ChartTooltipProps['valueFormat']) {
    const value = rowData[area.key] ?? (area.tooltipFallbackKey ? rowData[area.tooltipFallbackKey] : null);
    if (value === null || value === undefined) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const format = area.valueFormat ?? valueFormat;
    const color = area.tooltipColor ?? area.color;

    return {
        key: area.key,
        name: area.name,
        color,
        secondaryColor: area.secondaryColor,
        tooltipBackgroundColor: area.tooltipBackgroundColor,
        value: numericValue,
        format,
        section: area.tooltipSection,
        countsTowardTotal: area.type === 'bar' || Boolean(area.stackId),
        formatted: formatValueByType(numericValue, format, area.valueDecimals ?? 1),
        node: (
            <div key={area.key} style={{ padding: area.tooltipBackgroundColor ? '1px 4px' : undefined, backgroundColor: area.tooltipBackgroundColor, borderRadius: area.tooltipBackgroundColor ? '2px' : undefined, fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ color, minWidth: 0, ...WRAP, ...tooltipTextOutline(color) }}>{area.name}:</span>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0, color: area.secondaryColor ?? color, ...tooltipTextOutline(area.secondaryColor ?? color) }}>{formatValueByType(numericValue, format, area.valueDecimals ?? 1)}</span>
            </div>
        ),
    };
}
