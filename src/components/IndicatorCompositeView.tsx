'use client';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';

export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    stackId?: string;
    type?: 'monotone' | 'step' | 'line';
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
    valueFormat?: 'billions' | 'index';
}

export default function IndicatorCompositeView({
    title,
    subtitle,
    chartTitle,
    data,
    areas,
    methodology,
    valueFormat = 'billions'
}: IndicatorCompositeViewProps) {
    if (!data || data.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    const formatYAxis = (val: number) => {
        if (valueFormat === 'index') return val.toFixed(0);
        return `${(val / 1000000).toFixed(1)}B`;
    };

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

            <main className="w-full max-w-6xl flex flex-col gap-8">
                {/* Chart Box */}
                <div className="w-full h-[500px] bg-imperial-blue border-2 border-imperial-gold p-4 shadow-lg shadow-imperial-blue/50">
                    <h2 className="text-imperial-gold text-xl font-bold uppercase mb-6 tracking-widest text-center">
                        {chartTitle}
                    </h2>
                    <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                            <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
                            <XAxis dataKey="fecha" stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 12 }} />
                            <YAxis stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 12 }} tickFormatter={formatYAxis} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#00143F', borderColor: '#FFD700', color: '#FFF' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                formatter={(val: any) => new Intl.NumberFormat('es-AR').format(val || 0)}
                            />
                            <Legend wrapperStyle={{ color: '#FFD700', paddingTop: '20px' }} />
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
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Methodology Footer */}
                <div className="p-6 bg-imperial-blue/30 border-2 border-imperial-gold/20 rounded-lg shadow-inner">
                    <h3 className="text-imperial-gold font-bold uppercase text-sm mb-4 tracking-tighter border-b border-imperial-gold/20 pb-2">
                        Metodología de composición y fuentes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm leading-relaxed">
                        {methodology.map((item, idx) => (
                            <div key={idx}>
                                <h4 className="text-imperial-cyan font-bold uppercase text-xs">{item.title}</h4>
                                <p className="text-foreground/70 italic">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
