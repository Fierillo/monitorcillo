'use client';

import { Bar, Rectangle } from 'recharts';
import type { ChartBarProps, ChartBarShapeProps, ChartSeriesClickEvent } from '@/types/chart';
import { handleSeriesCtrlClick } from './seriesInteraction';

export default function ChartBar({
    areaConfig,
    isDimmed,
    selectedMonth,
    onSelectMonth,
    selectByMonth,
    isCapturing = false,
    onCtrlClick,
}: ChartBarProps) {
    return (
        <Bar
            dataKey={areaConfig.key}
            stackId={areaConfig.stackId}
            maxBarSize={areaConfig.maxBarSize}
            fill={areaConfig.color}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            isAnimationActive={!isCapturing}
            onClick={(data: unknown, _index: number, event: ChartSeriesClickEvent) => {
                if (handleSeriesCtrlClick(event, onCtrlClick)) return;
                if (event && event.stopPropagation) {
                    event.stopPropagation();
                }
                const isoFecha = getBarIsoFecha(data);
                if (isoFecha) {
                    const monthValue = selectByMonth ? isoFecha.slice(5, 7) : isoFecha;
                    onSelectMonth(selectedMonth === monthValue ? null : monthValue);
                }
            }}
            shape={(props: ChartBarShapeProps) => {
                const { payload, x, y, width, height } = props;
                const barHeight = height ?? 0;
                const barY = barHeight < 0 ? (y ?? 0) + barHeight : y;
                const barAbsHeight = Math.abs(barHeight);
                const monthValue = selectByMonth ? payload?.iso_fecha?.slice(5, 7) : payload?.iso_fecha;
                const isSelected = selectedMonth && monthValue === selectedMonth;
                const isPreliminary = areaConfig.preliminaryKey ? payload?.[areaConfig.preliminaryKey] === true : false;
                const opacity = selectedMonth ? (isSelected ? 1 : 0.3) : 1;
                const fillOpacity = isPreliminary ? 0.45 : (areaConfig.fill === false ? 0 : 1);
                const strokeColor = areaConfig.borderColor ?? (isSelected ? '#FFFFFF' : isPreliminary ? areaConfig.color : 'none');
                const strokeWidth = areaConfig.borderWidth ?? (isSelected || isPreliminary ? 1 : 0);
                const borderInset = strokeWidth / 2;
                const rectX = (x ?? 0) + borderInset;
                const rectY = (barY ?? 0) + borderInset;
                const rectWidth = Math.max(0, (width ?? 0) - strokeWidth);
                const rectHeight = Math.max(0, barAbsHeight - strokeWidth);
                const dash = areaConfig.dash;
                const patternId = `bar-pattern-${areaConfig.key}-${payload?.iso_fecha ?? 'row'}`.replace(/[^a-zA-Z0-9-_]/g, '-');
                if (isPreliminary) {
                    return (
                        <g>
                            {areaConfig.preliminaryFillPattern === 'diagonal-stripes' ? (
                                <defs>
                                    <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                        <rect width="6" height="6" fill={areaConfig.preliminaryColor ?? areaConfig.color} />
                                        <line x1="0" y1="0" x2="0" y2="6" stroke="#00143F" strokeOpacity="0.55" strokeWidth="2" />
                                    </pattern>
                                </defs>
                            ) : null}
                            <Rectangle
                                x={rectX}
                                y={rectY}
                                width={rectWidth}
                                height={rectHeight}
                                fill={areaConfig.preliminaryFillPattern === 'diagonal-stripes' ? `url(#${patternId})` : (areaConfig.preliminaryColor ?? areaConfig.color)}
                                stroke={areaConfig.preliminaryBorderColor ?? areaConfig.color}
                                strokeWidth={areaConfig.borderWidth ?? 1}
                                style={{ opacity: isDimmed ? opacity * 0.2 : opacity, cursor: 'pointer', outline: 'none' }}
                            />
                        </g>
                    );
                }

                return (
                    <g>
                        {areaConfig.fillPattern === 'diagonal-stripes' ? (
                            <defs>
                                <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width="6" height="6" fill={areaConfig.color} />
                                    <line x1="0" y1="0" x2="0" y2="6" stroke="#00143F" strokeOpacity="0.55" strokeWidth="2" />
                                </pattern>
                            </defs>
                        ) : null}
                        <Rectangle
                            x={rectX}
                            y={rectY}
                            width={rectWidth}
                            height={rectHeight}
                            fill={areaConfig.fillPattern === 'diagonal-stripes' ? `url(#${patternId})` : areaConfig.color}
                            fillOpacity={fillOpacity}
                            stroke={strokeColor}
                            strokeDasharray={dash ? dash.join(' ') : (isPreliminary && !isSelected ? '4 3' : undefined)}
                            strokeWidth={strokeWidth}
                            style={{
                                opacity: isDimmed ? opacity * 0.2 : opacity,
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        />
                    </g>
                );
            }}
        />
    );
}

function getBarIsoFecha(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const row = data as Record<string, unknown>;
    if (typeof row.iso_fecha === 'string') return row.iso_fecha;

    const payload = row.payload;
    if (!payload || typeof payload !== 'object') return null;
    const payloadRow = payload as Record<string, unknown>;
    return typeof payloadRow.iso_fecha === 'string' ? payloadRow.iso_fecha : null;
}
