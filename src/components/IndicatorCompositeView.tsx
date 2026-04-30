'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { ImageDown } from 'lucide-react';
import { ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type {
    ChartAxisDomain,
    ChartClickState,
    ChartDataRow,
    IndicatorCompositeViewProps,
} from '@/types/chart';
import { formatValueByType } from './chart/utils';
import ChartTooltip from './chart/ChartTooltip';
import CustomLegend from './chart/CustomLegend';
import ChartBar from './chart/ChartBar';
import ChartLine from './chart/ChartLine';
import ChartArea from './chart/ChartArea';
import MethodologySection from './chart/MethodologySection';

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
    indicatorId,
}: IndicatorCompositeViewProps) {
    const selectByMonth = indicatorId === 'recaudacion';
    const sortedData = useMemo(() => {
        const getSortKey = (row: ChartDataRow) => {
            if (typeof row?.iso_fecha === 'string' && row.iso_fecha) return row.iso_fecha;
            if (typeof row?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return row.fecha;
            return '';
        };

        return [...data].sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));
    }, [data]);

    const xAxisKey = useMemo(() => {
        return sortedData.every((row) => typeof row?.iso_fecha === 'string' && row.iso_fecha) ? 'iso_fecha' : 'fecha';
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
    const [isCapturing, setIsCapturing] = useState(false);

    const visibleData = sortedData;

    useEffect(() => {
        if (selectedMonth && selectByMonth) {
            const hasMonth = visibleData.some((row) => row.iso_fecha?.slice(5, 7) === selectedMonth);
            if (!hasMonth) setSelectedMonth(null);
        } else if (selectedMonth && !visibleData.some((row) => (row.iso_fecha || row.fecha) === selectedMonth)) {
            setSelectedMonth(null);
        }
    }, [visibleData, selectedMonth, selectByMonth]);

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

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const leftAxisDomain: ChartAxisDomain = useMemo(() => {
        if (Array.isArray(leftYAxisDomain)) return leftYAxisDomain;

        const allValues: number[] = [];
        visibleData.forEach((row) => {
            areas.forEach(area => {
                if (dimmedAreas.has(area.legendKey || area.key)) return;
                const val = row[area.key];
                if (typeof val === 'number' && !Number.isNaN(val)) {
                    allValues.push(val);
                }
            });
        });

        if (allValues.length === 0) return [0, 10];

        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const range = max - min;
        
        if (leftYAxisDomain === 'auto-pad') {
            const pad = range * 0.1;
            return [min < 0 ? min - pad : 0, max + pad];
        }
        
        if (leftYAxisDomain === 'auto' || !leftYAxisDomain) {
            const pad = range === 0 ? 1 : range * 0.05;
            return [min < 0 ? min - pad : 0, max + pad];
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
            setIsCapturing(true);
            
            // Wait for React to re-render with the methodology section open
            await new Promise(resolve => setTimeout(resolve, 400));

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
        } finally {
            setIsCapturing(false);
        }
    }, [title]);

    if (!sortedData || sortedData.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-2 sm:p-6 lg:p-10">
            <header className="w-full sm:w-[96%] max-w-[1800px] mb-4 sm:mb-8 border-b-2 border-imperial-gold pb-4 mt-2 sm:mt-4 flex items-center justify-between px-2">
                <div>
                    <h1 className="imperial-title text-xl sm:text-3xl font-bold tracking-widest text-imperial-gold leading-tight uppercase">
                        {title}
                    </h1>
                    {subtitle && <p className="text-imperial-cyan mt-1 font-bold text-xs sm:text-base">{subtitle}</p>}
                </div>
                <Link
                    href="/"
                    className="shrink-0 border-2 border-imperial-gold text-imperial-gold px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-base font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors uppercase"
                >
                    Volver
                </Link>
            </header>

            <main className="w-full sm:w-[96%] max-w-[1800px]">
                <div
                    className="w-full min-h-[600px] sm:min-h-[850px] bg-imperial-blue border-2 border-imperial-gold p-2 sm:p-4 shadow-lg shadow-imperial-blue/50 flex flex-col overflow-hidden"
                    style={{ outline: 'none' }}
                    tabIndex={-1}
                >
                    <div
                        ref={captureRef}
                        className="flex-1 flex flex-col bg-imperial-blue overflow-hidden"
                        style={{ outline: 'none' }}
                        tabIndex={-1}
                    >
                        <div className="flex flex-col sm:flex-row items-center justify-between mb-2 shrink-0 gap-2" style={{ outline: 'none' }}>
                            <div className="hidden sm:flex flex-1" />
                            <h2 className="text-imperial-gold text-base sm:text-xl font-bold uppercase tracking-widest text-center flex-1">
                                {chartTitle}
                            </h2>
                            <div className="flex-1 flex justify-end gap-2 w-full sm:w-auto">
                                <button
                                    onClick={handleDownloadChart}
                                    className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
                                    title="Descargar gráfico"
                                >
                                    <ImageDown size={16} />
                                    Guardar
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-row relative min-h-[300px] sm:min-h-[500px] overflow-hidden" style={{ outline: 'none' }}>
                            {!isMobile && yAxisLabel && (
                                <div className="flex items-center justify-center w-12 shrink-0">
                                    <div className="-rotate-90 whitespace-nowrap text-imperial-gold font-bold text-xs uppercase tracking-widest">
                                        {yAxisLabel}
                                    </div>
                                </div>
                            )}

                            <div ref={chartContainerRef} className="relative flex-1 overflow-hidden" style={{ outline: 'none' }} tabIndex={-1}>
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 select-none">
                                    <span className="watermark text-imperial-gold/10 text-xl sm:text-4xl font-sans font-bold uppercase tracking-[0.5em]">
                                        @fierillo
                                    </span>
                                </div>
                                {chartSize.width > 0 && chartSize.height > 0 ? (
                                    <ComposedChart
                                        width={chartSize.width}
                                        height={chartSize.height}
                                        data={visibleData}
                                        margin={{ top: 5, right: isMobile ? 5 : 20, bottom: 5, left: isMobile ? 5 : 20 }}
                                        barCategoryGap="0%"
                                        stackOffset="sign"
                                        style={{ outline: 'none' }}
                                        onClick={(e: ChartClickState | null) => {
                                            if (!e || !e.activePayload || e.activePayload.length === 0 || !e.activeTooltipIndex) {
                                                setSelectedMonth(null);
                                            }
                                        }}
                                    >
                                        <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey={xAxisKey}
                                            stroke="#FFD700"
                                            tick={{ fill: '#FFD700', fontSize: 10 }}
                                            tickFormatter={(value: string | number) => labelByXAxisValue.get(String(value)) ?? String(value)}
                                            hide={isMobile}
                                        />
                                        <YAxis
                                            stroke="#FFD700"
                                            tick={{ fill: '#FFD700', fontSize: 10 }}
                                            tickFormatter={(val) => formatValueByType(val, valueFormat)}
                                            tickCount={10}
                                            domain={leftAxisDomain}
                                            allowDataOverflow={false}
                                            yAxisId="left"
                                            width={isMobile ? 0 : 60}
                                            hide={isMobile}
                                        />
                                        {secondaryYAxis && (
                                            <YAxis
                                                orientation="right"
                                                stroke={secondaryYAxis.color || "#00BFFF"}
                                                tick={{
                                                    fill: secondaryYAxis.color || "#00BFFF",
                                                    fontSize: 10
                                                }}
                                                tickFormatter={(val) => formatValueByType(val, secondaryYAxis.format)}
                                                tickCount={10}
                                                domain={secondaryYAxis?.domain && secondaryYAxis.domain !== 'auto' ? secondaryYAxis.domain : ['auto', 'auto']}
                                                allowDataOverflow={false}
                                                yAxisId="right"
                                                width={isMobile ? 0 : 60}
                                                hide={isMobile}
                                            />
                                        )}
                                        {!isCapturing && (
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
                                        )}
                                        {areas.map((areaConfig) => {
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
                                                        selectByMonth={selectByMonth}
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

                            {!isMobile && secondaryYAxis && (
                                <div className="flex items-center justify-center w-12 shrink-0">
                                    <div className="rotate-90 whitespace-nowrap font-bold text-xs uppercase tracking-widest" style={{ color: secondaryYAxis.color || "#00BFFF" }}>
                                        {secondaryYAxis.label}
                                    </div>
                                </div>
                            )}
                        </div>

                        <CustomLegend
                            areas={areas}
                            dimmedAreas={dimmedAreas}
                            onToggleDim={handleToggleDim}
                        />

                        <MethodologySection methodology={methodology} forceOpen={isCapturing} />
                    </div>
                </div>
            </main>
        </div>
    );
}
