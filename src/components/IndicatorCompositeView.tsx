'use client';

import Link from 'next/link';
import { toPng } from 'html-to-image';
import { startTransition, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { ChartAxisDomain, ChartClickState, ChartCrosshairState, ChartDataRow, ChartReferenceLine, IndicatorCompositeViewProps } from '@/types/chart';
import CompositeChartCard from './indicators/CompositeChartCard';
import { collectAxisExtentValues } from './chart/utils';
import TimeRangeSlider from './chart/TimeRangeSlider';

type PersistedChartConfig = {
    selectedViewId?: string;
    highlightedAreasByView?: Record<string, string[]>;
    rangeByView?: Record<string, [number, number]>;
    baseDateByView?: Record<string, string>;
};

export function restoreHighlightedAreasByView(config: Record<string, string[]>, views: IndicatorCompositeViewProps['views']): Record<string, Set<string>> {
    if (!views?.length) {
        const keys = config.default ?? config['default:default'];
        return keys ? { default: new Set(keys) } : {};
    }
    return Object.fromEntries(views.flatMap(view => {
        const defaultModeId = view.modes?.[0]?.id ?? 'default';
        const keys = config[view.id] ?? config[`${view.id}:${defaultModeId}`];
        return keys ? [[view.id, new Set(keys)] as const] : [];
    }));
}

function formatBaseDate(date: string): string {
    const [year, month] = date.split('-');
    const labels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${labels[Number(month) - 1]}-${year.slice(-2)}`;
}

const EMPTY_REFERENCE_LINES: ChartReferenceLine[] = [];

async function addImagePadding(dataUrl: string, horizontalPadding: number, verticalPadding: number, backgroundColor: string) {
    const image = new Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Failed to add margins to chart image.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.width + horizontalPadding * 2;
    canvas.height = image.height + verticalPadding * 2;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create chart image canvas.');

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, horizontalPadding, verticalPadding);

    return canvas.toDataURL('image/png');
}

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
    showTooltipTotal = false,
    indicatorId,
    views,
}: IndicatorCompositeViewProps) {
    const selectByMonth = indicatorId === 'recaudacion';
    const [selectedViewId, setSelectedViewId] = useState(views?.[0]?.id ?? 'default');
    const [selectedModeByView, setSelectedModeByView] = useState<Record<string, string>>({});
    const [baseDateByView, setBaseDateByView] = useState<Record<string, string>>({});
    const [highlightedAreasByView, setHighlightedAreasByView] = useState<Record<string, Set<string>>>({});
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const selectedView = views?.find(view => view.id === selectedViewId) ?? views?.[0];
    const activeViewId = selectedView?.id ?? selectedViewId;
    const selectedMode = selectedView?.modes?.find(mode => mode.id === selectedModeByView[activeViewId]) ?? selectedView?.modes?.[0];
    const activeChartTitle = selectedMode?.chartTitle ?? selectedView?.chartTitle ?? chartTitle;
    const sourceData = selectedMode?.data ?? selectedView?.data ?? data;
    const activeAreas = selectedMode?.areas ?? selectedView?.areas ?? areas;
    const activeMethodology = selectedMode?.methodology ?? selectedView?.methodology ?? methodology;
    const activeValueFormat = selectedMode?.valueFormat ?? selectedView?.valueFormat ?? valueFormat;
    const activeYAxisDecimals = selectedMode?.yAxisDecimals ?? selectedView?.yAxisDecimals ?? yAxisDecimals;
    const configuredYAxisLabel = selectedMode?.yAxisLabel ?? selectedView?.yAxisLabel ?? yAxisLabel;
    const activeSecondaryYAxis = selectedView?.secondaryYAxis ?? secondaryYAxis;
    const activeLeftYAxisDomain = selectedMode?.leftYAxisDomain ?? selectedView?.leftYAxisDomain ?? leftYAxisDomain;
    const configuredReferenceLines = selectedView?.referenceLines ?? EMPTY_REFERENCE_LINES;
    const activeShowTooltipTotal = selectedMode?.showTooltipTotal ?? selectedView?.showTooltipTotal ?? showTooltipTotal;
    const memoryKey = activeViewId;
    const validBaseRows = selectedView?.rebaseable
        ? sourceData.filter(row => typeof row.iso_fecha === 'string' && activeAreas.every(area => {
            const value = row[area.key];
            return typeof value === 'number' && Number.isFinite(value) && value !== 0;
        }))
        : [];
    const effectiveBaseRow = validBaseRows.find(row => row.iso_fecha === baseDateByView[memoryKey])
        ?? validBaseRows.find(row => row.iso_fecha === selectedView?.defaultBaseDate)
        ?? validBaseRows[0];
    const effectiveBaseDate = typeof effectiveBaseRow?.iso_fecha === 'string' ? effectiveBaseRow.iso_fecha : null;
    const activeData = selectedView?.rebaseable && effectiveBaseRow
        ? sourceData.map(row => ({
            ...row,
            ...Object.fromEntries(activeAreas.map(area => {
                const value = row[area.key];
                const baseValue = effectiveBaseRow[area.key];
                return [area.key, typeof value === 'number' && typeof baseValue === 'number' && baseValue !== 0 ? value / baseValue * 100 : null];
            })),
        }))
        : sourceData;
    const activeYAxisLabel = selectedView?.rebaseable && effectiveBaseDate ? `Base 100 = ${formatBaseDate(effectiveBaseDate)}` : configuredYAxisLabel;
    const activeReferenceLines = useMemo(() => selectedView?.rebaseable && effectiveBaseDate
        ? [...configuredReferenceLines, { value: 100, color: '#FFD700', dash: [6, 4], foreground: true, outlineColor: '#000000' }]
        : configuredReferenceLines, [selectedView?.rebaseable, effectiveBaseDate, configuredReferenceLines]);
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
    const [crosshair, setCrosshair] = useState<ChartCrosshairState | null>(null);
    const hoverTooltipRef = useRef<ChartCrosshairState | null>(null);
    const [captureTooltip, setCaptureTooltip] = useState<ChartCrosshairState | null>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const [isCapturing, setIsCapturing] = useState(false);
    const [startIndex, setStartIndex] = useState(0);
    const [endIndex, setEndIndex] = useState(Math.max(0, sortedData.length - 1));
    const [previewRange, setPreviewRange] = useState<[number, number] | null>(null);
    const prevViewIdRef = useRef<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const visibleData = useMemo(() => sortedData.slice(startIndex, endIndex + 1), [sortedData, startIndex, endIndex]);
    const highlightedAreas = useMemo(() => {
        const validKeys = new Set(activeAreas.map(area => area.legendKey || area.key));
        return new Set([...(highlightedAreasByView[activeViewId] ?? [])].filter(key => validKeys.has(key)));
    }, [activeAreas, activeViewId, highlightedAreasByView]);
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
            if (parsed.highlightedAreasByView) setHighlightedAreasByView(restoreHighlightedAreasByView(parsed.highlightedAreasByView, views));
            if (parsed.baseDateByView) {
                setBaseDateByView(Object.fromEntries((views?.length ? views : [{ id: 'default', modes: [] }]).flatMap(view => {
                    const defaultModeId = view.modes?.[0]?.id ?? 'default';
                    const date = parsed.baseDateByView?.[view.id] ?? parsed.baseDateByView?.[`${view.id}:${defaultModeId}`];
                    return date ? [[view.id, date]] : [];
                })));
            }
            if (parsed.rangeByView) {
                const viewIdForRange = parsed.selectedViewId && validViewIds.has(parsed.selectedViewId) ? parsed.selectedViewId : (views?.[0]?.id ?? 'default');
                const viewForRange = views?.find(v => v.id === viewIdForRange);
                const initialMode = viewForRange?.modes?.[0];
                const range = parsed.rangeByView[viewIdForRange] ?? parsed.rangeByView[`${viewIdForRange}:${initialMode?.id ?? 'default'}`];
                const dataForRange = initialMode?.data ?? viewForRange?.data ?? data;
                const maxIndex = Math.max(0, dataForRange.length - 1);
                if (range && Array.isArray(range) && range.length === 2) {
                    const [savedStart, savedEnd] = range;
                    setStartIndex(Math.max(0, Math.min(savedStart, maxIndex)));
                    setEndIndex(Math.max(0, Math.min(savedEnd, maxIndex)));
                }
            }
        } catch {
            window.localStorage.removeItem(storageKey);
        } finally {
            setIsConfigLoaded(true);
        }
    }, [storageKey, views, data]);

    useEffect(() => {
        if (!isConfigLoaded) return;
        if (previewRange) return;
        const highlightedAreasPayload = Object.fromEntries(Object.entries(highlightedAreasByView).map(([viewId, keys]) => [viewId, [...keys]]));
        let rangeByViewPayload: Record<string, [number, number]> = {};
        try {
            const stored = window.localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as PersistedChartConfig;
                if (parsed.rangeByView) rangeByViewPayload = parsed.rangeByView;
            }
        } catch { /* ignore */ }
        rangeByViewPayload[memoryKey] = [startIndex, endIndex];
        window.localStorage.setItem(storageKey, JSON.stringify({ selectedViewId, highlightedAreasByView: highlightedAreasPayload, rangeByView: rangeByViewPayload, baseDateByView }));
    }, [storageKey, selectedViewId, highlightedAreasByView, startIndex, endIndex, memoryKey, isConfigLoaded, previewRange, baseDateByView]);

    useEffect(() => {
        if (selectedMonth && selectByMonth) {
            const hasMonth = visibleData.some((row) => row.iso_fecha?.slice(5, 7) === selectedMonth);
            if (!hasMonth) setSelectedMonth(null);
        } else if (selectedMonth && !visibleData.some((row) => (row.iso_fecha || row.fecha) === selectedMonth)) {
            setSelectedMonth(null);
        }
    }, [visibleData, selectedMonth, selectByMonth]);

    useEffect(() => {
        if (!isConfigLoaded) return;
        if (prevViewIdRef.current === null) {
            prevViewIdRef.current = memoryKey;
            return;
        }
        if (prevViewIdRef.current !== memoryKey) {
            prevViewIdRef.current = memoryKey;
            const max = Math.max(0, sortedData.length - 1);
            setStartIndex(0);
            setEndIndex(max);
        }
    }, [memoryKey, isConfigLoaded, sortedData.length]);

    useEffect(() => {
        const max = Math.max(0, sortedData.length - 1);
        setStartIndex(prevStart => Math.min(prevStart, max));
        setEndIndex(prevEnd => {
            const wasViewingEnd = prevEnd >= max - 5 || prevEnd >= Math.max(0, sortedData.length - 6);
            return wasViewingEnd ? max : Math.min(prevEnd, max);
        });
    }, [sortedData.length]);

    useEffect(() => {
        const element = chartContainerRef.current;
        if (!element) return;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setChartSize({
                width: Math.max(0, Math.floor(rect.width)),
                height: Math.max(0, Math.floor(rect.height)),
            });
        };

        const frame = requestAnimationFrame(updateSize);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSize);
        observer?.observe(element);
        window.addEventListener('resize', updateSize);

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [isMobile]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const leftAxisDomain: ChartAxisDomain = useMemo(() => {
        if (Array.isArray(activeLeftYAxisDomain)) return activeLeftYAxisDomain;

        const allValues = collectAxisExtentValues(visibleData, activeAreas, {
            yAxisId: 'left',
            highlightedAreas,
        });
        allValues.push(...activeReferenceLines.map(reference => reference.value));

        if (allValues.length === 0) return [0, 10];

        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const range = max - min;
        
        if (activeLeftYAxisDomain === 'auto-pad') {
            const pad = range === 0 ? Math.max(Math.abs(min) * 0.1, 1) : range * 0.1;
            return [min - pad, max + pad];
        }
        
        if (activeLeftYAxisDomain === 'auto' || !activeLeftYAxisDomain) {
            const pad = range === 0 ? 1 : range * 0.05;
            return [min < 0 ? min - pad : 0, max + pad];
        }

        return [min, max];
    }, [visibleData, activeAreas, activeLeftYAxisDomain, highlightedAreas, activeReferenceLines]);

    const viewSelector = (views && views.length > 1) || selectedView?.rebaseable || selectedView?.modeSelector === 'select' ? (
        <div className="no-capture flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {views && views.length > 1 ? <div className="flex gap-1">
                {views.map(view => {
                    const isActive = view.id === (selectedView?.id ?? selectedViewId);
                    return <button key={view.id} type="button" onClick={() => setSelectedViewId(view.id)} className={`border px-2 py-1 text-[10px] sm:text-xs font-bold uppercase transition-colors ${isActive ? 'border-imperial-gold bg-imperial-gold text-imperial-blue' : 'border-imperial-gold text-imperial-gold hover:bg-imperial-gold hover:text-imperial-blue'}`}>{view.label}</button>;
                })}
            </div> : null}
            {selectedView?.rebaseable && effectiveBaseDate ? (
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-imperial-gold sm:text-xs">
                    Base
                    <select
                        aria-label="Mes base del índice"
                        value={effectiveBaseDate}
                        onChange={event => startTransition(() => setBaseDateByView(previous => ({ ...previous, [memoryKey]: event.target.value })))}
                        className="border border-imperial-gold bg-imperial-blue px-2 py-1 text-imperial-gold outline-none"
                    >
                        {validBaseRows.map(row => <option key={String(row.iso_fecha)} value={String(row.iso_fecha)}>{row.fecha}</option>)}
                    </select>
                </label>
            ) : null}
            {selectedView?.modeSelector === 'select' && selectedMode ? (
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-imperial-gold sm:text-xs">
                    Desagregación
                    <select
                        aria-label="Desagregación de morosidad"
                        value={selectedMode.id}
                        onChange={event => startTransition(() => setSelectedModeByView(previous => ({ ...previous, [activeViewId]: event.target.value })))}
                        className="max-w-[15rem] border border-imperial-gold bg-imperial-blue px-2 py-1 text-imperial-gold outline-none sm:max-w-none"
                    >
                        {selectedView.modes?.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                    </select>
                </label>
            ) : null}
        </div>
    ) : null;

    const axisModeSelector = selectedView?.modeSelector !== 'select' && selectedView?.modes && selectedView.modes.length > 1 && selectedMode ? (
        <div role="group" aria-label="Unidad del eje Y" className="no-capture flex tracking-normal">
            {selectedView.modes.map(mode => (
                <button
                    key={mode.id}
                    type="button"
                    aria-pressed={mode.id === selectedMode.id}
                    onClick={() => startTransition(() => setSelectedModeByView(previous => ({ ...previous, [activeViewId]: mode.id })))}
                    className={`border border-imperial-gold px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${mode.id === selectedMode.id ? 'bg-imperial-gold text-imperial-blue' : 'text-imperial-gold hover:bg-imperial-gold hover:text-imperial-blue'}`}
                >
                    {mode.label}
                </button>
            ))}
        </div>
    ) : null;

    const handleToggleHighlight = useCallback((key: string) => {
        setHighlightedAreasByView(prev => {
            const validKeys = new Set(activeAreas.map(area => area.legendKey || area.key));
            const next = new Set([...(prev[activeViewId] ?? [])].filter(activeKey => validKeys.has(activeKey)));
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return { ...prev, [activeViewId]: next };
        });
    }, [activeAreas, activeViewId]);

    const crosshairFromChartState = useCallback((state: ChartClickState | null, locked: boolean): ChartCrosshairState | null => {
        const x = state?.activeCoordinate?.x;
        const y = state?.activeCoordinate?.y;
        if (typeof x !== 'number' || typeof y !== 'number') return null;
        const idx = state?.activeTooltipIndex;
        const activeIndex = typeof idx === 'number' ? idx : typeof idx === 'string' && /^\d+$/.test(idx) ? Number(idx) : null;
        const payloadRow = state?.activePayload?.[0]?.payload;
        const labelValue = activeIndex !== null ? visibleData[activeIndex]?.fecha : payloadRow?.fecha ?? payloadRow?.iso_fecha;
        const label = labelValue ? String(labelValue) : undefined;
        return { x, y, locked, activePayload: state?.activePayload, label };
    }, [visibleData]);

    const handleCrosshairClick = useCallback((state: ChartClickState | null) => {
        const nextCrosshair = crosshairFromChartState(state, true);
        const chart = chartContainerRef.current;
        const tooltip = chart?.querySelector<HTMLElement>('.recharts-tooltip-wrapper');
        if (!nextCrosshair || !chart || !tooltip) {
            setCrosshair(nextCrosshair);
            return;
        }
        const chartRect = chart.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        setCrosshair({
            ...nextCrosshair,
            tooltipPosition: {
                x: tooltipRect.left - chartRect.left,
                y: tooltipRect.top - chartRect.top,
            },
        });
    }, [crosshairFromChartState]);

    const handleCrosshairUnlock = useCallback(() => {
        setCrosshair(null);
    }, []);

    const handleHoverTooltipChange = useCallback((tooltip: ChartCrosshairState | null) => {
        hoverTooltipRef.current = tooltip;
    }, []);

    const handlePrepareDownload = useCallback(() => {
        setCaptureTooltip(crosshair?.locked ? null : hoverTooltipRef.current);
    }, [crosshair?.locked]);

    const handleDownloadChart = useCallback(async () => {
        try {
            setIsCapturing(true);
            await new Promise(resolve => setTimeout(resolve, 600));

            const target = isMobile ? mobileCaptureRef.current : captureRef.current;
            if (!target) return;
            const dataUrl = await toPng(target, {
                backgroundColor: '#00143F',
                pixelRatio: 2,
                filter: (node) => {
                    if (node.classList?.contains('no-capture')) return false;
                    if (node.classList?.contains('recharts-tooltip-wrapper')) return false;
                    return true;
                },
            });

            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = await addImagePadding(dataUrl, 32, 24, '#00143F');
            link.click();
        } catch (err) {
            console.error('Error al descargar el gráfico:', err);
        } finally {
            setIsCapturing(false);
            setCaptureTooltip(null);
        }
    }, [isMobile, title]);

    if (!sortedData || sortedData.length === 0) {
        return <div className="text-imperial-gold p-8 text-center font-bold">Cargando datos...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-2 sm:p-6 lg:p-10">
            <header className="w-full sm:w-[96%] max-w-[1800px] mb-4 sm:mb-8 border-b-2 border-imperial-gold pb-4 mt-2 sm:mt-4 flex flex-col items-start gap-3 sm:flex-row-reverse sm:items-center sm:justify-between px-2">
                <Link href="/" className="shrink-0 border-2 border-imperial-gold text-imperial-gold px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-base font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors uppercase">Volver</Link>
                <div className="w-full text-center sm:text-left">
                    <h1 className="imperial-title text-xl sm:text-3xl font-bold tracking-widest text-imperial-gold leading-tight uppercase">
                        {title}
                    </h1>
                    {subtitle && <p className="text-imperial-cyan mt-1 font-bold text-xs sm:text-base">{subtitle}</p>}
                </div>
            </header>

            <CompositeChartCard
                title={title} subtitle={subtitle} chartTitle={activeChartTitle} captureRef={captureRef} chartContainerRef={chartContainerRef}
                chartSize={chartSize} visibleData={visibleData} sortedData={sortedData}
                areas={activeAreas} methodology={activeMethodology} valueFormat={activeValueFormat}
                yAxisDecimals={activeYAxisDecimals} yAxisLabel={activeYAxisLabel} secondaryYAxis={activeSecondaryYAxis}
                leftAxisDomain={leftAxisDomain} xAxisKey={xAxisKey} labelByXAxisValue={labelByXAxisValue}
                highlightedAreas={highlightedAreas} selectedMonth={selectedMonth} selectByMonth={selectByMonth}
                showTooltipTotal={activeShowTooltipTotal}
                referenceLines={activeReferenceLines}
                rangePreview={previewRange} committedRange={[startIndex, endIndex]}
                crosshair={crosshair} captureTooltip={captureTooltip} onCrosshairClick={handleCrosshairClick} onCrosshairUnlock={handleCrosshairUnlock} onHoverTooltipChange={handleHoverTooltipChange}
                isMobile={isMobile} isCapturing={isCapturing && !isMobile} onPrepareDownload={handlePrepareDownload} onDownloadChart={handleDownloadChart}
                onSelectMonth={setSelectedMonth} onToggleHighlight={handleToggleHighlight} viewSelector={viewSelector} axisModeSelector={axisModeSelector} axisModeLabel={selectedMode?.label}
                timeRangeSlider={!isCapturing && sortedData.length > 1 ? (
                    <TimeRangeSlider
                        data={sortedData}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        xAxisKey={xAxisKey}
                        labelByXAxisValue={labelByXAxisValue}
                        onPreviewChange={(start, end) => setPreviewRange([start, end])}
                        onCommitChange={(start, end) => {
                            setPreviewRange(null);
                            startTransition(() => {
                                setStartIndex(start);
                                setEndIndex(end);
                            });
                        }}
                    />
                ) : null}
            />
            {isMobile && isCapturing ? (
                <div className="fixed left-[-10000px] top-0 z-[-1]">
                    <CompositeChartCard
                        title={title} subtitle={subtitle} chartTitle={activeChartTitle} captureRef={mobileCaptureRef} chartContainerRef={mobileChartContainerRef}
                        chartSize={{ width: 1240, height: 780 }} visibleData={visibleData} sortedData={sortedData}
                        areas={activeAreas} methodology={activeMethodology} valueFormat={activeValueFormat}
                        yAxisDecimals={activeYAxisDecimals} yAxisLabel={activeYAxisLabel} secondaryYAxis={activeSecondaryYAxis}
                        leftAxisDomain={leftAxisDomain} xAxisKey={xAxisKey} labelByXAxisValue={labelByXAxisValue}
                        highlightedAreas={highlightedAreas} selectedMonth={selectedMonth} selectByMonth={selectByMonth}
                        showTooltipTotal={activeShowTooltipTotal}
                        referenceLines={activeReferenceLines}
                        rangePreview={null} committedRange={[startIndex, endIndex]}
                        crosshair={crosshair?.locked ? crosshair : null} captureTooltip={captureTooltip} onCrosshairClick={handleCrosshairClick} onCrosshairUnlock={handleCrosshairUnlock} onHoverTooltipChange={handleHoverTooltipChange}
                        isMobile={false} isCapturing forceDesktopLayout onPrepareDownload={handlePrepareDownload} onDownloadChart={handleDownloadChart}
                        onSelectMonth={setSelectedMonth} onToggleHighlight={handleToggleHighlight} axisModeLabel={selectedMode?.label}
                        timeRangeSlider={null}
                    />
                </div>
            ) : null}
        </div>
    );
}
