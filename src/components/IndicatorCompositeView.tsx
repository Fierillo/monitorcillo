'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState, useCallback, useMemo } from 'react';
import { ImageDown } from 'lucide-react';
import { ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
import InteractiveBar from './chart/InteractiveBar';
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
    leftYAxisDomain
}: IndicatorCompositeViewProps) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [activeMonth, setActiveMonth] = useState<string | null>(null);
    const [dimmedAreas, setDimmedAreas] = useState<Set<string>>(new Set());

    const leftAxisDomain: any = useMemo(() => {
        if (leftYAxisDomain && leftYAxisDomain !== 'auto-pad' && leftYAxisDomain !== 'auto') return leftYAxisDomain;
        if (!data || data.length === 0) return [0, 10];

        const allValues: number[] = [];
        data.forEach((row: any) => {
            areas.forEach(area => {
                if (dimmedAreas.has(area.key)) return;
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
    }, [data, areas, leftYAxisDomain, dimmedAreas]);

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

    if (!data || data.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-8">
            <header className="w-full max-w-6xl mb-8 border-b-2 border-imperial-gold pb-4 mt-4 flex items-center justify-between">
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

            <main className="w-full max-w-6xl">
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
                            <div className="flex-1 flex justify-end">
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

                        <div className="flex-1 min-h-0" style={{ outline: 'none', minHeight: '500px' }} tabIndex={-1}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={data}
                                    margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                                    style={{ outline: 'none' }}
                                    onClick={(e: any) => {
                                        if (!e || !e.activePayload || e.activePayload.length === 0 || !e.activeTooltipIndex) {
                                            setSelectedMonth(null);
                                        }
                                    }}
                                >
                                    <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="fecha"
                                        stroke="#FFD700"
                                        tick={{ fill: '#FFD700', fontSize: 12 }}
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
                                        content={(props) => (
                                            <ChartTooltip
                                                chartData={data}
                                                areaConfigs={areas}
                                                valueFormat={valueFormat}
                                                tooltipProps={props}
                                            />
                                        )}
                                    />
                                    {areas.map((areaConfig: AreaConfig) => {
                                        const isDimmed = dimmedAreas.has(areaConfig.key);

                                        if (isDimmed) return null;

                                        if (areaConfig.type === 'line') {
                                            return <ChartLine key={areaConfig.key} areaConfig={areaConfig} isDimmed={false} />;
                                        }

                                        if (areaConfig.type === 'bar') {
                                            return (
                                                <InteractiveBar
                                                    key={areaConfig.key}
                                                    areaConfig={areaConfig}
                                                    isDimmed={false}
                                                    selectedMonth={selectedMonth}
                                                    activeMonth={activeMonth}
                                                    onSelectMonth={setSelectedMonth}
                                                    onSetActiveMonth={setActiveMonth}
                                                />
                                            );
                                        }

                                        return <ChartArea key={areaConfig.key} areaConfig={areaConfig} isDimmed={false} />;
                                    })}
                                </ComposedChart>
                            </ResponsiveContainer>
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
