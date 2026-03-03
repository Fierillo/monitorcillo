'use client';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState } from 'react';
import { ImageDown } from 'lucide-react';

export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    stackId?: string;
    type?: 'monotone' | 'step' | 'line' | 'bar';
    yAxisId?: 'left' | 'right';
}

export interface MethodologyItem {
    title: string;
    description: string;
}

export interface YAxisConfig {
    label?: string;
    color?: string;
    format?: 'billions' | 'index' | 'millions' | 'percent';
    domain?: [number, number] | 'auto';
}

interface IndicatorCompositeViewProps {
    title: string;
    subtitle?: string;
    chartTitle: string;
    data: any[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat?: 'billions' | 'index' | 'millions' | 'percent';
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
}

export default function IndicatorCompositeView({
    title,
    subtitle,
    chartTitle,
    data,
    areas,
    methodology,
    valueFormat = 'billions',
    yAxisLabel,
    secondaryYAxis
}: IndicatorCompositeViewProps) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [activeMonth, setActiveMonth] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

    const downloadChart = async () => {
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
    };

    if (!data || data.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    const formatYAxis = (val: number) => {
        if (valueFormat === 'index') return val.toFixed(1);
        if (valueFormat === 'millions') return `$${val.toLocaleString('es-AR')}`;
        if (valueFormat === 'billions') return `$${(val / 1000000).toFixed(0)}B`;
        if (valueFormat === 'percent') return `${val.toFixed(1)}%`;
        return `${(val / 1000000).toFixed(1)}B`;
    };

    const formatSecondaryYAxis = (val: number) => {
        if (secondaryYAxis?.format === 'percent') return `${val.toFixed(1)}%`;
        if (secondaryYAxis?.format === 'millions') return `$${val.toLocaleString('es-AR')}`;
        if (secondaryYAxis?.format === 'billions') return `$${(val / 1000000).toFixed(0)}B`;
        return val.toFixed(1);
    };

    // Calcular dominio dinámico con padding (solo eje izquierdo)
    const scaleFactor = valueFormat === 'billions' ? 1000000 : valueFormat === 'millions' ? 1000000 : valueFormat === 'percent' ? 1 : 1;
    const leftAreas = areas.filter(a => !a.yAxisId || a.yAxisId === 'left');
    const allValues = data.flatMap((row: any) =>
        leftAreas.map(area => row[area.key]).filter((v: any) => v !== null && v !== undefined && !isNaN(v))
    );
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const scaledMin = dataMin / scaleFactor;
    const scaledMax = dataMax / scaleFactor;
    const padding = (scaledMax - scaledMin) * 0.05;
    const yDomain = [Math.floor(scaledMin - padding), Math.ceil(scaledMax + padding)];

    // Calculate secondary Y axis domain
    const secondaryArea = areas.find(a => a.yAxisId === 'right');
    const secondaryValues = secondaryArea 
        ? data.map((row: any) => row[secondaryArea.key]).filter((v: any) => v !== null && v !== undefined && !isNaN(v))
        : [];
    const secondaryDataMin = secondaryValues.length > 0 ? Math.min(...secondaryValues) : 0;
    const secondaryDataMax = secondaryValues.length > 0 ? Math.max(...secondaryValues) : 10;
    const secondaryPadding = (secondaryDataMax - secondaryDataMin) * 0.1 || 1;
    const secondaryYDomain = secondaryYAxis?.domain === 'auto' || !secondaryYAxis?.domain
        ? [Math.max(0, Math.floor(secondaryDataMin - secondaryPadding)), Math.ceil(secondaryDataMax + secondaryPadding)]
        : (secondaryYAxis?.domain || [0, 10]);

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
                {/* Chart Box with Methodology */}
                <div className="w-full h-[850px] bg-imperial-blue border-2 border-imperial-gold p-4 shadow-lg shadow-imperial-blue/50 flex flex-col" style={{ outline: 'none' }} tabIndex={-1}>
                    {/* Contenedor para captura - todo el contenido */}
                    <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue" style={{ outline: 'none' }} tabIndex={-1}>
                        <div className="flex items-center justify-between mb-2 shrink-0" style={{ outline: 'none' }}>
                            <div className="flex-1" />
                            <h2 className="text-imperial-gold text-xl font-bold uppercase tracking-widest text-center flex-1">
                                {chartTitle}
                            </h2>
                            <div className="flex-1 flex justify-end">
                                <button
                                    onClick={downloadChart}
                                    className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-2 text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2"
                                    title="Descargar gráfico"
                                >
                                    <ImageDown size={18} />
                                    Guardar
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0" style={{ outline: 'none' }} tabIndex={-1}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                    data={data} 
                                    margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                                    style={{ outline: 'none' }}
                                >
                                    <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 12 }} />
                                    <YAxis
                                        stroke="#FFD700"
                                        tick={{ fill: '#FFD700', fontSize: 12 }}
                                        tickFormatter={formatYAxis}
                                        tickCount={10}
                                        label={{ value: yAxisLabel, angle: -90, position: 'left', fill: '#FFD700', fontSize: 14, fontWeight: 'bold', dy: -30 }}
                                        domain={['auto', 'auto']}
                                        yAxisId="left"
                                    />
                                    {secondaryYAxis && (
                                        <YAxis
                                            orientation="right"
                                            stroke={secondaryYAxis.color || "#00BFFF"}
                                            tick={{ fill: secondaryYAxis.color || "#00BFFF", fontSize: 12 }}
                                            tickFormatter={formatSecondaryYAxis}
                                            tickCount={10}
                                            label={{ value: secondaryYAxis.label, angle: 90, position: 'right', fill: secondaryYAxis.color || "#00BFFF", fontSize: 14, fontWeight: 'bold', dy: -30 }}
                                            domain={secondaryYDomain}
                                            yAxisId="right"
                                        />
                                    )}
                                    <Tooltip
                                        content={(props) => {
                                            if (props.active && props.payload && props.payload.length > 0) {
                                                const payload = props.payload[0].payload;
                                                
                                                if (payload.pctPbi && payload.mes) {
                                                    const mesMap: Record<string, string> = {
                                                        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
                                                        '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
                                                        '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
                                                    };
                                                    
                                                    const sameMonthData = data
                                                        .filter((d: any) => d.mes === payload.mes && d.pctPbi)
                                                        .sort((a: any, b: any) => b.year - a.year);
                                                    
                                                    const rows: React.ReactNode[] = [];
                                                    sameMonthData.forEach((d: any, idx: number) => {
                                                        const isCurrent = d.year === payload.year;
                                                        
                                                        rows.push(
                                                            <div key={d.year} style={{ 
                                                                fontSize: isCurrent ? '14px' : '12px', 
                                                                fontWeight: isCurrent ? 'bold' : 'normal',
                                                                color: isCurrent ? '#FFD700' : '#9B59B6',
                                                                marginBottom: '2px',
                                                                borderBottom: isCurrent ? '1px solid #666' : 'none',
                                                                paddingBottom: isCurrent ? '4px' : '0'
                                                            }}>
                                                                {mesMap[payload.mes]} {String(d.year).slice(-2)}: {d.pctPbi.toFixed(2)}% PIB
                                                            </div>
                                                        );
                                                    });
                                                    
                                                    return (
                                                        <div style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF', minWidth: '180px' }}>
                                                            {rows}
                                                        </div>
                                                    );
                                                }
                                            }
                                            
                                            return (
                                                <div style={{ backgroundColor: '#00143F', border: '1px solid #FFD700', padding: '10px', color: '#FFF' }}>
                                                    {props.label}
                                                </div>
                                            );
                                        }}
                                    />
                                    <Legend wrapperStyle={{ color: '#FFD700', paddingTop: '10px' }} />
                                    {areas.map((area) => (
                                        area.type === 'line' ? (
                                            <Line
                                                key={area.key}
                                                type="monotone"
                                                dataKey={area.key}
                                                stroke={area.color}
                                                strokeWidth={3}
                                                dot={false}
                                                name={area.name}
                                                yAxisId={area.yAxisId || 'left'}
                                            />
                                        ) : area.type === 'bar' ? (
                                            <Bar
                                                key={area.key}
                                                dataKey={area.key}
                                                stackId={area.stackId || '1'}
                                                fill={area.color}
                                                name={area.name}
                                                yAxisId={area.yAxisId || 'left'}
                                                onMouseEnter={(data: any) => {
                                                    if (data && data.mes && !selectedMonth) {
                                                        setActiveMonth(data.mes);
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    if (!selectedMonth) {
                                                        setActiveMonth(null);
                                                    }
                                                }}
                                                onClick={(data: any) => {
                                                    if (data && data.mes) {
                                                        setSelectedMonth(selectedMonth === data.mes ? null : data.mes);
                                                    }
                                                }}
                                                shape={(props: any) => {
                                                    const { x, y, width, height, payload } = props;
                                                    const highlightMonth = selectedMonth || activeMonth;
                                                    const isActive = highlightMonth && payload && payload.mes === highlightMonth;
                                                    const opacity = highlightMonth ? (payload && payload.mes === highlightMonth ? 1 : 0.15) : 1;
                                                    return (
                                                        <rect
                                                            x={x}
                                                            y={y}
                                                            width={width}
                                                            height={height}
                                                            fill={area.color}
                                                            style={{ opacity, cursor: 'pointer', outline: 'none' }}
                                                        />
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <Area
                                                key={area.key}
                                                type={area.type || 'step'}
                                                dataKey={area.key}
                                                stackId={area.stackId || '1'}
                                                stroke={area.color}
                                                fill={area.color}
                                                fillOpacity={area.stackId === '2' ? 0 : 0.7}
                                                strokeWidth={area.stackId === '2' ? 2 : 1}
                                                name={area.name}
                                                yAxisId={area.yAxisId || 'left'}
                                            />
                                        )
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Methodology Section - versión compacta */}
                        <div className="mt-2 pt-2 border-t border-imperial-gold/30 shrink-0 px-2 pb-1">
                            <h3 className="text-imperial-gold font-bold text-[10px] mb-1">Fuentes y metodología</h3>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
                                {methodology.map((item, idx) => (
                                    <div key={idx} className="leading-tight">
                                        <span className="text-imperial-cyan font-bold">{item.title}:</span>{' '}
                                        <span className="text-foreground/80">{item.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
