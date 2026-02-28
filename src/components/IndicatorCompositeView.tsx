'use client';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef } from 'react';
import { ImageDown } from 'lucide-react';

export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    stackId?: string;
    type?: 'monotone' | 'step' | 'line' | 'bar';
}

export interface MethodologyItem {
    title: string;
    description: string;
}

interface IndicatorCompositeViewProps {
    title: string;
    subtitle?: string;
    chartTitle: string;
    data: any[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat?: 'billions' | 'index' | 'millions';
    yAxisLabel?: string;
}

export default function IndicatorCompositeView({
    title,
    subtitle,
    chartTitle,
    data,
    areas,
    methodology,
    valueFormat = 'billions',
    yAxisLabel
}: IndicatorCompositeViewProps) {
    const captureRef = useRef<HTMLDivElement>(null);

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
        return `${(val / 1000000).toFixed(1)}B`;
    };

    // Calcular dominio dinámico con padding
    const scaleFactor = valueFormat === 'billions' ? 1000000 : valueFormat === 'millions' ? 1000000 : 1;
    const allValues = data.flatMap((row: any) =>
        areas.map(area => row[area.key]).filter((v: any) => v !== null && v !== undefined && !isNaN(v))
    );
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const scaledMin = dataMin / scaleFactor;
    const scaledMax = dataMax / scaleFactor;
    const padding = (scaledMax - scaledMin) * 0.05;
    const yDomain = [Math.floor(scaledMin - padding), Math.ceil(scaledMax + padding)];

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
                <div className="w-full h-[850px] bg-imperial-blue border-2 border-imperial-gold p-4 shadow-lg shadow-imperial-blue/50 flex flex-col">
                    {/* Contenedor para captura - todo el contenido */}
                    <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue">
                        <div className="flex items-center justify-between mb-2 shrink-0">
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

                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                                    <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 12 }} />
                                    <YAxis
                                        stroke="#FFD700"
                                        tick={{ fill: '#FFD700', fontSize: 12 }}
                                        tickFormatter={formatYAxis}
                                        tickCount={10}
                                        label={{ value: yAxisLabel, angle: -90, position: 'left', fill: '#FFD700', fontSize: 11, fontWeight: 'bold', dx: -10, dy: -30 }}
                                        domain={yDomain}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#00143F', borderColor: '#FFD700', color: '#FFF' }}
                                        itemStyle={{ fontWeight: 'bold' }}
                                        formatter={(val: any) => {
                                            if (typeof val === 'number') {
                                                if (valueFormat === 'millions') return `$${val.toLocaleString('es-AR')}`;
                                                return val.toFixed(1);
                                            }
                                            return val ?? '-';
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
                                            />
                                        ) : area.type === 'bar' ? (
                                            <Bar
                                                key={area.key}
                                                dataKey={area.key}
                                                stackId={area.stackId || '1'}
                                                fill={area.color}
                                                name={area.name}
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
