'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { ImageDown } from 'lucide-react';
import { ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
    AreaConfig,
    MethodologyItem,
    YAxisConfig,
    IndicatorCompositeViewProps,
    ValueFormat,
} from '@/types/chart';
import { formatValueByType } from './chart/utils';
import ChartTooltip from './chart/ChartTooltip';
import CustomLegend from './chart/CustomLegend';
import ChartBar from './chart/ChartBar';
import ChartLine from './chart/ChartLine';
import ChartArea from './chart/ChartArea';
import MethodologySection from './chart/MethodologySection';

export type { AreaConfig, MethodologyItem, YAxisConfig, ValueFormat } from '@/types/chart';

export default function IndicatorCompositeView({
    title,
    subtitle,
    chartTitle,
    data,
    areas,
    methodology,
    valueFormat = 'billions',
    yAxisLabel,
    secondaryYAxis,
    leftYAxisDomain,
}: IndicatorCompositeViewProps) {
    const sortedData = useMemo(() => {
        const getSortKey = (row: any) => {
            if (typeof row?.iso_fecha === 'string' && row.iso_fecha) return row.iso_fecha;
            if (typeof row?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return row.fecha;
            return '';
        };

        return [...data].sort((a: any, b: any) => getSortKey(a).localeCompare(getSortKey(b)));
    }, [data]);

    const xAxisKey = useMemo(() => {
        return sortedData.every((row: any) => typeof row?.iso_fecha === 'string' && row.iso_fecha) ? 'iso_fecha' : 'fecha';
    }, [sortedData]);

    const labelByXAxisValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const row of sortedData) {
            if (row?.[xAxisKey] != null && row?.fecha != null) {
                map.set(String(row[xAxisKey]), String(row.fecha));
            }
        }
        return map;
    }, [sortedData, xAxisKey]);

    const captureRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [dimmedAreas, setDimmedAreas] = useState<Set<string>>(new Set());
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

    const visibleData = sortedData;

    useEffect(() => {
        if (selectedMonth && !visibleData.some((row: any) => (row.iso_fecha || row.fecha) === selectedMonth)) {
            setSelectedMonth(null);
        }
    }, [visibleData, selectedMonth]);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const element = chartContainerRef.current;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setChartSize({
                width: Math.max(0, Math.floor(rect.width)),
                height: Math.max(0, Math.floor(rect.height)),
            });
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const leftAxisDomain: any = useMemo(() => {
        if (leftYAxisDomain && leftYAxisDomain !== 'auto-pad' && leftYAxisDomain !== 'auto') return leftYAxisDomain;
        if (!visibleData || visibleData.length === 0) return [0, 10];

        const allValues: number[] = [];
        visibleData.forEach((row: any) => {
            areas.forEach(area => {
                if (dimmedAreas.has(area.legendKey || area.key)) return;
                const val = row[area.key];
                if (val !== null && val !== undefined && !isNaN(val)) {
                    allValues.push(val);
                }
            });
        });

        if (allValues.length === 0) return [0, 10];

        const min = Math.min(...allValues);
        const max = Math.max(...allValues);

        if (leftYAxisDomain === 'auto-pad' || leftYAxisDomain === 'auto') {
            const pad = leftYAxisDomain === 'auto-pad' ? (max - min) * 0.1 : 0;
            return [min - pad, max + pad];
        }

        return [min, max];
    }, [visibleData, areas, leftYAxisDomain, dimmedAreas]);

    const handleToggleDim = useCallback((key: string) => {
        setDimmedAreas(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const handleDownloadChart = useCallback(async () => {
        if (!captureRef.current) return;

        try {
            const dataUrl = await toPng(captureRef.current, {
                backgroundColor: '#00143F',
                pixelRatio: 2,
                filter: (node) => !node.classList?.contains('no-capture'),
            });

            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error al descargar el gráfico:', err);
        }
    }, [title]);

    if (!sortedData || sortedData.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-6 lg:p-10">
            <header className="w-[96%] max-w-[1800px] mb-8 border-b-2 border-imperial-gold pb-4 mt-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-imperial-gold leading-tight uppercase">
                        {title}
                    </h1>
                    {subtitle && <p className="text-imperial-cyan mt-1 font-bold">{subtitle}</p>}
                </div>
                <Link
                    href="/"
                    className="shrink-0 border-2 border-imperial-gold text-imperial-gold px-4 py-2 font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors uppercase"
                >
                    Volver
                </Link>
            </header>

            <main className="w-[96%] max-w-[1800px]">
                <div
                    className="w-full h-[850px] bg-imperial-blue border-2 border-imperial-gold p-4 shadow-lg shadow-imperial-blue/50 flex flex-col"
                    style={{ outline: 'none' }}
                    tabIndex={-1}
                >
                    <div
                        ref={captureRef}
                        className="flex-1 flex flex-col bg-imperial-blue"
                        style={{ outline: 'none' }}
                        tabIndex={-1}
                    >
                        <div className="flex items-center justify-between mb-2 shrink-0" style={{ outline: 'none' }}>
                            <div className="flex-1" />
                            <h2 className="text-imperial-gold text-xl font-bold uppercase tracking-widest text-center flex-1">
                                {chartTitle}
                            </h2>
                            <div className="flex-1 flex justify-end gap-2">
                                <button
                                    onClick={handleDownloadChart}
                                    className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-2 text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2"
                                    title="Descargar gráfico"
                                >
                                    <ImageDown size={18} />
                                    Guardar
                                </button>
                            </div>
                        </div>

                        <div ref={chartContainerRef} className="flex-1 min-h-0" style={{ outline: 'none', minHeight: '500px' }} tabIndex={-1}>
                            {chartSize.width > 0 && chartSize.height > 0 ? (
                                <ComposedChart
                                    width={chartSize.width}
                                    height={chartSize.height}
                                    data={visibleData}
                                    margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                                    barCategoryGap="0%"
                                    stackOffset="sign"
                                    style={{ outline: 'none' }}
                                    onClick={(e: any) => {
                                        if (!e || !e.activePayload || e.activePayload.length === 0 || !e.activeTooltipIndex) {
                                            setSelectedMonth(null);
                                        }
                                    }}
                                >
                                    <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey={xAxisKey}
                                        stroke="#FFD700"
                                        tick={{ fill: '#FFD700', fontSize: 12 }}
                                        tickFormatter={(value: string | number) => labelByXAxisValue.get(String(value)) ?? String(value)}
                                    />
                                    <YAxis
                                        stroke="#FFD700"
                                        tick={{ fill: '#FFD700', fontSize: 12 }}
                                        tickFormatter={(val) => formatValueByType(val, valueFormat)}
                                        tickCount={10}
                                        label={{
                                            value: yAxisLabel,
                                            angle: -90,
                                            position: 'left',
                                            fill: '#FFD700',
                                            fontSize: 14,
                                            fontWeight: 'bold',
                                            dy: -30
                                        }}
                                        domain={leftAxisDomain}
                                        allowDataOverflow={true}
                                        yAxisId="left"
                                    />
                                    {secondaryYAxis && (
                                        <YAxis
                                            orientation="right"
                                            stroke={secondaryYAxis.color || "#00BFFF"}
                                            tick={{
                                                fill: secondaryYAxis.color || "#00BFFF",
                                                fontSize: 12
                                            }}
                                            tickFormatter={(val) => formatValueByType(val, secondaryYAxis.format)}
                                            tickCount={10}
                                            label={{
                                                value: secondaryYAxis.label,
                                                angle: 90,
                                                position: 'right',
                                                fill: secondaryYAxis.color || "#00BFFF",
                                                fontSize: 14,
                                                fontWeight: 'bold',
                                                dy: -30
                                            }}
                                            domain={secondaryYAxis?.domain && secondaryYAxis.domain !== 'auto' ? secondaryYAxis.domain : ['auto', 'auto']}
                                            allowDataOverflow={true}
                                            yAxisId="right"
                                        />
                                    )}
                                    <Tooltip
                                        cursor={{ stroke: '#ffffff50', strokeWidth: 1 }}
                                        content={(props) => (
                                            <ChartTooltip
                                                chartData={sortedData}
                                                areaConfigs={areas}
                                                valueFormat={valueFormat}
                                                tooltipProps={props}
                                            />
                                        )}
                                    />
                                    {areas.map((areaConfig: AreaConfig) => {
                                        const isDimmed = dimmedAreas.has(areaConfig.legendKey || areaConfig.key);

                                        if (isDimmed) return null;

                                        if (areaConfig.type === 'line') {
                                            return <ChartLine key={areaConfig.key} areaConfig={areaConfig} isDimmed={false} />;
                                        }

                                        if (areaConfig.type === 'bar') {
                                            return (
                                                <ChartBar
                                                    key={areaConfig.key}
                                                    areaConfig={areaConfig}
                                                    isDimmed={false}
                                                    selectedMonth={selectedMonth}
                                                    onSelectMonth={setSelectedMonth}
                                                />
                                            );
                                        }

                                        return <ChartArea key={areaConfig.key} areaConfig={areaConfig} isDimmed={false} />;
                                    })}
                                </ComposedChart>
                            ) : (
                                <div className="h-full min-h-[500px] w-full flex items-center justify-center text-imperial-cyan font-bold">
                                    Cargando gráfico...
                                </div>
                            )}
                        </div>

                        <CustomLegend
                            areas={areas}
                            dimmedAreas={dimmedAreas}
                            onToggleDim={handleToggleDim}
                        />

                        <MethodologySection methodology={methodology} />
                    </div>
                </div>
            </main>
        </div>
    );
}
