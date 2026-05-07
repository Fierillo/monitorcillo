'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type {
    ChartAxisDomain,
    ChartDataRow,
    IndicatorCompositeViewProps,
} from '@/types/chart';
import CompositeChartCard from './indicators/CompositeChartCard';

export default function IndicatorCompositeView({
    title,
    subtitle,
    chartTitle,
    data,
    areas,
    methodology,
    valueFormat = 'billions',
    yAxisDecimals = 0,
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

            <CompositeChartCard
                chartTitle={chartTitle} captureRef={captureRef} chartContainerRef={chartContainerRef}
                chartSize={chartSize} visibleData={visibleData} sortedData={sortedData}
                areas={areas} methodology={methodology} valueFormat={valueFormat}
                yAxisDecimals={yAxisDecimals} yAxisLabel={yAxisLabel} secondaryYAxis={secondaryYAxis}
                leftAxisDomain={leftAxisDomain} xAxisKey={xAxisKey} labelByXAxisValue={labelByXAxisValue}
                dimmedAreas={dimmedAreas} selectedMonth={selectedMonth} selectByMonth={selectByMonth}
                isMobile={isMobile} isCapturing={isCapturing}
                onDownloadChart={handleDownloadChart}
                onSelectMonth={setSelectedMonth}
                onToggleDim={handleToggleDim}
            />
        </div>
    );
}
