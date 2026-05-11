'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { ChartAxisDomain, ChartDataRow, IndicatorCompositeViewProps } from '@/types/chart';
import CompositeChartCard from './indicators/CompositeChartCard';

type PersistedChartConfig = {
    selectedViewId?: string;
    highlightedAreasByView?: Record<string, string[]>;
};

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
    views,
}: IndicatorCompositeViewProps) {
    const selectByMonth = indicatorId === 'recaudacion';
    const [selectedViewId, setSelectedViewId] = useState(views?.[0]?.id ?? 'default');
    const [highlightedAreasByView, setHighlightedAreasByView] = useState<Record<string, Set<string>>>({});
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const selectedView = views?.find(view => view.id === selectedViewId) ?? views?.[0];
    const activeViewId = selectedView?.id ?? selectedViewId;
    const activeChartTitle = selectedView?.chartTitle ?? chartTitle;
    const activeData = selectedView?.data ?? data;
    const activeAreas = selectedView?.areas ?? areas;
    const activeMethodology = selectedView?.methodology ?? methodology;
    const activeValueFormat = selectedView?.valueFormat ?? valueFormat;
    const activeYAxisDecimals = selectedView?.yAxisDecimals ?? yAxisDecimals;
    const activeYAxisLabel = selectedView?.yAxisLabel ?? yAxisLabel;
    const activeSecondaryYAxis = selectedView?.secondaryYAxis ?? secondaryYAxis;
    const activeLeftYAxisDomain = selectedView?.leftYAxisDomain ?? leftYAxisDomain;
    const sortedData = useMemo(() => {
        const getSortKey = (row: ChartDataRow) => {
            if (typeof row?.iso_fecha === 'string' && row.iso_fecha) return row.iso_fecha;
            if (typeof row?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return row.fecha;
            return '';
        };

        return [...activeData].sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));
    }, [activeData]);

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
    const mobileCaptureRef = useRef<HTMLDivElement>(null);
    const mobileChartContainerRef = useRef<HTMLDivElement>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const [isCapturing, setIsCapturing] = useState(false);

    const visibleData = sortedData;
    const highlightedAreas = useMemo(() => highlightedAreasByView[activeViewId] ?? new Set<string>(), [highlightedAreasByView, activeViewId]);
    const storageKey = `monitorcillo:chart:${indicatorId ?? title}`;

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(storageKey);
            if (!stored) {
                setIsConfigLoaded(true);
                return;
            }
            const parsed = JSON.parse(stored) as PersistedChartConfig;
            const validViewIds = new Set((views?.map(view => view.id) ?? ['default']));
            if (parsed.selectedViewId && validViewIds.has(parsed.selectedViewId)) setSelectedViewId(parsed.selectedViewId);
            if (parsed.highlightedAreasByView) setHighlightedAreasByView(Object.fromEntries(Object.entries(parsed.highlightedAreasByView).map(([viewId, keys]) => [viewId, new Set(keys)])));
        } catch {
            window.localStorage.removeItem(storageKey);
        } finally {
            setIsConfigLoaded(true);
        }
    }, [storageKey, views]);

    useEffect(() => {
        if (!isConfigLoaded) return;
        const highlightedAreasPayload = Object.fromEntries(Object.entries(highlightedAreasByView).map(([viewId, keys]) => [viewId, [...keys]]));
        window.localStorage.setItem(storageKey, JSON.stringify({ selectedViewId, highlightedAreasByView: highlightedAreasPayload }));
    }, [storageKey, selectedViewId, highlightedAreasByView, isConfigLoaded]);

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
        if (Array.isArray(activeLeftYAxisDomain)) return activeLeftYAxisDomain;

        const allValues: number[] = [];
        visibleData.forEach((row) => {
            activeAreas.forEach(area => {
                if (highlightedAreas.size > 0 && !highlightedAreas.has(area.legendKey || area.key)) return;
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
        
        if (activeLeftYAxisDomain === 'auto-pad') {
            const pad = range * 0.1;
            return [min < 0 ? min - pad : 0, max + pad];
        }
        
        if (activeLeftYAxisDomain === 'auto' || !activeLeftYAxisDomain) {
            const pad = range === 0 ? 1 : range * 0.05;
            return [min < 0 ? min - pad : 0, max + pad];
        }

        return [min, max];
    }, [visibleData, activeAreas, activeLeftYAxisDomain, highlightedAreas]);

    const viewSelector = views && views.length > 1 ? (
        <div className="no-capture flex w-full gap-1 sm:w-auto">
            {views.map(view => {
                const isActive = view.id === (selectedView?.id ?? selectedViewId);
                return <button key={view.id} type="button" onClick={() => setSelectedViewId(view.id)} className={`border px-2 py-1 text-[10px] sm:text-xs font-bold uppercase transition-colors ${isActive ? 'border-imperial-gold bg-imperial-gold text-imperial-blue' : 'border-imperial-gold text-imperial-gold hover:bg-imperial-gold hover:text-imperial-blue'}`}>{view.label}</button>;
            })}
        </div>
    ) : null;

    const handleToggleHighlight = useCallback((key: string) => {
        setHighlightedAreasByView(prev => {
            const next = new Set(prev[activeViewId] ?? []);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return { ...prev, [activeViewId]: next };
        });
    }, [activeViewId]);

    const handleDownloadChart = useCallback(async () => {
        try {
            setIsCapturing(true);
            await new Promise(resolve => setTimeout(resolve, 400));

            const target = isMobile ? mobileCaptureRef.current : captureRef.current;
            if (!target) return;

            const dataUrl = await toPng(target, {
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
    }, [isMobile, title]);

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
                <Link href="/" className="shrink-0 border-2 border-imperial-gold text-imperial-gold px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-base font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors uppercase">Volver</Link>
            </header>

            <CompositeChartCard
                title={title} subtitle={subtitle} chartTitle={activeChartTitle} captureRef={captureRef} chartContainerRef={chartContainerRef}
                chartSize={chartSize} visibleData={visibleData} sortedData={sortedData}
                areas={activeAreas} methodology={activeMethodology} valueFormat={activeValueFormat}
                yAxisDecimals={activeYAxisDecimals} yAxisLabel={activeYAxisLabel} secondaryYAxis={activeSecondaryYAxis}
                leftAxisDomain={leftAxisDomain} xAxisKey={xAxisKey} labelByXAxisValue={labelByXAxisValue}
                highlightedAreas={highlightedAreas} selectedMonth={selectedMonth} selectByMonth={selectByMonth}
                isMobile={isMobile} isCapturing={isCapturing && !isMobile} onDownloadChart={handleDownloadChart}
                onSelectMonth={setSelectedMonth} onToggleHighlight={handleToggleHighlight} viewSelector={viewSelector}
            />
            {isMobile && isCapturing ? (
                <div className="fixed left-[-10000px] top-0 z-[-1]">
                    <CompositeChartCard
                        title={title} subtitle={subtitle} chartTitle={activeChartTitle} captureRef={mobileCaptureRef} chartContainerRef={mobileChartContainerRef}
                        chartSize={{ width: 1260, height: 780 }} visibleData={visibleData} sortedData={sortedData}
                        areas={activeAreas} methodology={activeMethodology} valueFormat={activeValueFormat}
                        yAxisDecimals={activeYAxisDecimals} yAxisLabel={activeYAxisLabel} secondaryYAxis={activeSecondaryYAxis}
                        leftAxisDomain={leftAxisDomain} xAxisKey={xAxisKey} labelByXAxisValue={labelByXAxisValue}
                        highlightedAreas={highlightedAreas} selectedMonth={selectedMonth} selectByMonth={selectByMonth}
                        isMobile={false} isCapturing forceDesktopLayout onDownloadChart={handleDownloadChart}
                        onSelectMonth={setSelectedMonth} onToggleHighlight={handleToggleHighlight}
                    />
                </div>
            ) : null}
        </div>
    );
}
