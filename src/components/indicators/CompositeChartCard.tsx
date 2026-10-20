import { ImageDown } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import type { ReactNode, RefObject } from 'react';
import { CartesianGrid, ComposedChart, Customized, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts';
import type { XAxisTickContentProps } from 'recharts';
import { TOUCH_PRESS_STYLE, useTouchCrosshair } from '@/components/chart/useTouchCrosshair';
import { isTouchPointer } from '@/lib/crosshair';
import { CROSSHAIR_DASH, CROSSHAIR_STROKE, CROSSHAIR_STROKE_WIDTH } from '@/components/chart/crosshair-style';
import type { AreaConfig, ChartAxisDomain, ChartClickState, ChartCrosshairState, ChartDataRow, ChartMobileRangeSelection, ChartReferenceLine, MethodologyItem, ValueFormat, YAxisConfig } from '@/types/chart';
import ChartArea from '../chart/ChartArea';
import ChartBar from '../chart/ChartBar';
import ChartLine from '../chart/ChartLine';
import ChartTooltip from '../chart/ChartTooltip';
import CustomLegend from '../chart/CustomLegend';
import MobileRangePicker from '../chart/MobileRangePicker';
import { createHoverTooltipStore, type HoverTooltipStore } from '../chart/hover-tooltip-store';
import MethodologySection from '../chart/MethodologySection';
import { calculateTooltipVerticalPosition, chartClickStateFromPointer, chartLayout, chartXForIndex, collectAxisExtentValues, createRoundTicks, formatAxisValueByType, formatValueByType, resolveChartHoverPoint, selectMonthAlignedXTicks, selectRoundTickDivisions, targetXTickCount, xTickEdgeSpacingPx, xTickSpacingPx } from '../chart/utils';
import type { ChartLayout } from '../chart/utils';

type Props = {
    title: string;
    subtitle?: string;
    chartTitle: string;
    captureRef: React.RefObject<HTMLDivElement | null>;
    chartContainerRef: React.RefObject<HTMLDivElement | null>;
    chartSize: { width: number; height: number };
    visibleData: ChartDataRow[];
    sortedData: ChartDataRow[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat: ValueFormat;
    yAxisDecimals: number;
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
    leftAxisDomain: ChartAxisDomain;
    xAxisKey: 'iso_fecha' | 'fecha';
    labelByXAxisValue: Map<string, string>;
    highlightedAreas: Set<string>;
    selectedMonth: string | null;
    selectByMonth: boolean;
    showTooltipTotal: boolean;
    referenceLines: ChartReferenceLine[];
    rangePreview: [number, number] | null;
    committedRange: [number, number];
    crosshair: ChartCrosshairState | null;
    captureTooltip: ChartCrosshairState | null;
    isMobile: boolean;
    isCapturing: boolean;
    forceDesktopLayout?: boolean;
    viewSelector?: ReactNode;
    axisModeSelector?: ReactNode;
    axisModeLabel?: string;
    rangeSelectControl?: ReactNode;
    rangeResetControl?: ReactNode;
    rangeSelection?: ChartMobileRangeSelection | null;
    onPrepareDownload: () => void;
    onDownloadChart: () => void;
    onSelectMonth: (month: string | null) => void;
    onToggleHighlight: (key: string) => void;
    onCrosshairClick: (state: ChartClickState | null) => void;
    onCrosshairUnlock: () => void;
    onHoverTooltipChange: (tooltip: ChartCrosshairState | null) => void;
};

type ChartRenderProps = Omit<Props, 'captureRef' | 'chartContainerRef'>;

export default function CompositeChartCard({ captureRef, chartContainerRef, ...chartProps }: Props) {
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const renderProps = chartProps.forceDesktopLayout
        ? { ...chartProps, isMobile: false, chartSize: { width: 1240, height: 780 } }
        : chartProps;
    const captureStyle = chartProps.forceDesktopLayout ? { outline: 'none', width: '100%', padding: 16, boxSizing: 'border-box' as const } : { outline: 'none', padding: 0, flex: chartProps.isCapturing ? '0 0 auto' : undefined };

    return (
        <main className={chartProps.forceDesktopLayout ? 'w-[1400px] max-w-none' : 'w-full sm:w-[96%] max-w-[1800px]'}>
            <div className={`${chartProps.forceDesktopLayout ? 'w-[1400px] min-h-[850px] p-4' : 'w-full min-h-[600px] sm:min-h-[850px] p-2 sm:p-4'} bg-imperial-blue border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 flex flex-col overflow-hidden`} style={{ outline: 'none' }} tabIndex={-1}>
                <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue overflow-hidden" style={captureStyle} tabIndex={-1}>
                    {renderProps.isCapturing ? <ExportHeader title={renderProps.title} subtitle={renderProps.subtitle} /> : null}
                    <ChartHeader onPrepareDownload={renderProps.onPrepareDownload} onDownloadChart={renderProps.onDownloadChart} isCapturing={renderProps.isCapturing} viewSelector={renderProps.viewSelector} extraControl={<>{renderProps.rangeResetControl}{renderProps.rangeSelectControl}</>} />
                    <ChartCanvas {...renderProps} chartContainerRef={chartContainerRef} scrollViewportRef={scrollViewportRef} />
                    <CustomLegend areas={renderProps.areas} highlightedAreas={renderProps.highlightedAreas} onToggleHighlight={renderProps.onToggleHighlight} compact={renderProps.isCapturing} />
                    <MethodologySection methodology={renderProps.methodology} forceOpen={renderProps.isCapturing} />
                    {renderProps.isCapturing ? <ExportFooter /> : null}
                </div>
            </div>
        </main>
    );
}

function ExportHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return <div className="mb-3 border-b border-imperial-gold/40 pb-3 text-center"><div className="mb-1 text-center text-[8px] font-bold uppercase tracking-widest text-imperial-cyan">monitorcillo.vercel.app</div><h1 className="imperial-title text-balance text-2xl font-bold uppercase leading-tight tracking-widest text-imperial-gold">{title}</h1>{subtitle ? <p className="mt-1 text-sm font-bold uppercase tracking-wide text-imperial-cyan">{subtitle}</p> : null}</div>;
}

function ExportFooter() {
    return <div className="mt-0.5 border-t border-imperial-gold/40 pt-1 text-center text-[3px] font-bold uppercase tracking-wider text-imperial-cyan"><span className="text-imperial-gold">Monitorcillo</span> fue hecho con amor por <span className="text-imperial-gold">Fierillo</span></div>;
}

function ChartHeader({ onPrepareDownload, onDownloadChart, isCapturing, viewSelector, extraControl }: { onPrepareDownload: () => void; onDownloadChart: () => void; isCapturing: boolean; viewSelector?: ReactNode; extraControl?: ReactNode }) {
    if (isCapturing) return null;

    return (
        <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ outline: 'none' }}>
            <div>{viewSelector}</div>
            <div className="flex justify-end gap-2 w-full sm:w-auto">
                {extraControl}
                <button data-keep-crosshair onMouseDown={onPrepareDownload} onTouchStart={onPrepareDownload} onClick={onDownloadChart} className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2 w-full sm:w-auto justify-center" title="Descargar gráfico">
                    <ImageDown size={16} /> Guardar
                </button>
            </div>
        </div>
    );
}

function ChartCanvas({ chartContainerRef, scrollViewportRef, ...props }: ChartRenderProps & { chartContainerRef: React.RefObject<HTMLDivElement | null>; scrollViewportRef: React.RefObject<HTMLDivElement | null> }) {
    const chainsawCursorRef = useRef<HTMLImageElement | null>(null);
    const pointerPositionRef = useRef<{ left: number; top: number } | null>(null);
    const [hoverTooltipStore] = useState(createHoverTooltipStore);
    const [isControlPressed, setIsControlPressed] = useState(false);
    const renderedAreas = useMemo(() => activeAreas(props.areas, props.highlightedAreas), [props.areas, props.highlightedAreas]);
    const layout = useMemo(() => chartLayout({
        areas: renderedAreas,
        count: props.visibleData.length,
        width: props.chartSize.width,
        isMobile: Boolean(props.isMobile),
        valueFormat: props.valueFormat,
        hasSecondaryAxis: Boolean(props.secondaryYAxis),
    }), [renderedAreas, props.visibleData.length, props.chartSize.width, props.isMobile, props.valueFormat, props.secondaryYAxis]);
    const captureCrosshair = useMemo(
        () => props.isCapturing && !props.crosshair?.locked ? placeCaptureCrosshair(props.captureTooltip, props.visibleData, props.chartSize, layout) : null,
        [props.isCapturing, props.crosshair?.locked, props.captureTooltip, props.visibleData, props.chartSize, layout],
    );
    const captureCanvasStyle = props.forceDesktopLayout ? { outline: 'none', height: 780 } : { outline: 'none' };
    const captureChartStyle = props.forceDesktopLayout
        ? { outline: 'none', width: 1240, height: 780 }
        : { outline: 'none', width: '100%' };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Control') setIsControlPressed(true);
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Control') setIsControlPressed(false);
        };
        const handleBlur = () => setIsControlPressed(false);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        if (!isControlPressed || !chainsawCursorRef.current || !pointerPositionRef.current) return;
        chainsawCursorRef.current.style.left = `${pointerPositionRef.current.left}px`;
        chainsawCursorRef.current.style.top = `${pointerPositionRef.current.top}px`;
        chainsawCursorRef.current.style.visibility = 'visible';
    }, [isControlPressed]);

    return (
        <div className={`flex-1 flex flex-row relative ${props.forceDesktopLayout ? 'min-h-[780px]' : 'min-h-[300px] sm:min-h-[500px]'} ${props.isMobile && props.axisModeSelector ? 'pt-12' : ''} overflow-visible`} style={captureCanvasStyle}>
            {props.isMobile && props.axisModeSelector && !props.isCapturing ? <div className="no-capture absolute left-1/2 top-0 z-10 flex -translate-x-1/2 flex-col items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-imperial-gold"><span>{props.yAxisLabel}</span>{props.axisModeSelector}</div> : null}
            {!props.isMobile && props.yAxisLabel && <AxisLabel label={props.isCapturing && props.axisModeLabel ? `${props.yAxisLabel} · ${props.axisModeLabel}` : props.yAxisLabel} control={!props.isCapturing ? props.axisModeSelector : null} />}
            <div
                ref={scrollViewportRef}
                data-testid="chart-scroll-viewport"
                className={`relative min-w-0 flex-1 ${props.isMobile ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}
            >
                <div
                    ref={chartContainerRef}
                    className={`relative h-full ${props.isMobile ? 'overflow-visible' : 'overflow-hidden'} ${isControlPressed && !props.isCapturing ? 'chainsaw-cursor' : ''}`}
                    style={captureChartStyle}
                    tabIndex={-1}
                    onPointerMove={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const position = {
                            left: event.clientX - bounds.left - 1,
                            top: event.clientY - bounds.top - 10,
                        };
                        pointerPositionRef.current = position;
                        const cursor = chainsawCursorRef.current;
                        if (!cursor) return;
                        cursor.style.left = `${position.left}px`;
                        cursor.style.top = `${position.top}px`;
                        cursor.style.visibility = 'visible';
                    }}
                    onPointerLeave={() => {
                        pointerPositionRef.current = null;
                        if (chainsawCursorRef.current) chainsawCursorRef.current.style.visibility = 'hidden';
                    }}
                >
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none"><span className="watermark text-imperial-gold/21 text-xl font-sans font-bold uppercase tracking-[0.5em] sm:text-4xl">@fierillo</span></div>
                    {props.rangeSelection && !props.isCapturing ? <MobileRangePicker
                        data={props.sortedData}
                        xAxisKey={props.xAxisKey}
                        labelByXAxisValue={props.labelByXAxisValue}
                        selection={props.rangeSelection.selection}
                        maxIndex={props.rangeSelection.maxIndex}
                        visibleRange={props.committedRange}
                        chartWidth={props.chartSize.width}
                        plotLeft={layout.dataArea.left}
                        plotRight={layout.dataArea.right}
                        onSelectionChange={props.rangeSelection.onSelectionChange}
                        onCommit={props.rangeSelection.onCommit}
                        onCancel={props.rangeSelection.onCancel}
                    /> : null}
                    {props.chartSize.width > 0 && props.chartSize.height > 0 ? <ResponsiveComposedChart {...props} crosshair={props.crosshair ?? captureCrosshair} layout={layout} chartContainerRef={chartContainerRef} scrollViewportRef={scrollViewportRef} isControlPressed={isControlPressed} hoverTooltipStore={hoverTooltipStore} /> : <div className="h-full min-h-[500px] w-full flex items-center justify-center text-imperial-cyan font-bold">Cargando gráfico...</div>}
                    {!props.isCapturing && !props.crosshair?.locked && !isControlPressed ? (
                        <HoverTooltipOverlay
                            store={hoverTooltipStore}
                            areas={renderedAreas}
                            valueFormat={props.valueFormat}
                            sortedData={props.sortedData}
                            chartWidth={props.chartSize.width}
                            chartHeight={props.chartSize.height}
                            showTotal={props.showTooltipTotal}
                            compact={props.isMobile}
                        />
                    ) : null}
                    {props.crosshair?.locked && props.crosshair.label ? <CrosshairTooltip crosshair={props.crosshair} areas={renderedAreas} valueFormat={props.valueFormat} sortedData={props.sortedData} chartWidth={props.chartSize.width} chartHeight={props.chartSize.height} showTotal={props.showTooltipTotal} compact={props.isMobile} isCapturing={props.isCapturing} /> : null}
                    {captureCrosshair?.label ? <CrosshairTooltip crosshair={captureCrosshair} areas={renderedAreas} valueFormat={props.valueFormat} sortedData={props.sortedData} chartWidth={props.chartSize.width} chartHeight={props.chartSize.height} showTotal={props.showTooltipTotal} compact={false} isCapturing /> : null}
                    {isControlPressed && !props.isCapturing ? (
                        <Image
                            ref={chainsawCursorRef}
                            src="/chainsaw-cursor.svg"
                            alt=""
                            aria-hidden
                            width={24}
                            height={24}
                            unoptimized
                            draggable={false}
                            className="pointer-events-none absolute z-30 select-none"
                            style={{ left: 0, top: 0, visibility: 'hidden' }}
                        />
                    ) : null}
                </div>
            </div>
            {!props.isMobile && props.secondaryYAxis && <AxisLabel label={props.secondaryYAxis.label ?? ''} color={props.secondaryYAxis.color || '#00BFFF'} right />}
        </div>
    );
}

/** The on-screen hover (possibly from a differently sized chart) mapped onto this chart: same data point, same relative height. */
function placeCaptureCrosshair(tip: ChartCrosshairState | null, rows: ChartDataRow[], size: { width: number; height: number }, layout: ChartLayout): ChartCrosshairState | null {
    if (!tip?.label) return null;
    const index = rows.findIndex(row => String(row.fecha ?? row.iso_fecha) === tip.label);
    if (index < 0) return null;
    const scale = tip.chartHeight ? size.height / tip.chartHeight : 1;
    const x = chartXForIndex({ index, count: rows.length, left: layout.dataArea.left, right: layout.dataArea.right, width: size.width });
    const tooltipY = tip.tooltipPosition?.y;
    return { x, y: tip.y * scale, locked: false, label: tip.label, tooltipPosition: tooltipY == null ? undefined : { y: tooltipY * scale } };
}

function AxisLabel({ label, color, right = false, control }: { label: string; color?: string; right?: boolean; control?: ReactNode }) {
    return <div className={`flex ${control ? 'w-14' : 'w-5'} shrink-0 items-center justify-center`}><div className={`${right ? 'rotate-90' : '-rotate-90'} flex flex-col items-center gap-1 whitespace-nowrap ${color ? '' : 'text-imperial-gold'} font-bold text-xs uppercase tracking-widest`} style={{ color }}><span>{label}</span>{control}</div></div>;
}

function ResponsiveComposedChart(props: ChartRenderProps & { layout: ChartLayout; chartContainerRef: RefObject<HTMLDivElement | null>; scrollViewportRef: RefObject<HTMLDivElement | null>; isControlPressed: boolean; hoverTooltipStore: HoverTooltipStore }) {
    const { chartContainerRef, chartSize, isCapturing, isControlPressed, isMobile, layout, onHoverTooltipChange, hoverTooltipStore, visibleData } = props;
    const hoverVerticalRef = useRef<SVGLineElement | null>(null);
    const hoverHorizontalRef = useRef<SVGLineElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const [activeComparisonGroup, setActiveComparisonGroup] = useState<string | null>(null);
    const renderedAreas = useMemo(() => activeAreas(props.areas, props.highlightedAreas), [props.areas, props.highlightedAreas]);
    const animateBars = props.visibleData.length * renderedAreas.filter(area => area.type === 'bar').length <= 500;
    const animateLines = props.visibleData.length * renderedAreas.filter(area => area.type === 'line').length <= 1000;
    const comparesMandateMonths = renderedAreas.some(area => area.comparisonMode === 'mandate-month');
    const lockedRow = props.crosshair?.locked && props.crosshair.label
        ? props.sortedData.find(row => row.fecha === props.crosshair?.label || row.iso_fecha === props.crosshair?.label)
        : null;
    const comparisonGroup = typeof lockedRow?.comparison_group === 'string'
        ? lockedRow.comparison_group
        : activeComparisonGroup;
    const comparisonRows = comparesMandateMonths && comparisonGroup !== null
        ? props.sortedData.filter(row => row.comparison_group === comparisonGroup && typeof row.icg === 'number')
        : [];
    const lockedSeriesPoints = lockedRow && !comparesMandateMonths
        ? renderedAreas
            .filter(area => area.type === 'line' && typeof lockedRow[area.key] === 'number')
            .map(area => ({ area, value: Number(lockedRow[area.key]) }))
        : [];
    const { areas, highlightedAreas, referenceLines, leftAxisDomain, secondaryYAxis } = props;
    const leftRange = useMemo(
        () => axisTickRange({ visibleData, areas, highlightedAreas, referenceLines, leftAxisDomain, secondaryYAxis }, 'left', !Array.isArray(leftAxisDomain)),
        [visibleData, areas, highlightedAreas, referenceLines, leftAxisDomain, secondaryYAxis],
    );
    const rightRange = useMemo(
        () => axisTickRange({ visibleData, areas, highlightedAreas, referenceLines, leftAxisDomain, secondaryYAxis }, 'right', secondaryYAxis?.includeZero ?? !Array.isArray(secondaryYAxis?.domain)),
        [visibleData, areas, highlightedAreas, referenceLines, leftAxisDomain, secondaryYAxis],
    );
    const preferredDivisions = props.valueFormat === 'millions' ? 12 : 8;
    const pairedDivisions = props.secondaryYAxis
        ? selectRoundTickDivisions([[leftRange.min, leftRange.max], [rightRange.min, rightRange.max]], preferredDivisions)
        : undefined;
    const leftTicks = useMemo(() => ticksForRange(leftRange, props.valueFormat, pairedDivisions), [leftRange, props.valueFormat, pairedDivisions]);
    const rightTicks = useMemo(() => ticksForRange(rightRange, props.valueFormat, pairedDivisions), [rightRange, props.valueFormat, pairedDivisions]);

    const leftDomain = useMemo<[number, number]>(() => [leftTicks[0], leftTicks.at(-1) ?? 0], [leftTicks]);
    const rightDomain = useMemo<[number, number]>(() => [rightTicks[0], rightTicks.at(-1) ?? 0], [rightTicks]);

    const xAxisHeight = props.isMobile ? 32 : 30;
    const xTickFontSize = props.isMobile ? 9 : 10;
    const xTickValues = useMemo(() => props.visibleData.map(row => String(row[props.xAxisKey] ?? '')), [props.visibleData, props.xAxisKey]);
    const xTickLabels = useMemo(() => xTickValues.map(value => props.labelByXAxisValue.get(value) ?? value), [xTickValues, props.labelByXAxisValue]);
    const xTickSpacing = useMemo(() => xTickSpacingPx(xTickFontSize, xTickLabels), [xTickFontSize, xTickLabels]);
    const xTickEdgeSpacing = useMemo(() => xTickEdgeSpacingPx(xTickFontSize, xTickLabels), [xTickFontSize, xTickLabels]);
    const xTickCount = targetXTickCount(props.chartSize.width, layout.dataArea.left + layout.dataArea.right, xTickSpacing);
    const indicesPerPixel = Math.max(0, xTickValues.length - 1) / Math.max(1, props.chartSize.width - layout.dataArea.left - layout.dataArea.right);
    const minimumIndexGap = indicesPerPixel * xTickSpacing;
    const minimumEdgeIndexGap = indicesPerPixel * xTickEdgeSpacing;
    const xTicks = useMemo(() => selectMonthAlignedXTicks(xTickValues, xTickCount, minimumIndexGap, minimumEdgeIndexGap), [xTickValues, xTickCount, minimumIndexGap, minimumEdgeIndexGap]);

    const renderXAxisTick = useCallback((tickProps: XAxisTickContentProps) => (
        <text
            className={tickProps.className}
            x={tickProps.x}
            y={tickProps.y}
            textAnchor={tickProps.index === 0 ? 'start' : tickProps.index === tickProps.visibleTicksCount - 1 ? 'end' : 'middle'}
            dy={4}
            fill="#FFD700"
            fontSize={xTickFontSize}
        >
            {tickProps.tickFormatter?.(tickProps.payload.value, tickProps.index) ?? String(tickProps.payload.value ?? '')}
        </text>
    ), [xTickFontSize]);
    const formatXAxisTick = useCallback((value: string | number) => props.labelByXAxisValue.get(String(value)) ?? String(value), [props.labelByXAxisValue]);
    const formatLeftTick = useCallback((value: number) => formatAxisValueByType(value, props.valueFormat, props.yAxisDecimals), [props.valueFormat, props.yAxisDecimals]);
    const rightAxisFormat = props.secondaryYAxis?.format;
    const formatRightTick = useCallback((value: number) => formatValueByType(value, rightAxisFormat), [rightAxisFormat]);
    const leftTickStyle = useMemo(() => ({ fill: '#FFD700', fontSize: 10 }), []);
    const rightTickStyle = useMemo(() => ({ fill: props.secondaryYAxis?.color || '#00BFFF', fontSize: 10 }), [props.secondaryYAxis?.color]);

    const visibleReferenceLines = useMemo(() => props.referenceLines.filter(reference => reference.value >= 0), [props.referenceLines]);
    const backgroundReferenceLines = useMemo(() => visibleReferenceLines.filter(reference => !reference.foreground), [visibleReferenceLines]);
    const renderReferenceLine = (reference: ChartReferenceLine, key: string, outline = false) => <ReferenceLine
        key={key}
        y={reference.value}
        yAxisId="left"
        stroke={outline ? reference.outlineColor : reference.color ?? '#FFD700'}
        strokeWidth={outline ? 4 : reference.foreground ? 1.5 : 1.25}
        strokeDasharray={reference.dash?.join(' ')}
        strokeLinecap="round"
        zIndex={reference.foreground ? (outline ? 1000 : 1001) : undefined}
        label={!outline && reference.label ? { value: `${reference.label}: ${formatValueByType(reference.value, props.valueFormat)}`, position: 'insideTopRight', fill: reference.color ?? '#FFD700', fontSize: 10, fontWeight: 700 } : undefined}
    />;

    const hideHoverCrosshair = useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        hoverVerticalRef.current?.setAttribute('display', 'none');
        hoverHorizontalRef.current?.setAttribute('display', 'none');
    }, []);

    useEffect(() => {
        if (!isControlPressed) return;
        hideHoverCrosshair();
        hoverTooltipStore.clear();
        onHoverTooltipChange(null);
    }, [hideHoverCrosshair, hoverTooltipStore, isControlPressed, onHoverTooltipChange]);

    const updateHoverCrosshair = (state: ChartClickState | null) => {
        if (props.crosshair?.locked || props.isCapturing || isControlPressed) {
            hideHoverCrosshair();
            hoverTooltipStore.clear();
            return;
        }

        const hoverPoint = resolveChartHoverPoint(state, props.visibleData);
        if (!hoverPoint) {
            hideHoverCrosshair();
            hoverTooltipStore.clear();
            props.onHoverTooltipChange(null);
            return;
        }

        const { x, y, label, row: activeRow } = hoverPoint;
        const nextComparisonGroup = comparesMandateMonths && typeof activeRow.comparison_group === 'string'
            ? activeRow.comparison_group
            : null;
        setActiveComparisonGroup(current => current === nextComparisonGroup ? current : nextComparisonGroup);

        const normalizedValues = renderedAreas.flatMap(area => {
            const value = activeRow[area.key];
            if (typeof value !== 'number') return [];
            const domain = area.yAxisId === 'right' ? rightDomain : leftDomain;
            const range = domain[1] - domain[0];
            return range > 0 ? [(value - domain[0]) / range] : [];
        });
        const tooltipRows = renderedAreas.filter(area => !area.hideInTooltip).length + (props.showTooltipTotal ? 1 : 0);
        const tooltipHeight = props.isMobile ? 24 + tooltipRows * 15 : 40 + tooltipRows * 24;
        const tooltipY = calculateTooltipVerticalPosition(normalizedValues, y, props.chartSize.height, tooltipHeight);
        hoverTooltipStore.set({ label, x, y, tooltipY });
        props.onHoverTooltipChange({ x, y, locked: false, label, tooltipPosition: { y: tooltipY }, chartHeight: props.chartSize.height });

        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const vertical = hoverVerticalRef.current;
            const horizontal = hoverHorizontalRef.current;
            if (!vertical || !horizontal) return;
            vertical.setAttribute('x1', String(x));
            vertical.setAttribute('x2', String(x));
            vertical.setAttribute('display', 'block');
            horizontal.setAttribute('y1', String(y));
            horizontal.setAttribute('y2', String(y));
            horizontal.setAttribute('display', 'block');
        });
    };

    const plot = { left: layout.dataArea.left, right: layout.dataArea.right, top: layout.margins.top, bottom: layout.margins.bottom };
    const plotBounds = { minX: layout.margins.left + layout.axisWidths.left, minY: plot.top, maxX: chartSize.width - layout.margins.right - layout.axisWidths.right, maxY: chartSize.height - plot.bottom };
    const clearHover = () => {
        hideHoverCrosshair();
        hoverTooltipStore.clear();
        onHoverTooltipChange(null);
    };
    const touchCrosshair = useTouchCrosshair<HTMLDivElement>({
        bounds: plotBounds,
        tipBottom: () => chartContainerRef.current?.querySelector('[data-crosshair-tip]')?.getBoundingClientRect().bottom ?? null,
        onChange: (_element, next) => {
            if (!next.point) return clearHover();
            updateHoverCrosshair(chartClickStateFromPointer({ x: next.point[0], y: next.point[1], width: chartSize.width, height: chartSize.height, count: visibleData.length, ...plot }));
        },
    });
    const touchRef = useRef(touchCrosshair);
    useEffect(() => {
        touchRef.current = touchCrosshair;
    });
    const touchEnabled = isMobile && !isCapturing;
    // Mobile browsers replay a touch as mousemove/mousedown/click; while the last pointer was a finger, those must not drive the mouse hover.
    const touchPointerRef = useRef(false);
    useEffect(() => {
        const element = chartContainerRef.current;
        if (!element) return;
        element.style.touchAction = touchEnabled ? touchCrosshair.touchAction : '';
        Object.assign(element.style, touchEnabled ? TOUCH_PRESS_STYLE : { userSelect: '', WebkitUserSelect: '', WebkitTouchCallout: '' });
    }, [chartContainerRef, touchCrosshair.touchAction, touchEnabled]);
    useEffect(() => {
        const element = chartContainerRef.current;
        if (!touchEnabled || !element) return;

        const pointer = (event: PointerEvent) => ({ pointerType: event.pointerType, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, currentTarget: element });
        let ignoreClick = false;
        const track = (event: PointerEvent) => {
            touchPointerRef.current = isTouchPointer(event);
        };
        const onPointerDown = (event: PointerEvent) => {
            track(event);
            touchRef.current.down(pointer(event));
        };
        const onPointerMove = (event: PointerEvent) => {
            track(event);
            touchRef.current.move(pointer(event));
        };
        const onPointerUp = (event: PointerEvent) => {
            if (touchRef.current.up(pointer(event))) ignoreClick = true;
        };
        const onPointerCancel = (event: PointerEvent) => touchRef.current.cancel(pointer(event));
        const onContextMenu = (event: Event) => touchRef.current.contextMenu(event);
        // Touch taps never pin the tooltip: swallow the compatibility click that follows them.
        const onClickCapture = (event: Event) => {
            if (!ignoreClick) return;
            ignoreClick = false;
            event.preventDefault();
            event.stopPropagation();
        };

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerCancel);
        element.addEventListener('click', onClickCapture, true);
        element.addEventListener('contextmenu', onContextMenu);
        return () => {
            element.removeEventListener('contextmenu', onContextMenu);
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointermove', onPointerMove);
            element.removeEventListener('pointerup', onPointerUp);
            element.removeEventListener('pointercancel', onPointerCancel);
            element.removeEventListener('click', onClickCapture, true);
        };
    }, [chartContainerRef, touchEnabled]);

    return (
        <ComposedChart
            width={props.chartSize.width}
            height={props.chartSize.height}
            data={props.visibleData}
            margin={layout.margins}
            barSize={layout.barSize}
            barGap={0}
            stackOffset="sign"
            style={{ outline: 'none', pointerEvents: props.isCapturing ? 'none' : 'auto' }}
            onMouseMove={(e: ChartClickState | null) => {
                if (touchEnabled && touchPointerRef.current) return;
                updateHoverCrosshair(e);
            }}
            onMouseLeave={() => {
                hideHoverCrosshair();
                hoverTooltipStore.clear();
                props.onHoverTooltipChange(null);
                setActiveComparisonGroup(null);
            }}
            onClick={(e: ChartClickState | null) => {
                if (props.isControlPressed) return;
                hideHoverCrosshair();
                hoverTooltipStore.clear();
                props.onCrosshairClick(e);
                if (resolveChartHoverPoint(e, props.visibleData) == null) props.onSelectMonth(null);
            }}
        >
            <CartesianGrid vertical={false} horizontal={!props.secondaryYAxis} stroke="#ffffff66" strokeWidth={0.75} />
            <XAxis
                dataKey={props.xAxisKey}
                stroke="#FFD700"
                tick={renderXAxisTick}
                tickFormatter={formatXAxisTick}
                ticks={xTicks}
                interval={0}
                scale="point"
                padding={layout.xAxisPadding}
                height={xAxisHeight}
                tickMargin={props.isMobile ? 6 : 4}
            />
            <YAxis orientation="left" stroke="#FFD700" tick={leftTickStyle} tickFormatter={formatLeftTick} ticks={leftTicks} domain={leftDomain} allowDecimals={props.valueFormat !== 'millions' && props.valueFormat !== 'currency'} allowDataOverflow yAxisId="left" width={layout.axisWidths.left} hide={props.isMobile} />
            {props.secondaryYAxis && <YAxis orientation="right" stroke={props.secondaryYAxis.color || '#00BFFF'} tick={rightTickStyle} tickFormatter={formatRightTick} ticks={rightTicks} domain={rightDomain} allowDataOverflow yAxisId="right" width={layout.axisWidths.right} hide={props.isMobile} />}
            {props.secondaryYAxis ? leftTicks.map(tick => <ReferenceLine key={`tick-grid-${tick}`} y={tick} yAxisId="left" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.5} />) : null}
            {backgroundReferenceLines.map((reference, index) => renderReferenceLine(reference, reference.label ?? `${reference.value}-${index}`))}
            {renderedAreas.map(areaConfig => <ChartSeries key={areaConfig.key} areaConfig={areaConfig} props={props} animate={areaConfig.type === 'bar' ? animateBars : animateLines} />)}
            {comparisonRows.map(row => <MandatePoint key={String(row.iso_fecha)} x={row[props.xAxisKey] as string | number} y={Number(row.icg)} yAxisId="left" primaryColor={String(row.mandate_color ?? '#FFD700')} secondaryColor={typeof row.mandate_secondary_color === 'string' ? row.mandate_secondary_color : undefined} />)}
            {lockedSeriesPoints.map(({ area, value }) => <MandatePoint key={`locked-${area.key}`} x={lockedRow![props.xAxisKey] as string | number} y={value} yAxisId={area.yAxisId ?? 'left'} primaryColor={area.color} secondaryColor={area.secondaryColor} />)}
            <Customized component={(chartState: unknown) => <RangePreviewGuides previewRange={props.rangePreview} committedRange={props.committedRange} sortedData={props.sortedData} xAxisKey={props.xAxisKey} chartState={chartState} />} />
            {visibleReferenceLines.filter(reference => reference.foreground).flatMap((reference, index) => {
                const key = reference.label ?? `${reference.value}-${index}`;
                return reference.outlineColor
                    ? [renderReferenceLine(reference, `${key}-outline`, true), renderReferenceLine(reference, key)]
                    : [renderReferenceLine(reference, key)];
            })}
            <HoverCrosshair verticalRef={hoverVerticalRef} horizontalRef={hoverHorizontalRef} width={props.chartSize.width} height={props.chartSize.height} />
            <ChartCrosshair crosshair={props.crosshair} width={props.chartSize.width} height={props.chartSize.height} onUnlock={props.onCrosshairUnlock} isControlPressed={props.isControlPressed} />
        </ComposedChart>
    );
}

function HoverTooltipOverlay({
    store,
    areas,
    valueFormat,
    sortedData,
    chartWidth,
    chartHeight,
    showTotal,
    compact,
}: {
    store: HoverTooltipStore;
    areas: AreaConfig[];
    valueFormat: ValueFormat;
    sortedData: ChartDataRow[];
    chartWidth: number;
    chartHeight: number;
    showTotal: boolean;
    compact: boolean;
}) {
    const hover = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    if (!hover.label) return null;

    return (
        <CrosshairTooltip
            crosshair={{
                x: hover.x,
                y: hover.y,
                locked: false,
                label: hover.label,
                tooltipPosition: hover.tooltipY == null ? undefined : { y: hover.tooltipY },
            }}
            areas={areas}
            valueFormat={valueFormat}
            sortedData={sortedData}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            showTotal={showTotal}
            compact={compact}
            isCapturing={false}
        />
    );
}

function RangePreviewGuides({ previewRange, committedRange, sortedData, xAxisKey, chartState }: { previewRange: [number, number] | null; committedRange: [number, number]; sortedData: ChartDataRow[]; xAxisKey: 'iso_fecha' | 'fecha'; chartState: unknown }) {
    if (!previewRange) return null;

    const [committedStart, committedEnd] = committedRange;
    const [previewStart, previewEnd] = previewRange;
    const targets = [
        previewStart !== committedStart ? previewStart : null,
        previewEnd !== committedEnd ? previewEnd : null,
    ].filter((index): index is number => index !== null)
        .filter((index, position, array) => array.indexOf(index) === position)
        .filter((index) => index >= committedStart && index <= committedEnd);

    if (targets.length === 0) return null;

    const offset = typeof chartState === 'object' && chartState !== null && 'offset' in chartState
        ? (chartState as { offset?: { left?: number; top?: number; height?: number } }).offset
        : undefined;
    const xAxisMap = typeof chartState === 'object' && chartState !== null && 'xAxisMap' in chartState
        ? (chartState as { xAxisMap?: Record<string, { scale?: ((value: string | number) => number) }> }).xAxisMap
        : undefined;
    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined;

    if (!xAxis?.scale) return null;

    const top = offset?.top ?? 0;
    const height = offset?.height ?? 0;
    const lines = targets
        .map((index) => sortedData[index]?.[xAxisKey])
        .filter((value): value is NonNullable<typeof value> => value !== null && value !== undefined)
        .map((value) => {
            const x = xAxis.scale?.(value);
            return typeof x === 'number' && Number.isFinite(x) ? x + (offset?.left ?? 0) : null;
        })
        .filter((x): x is number => x !== null);

    if (lines.length === 0) return null;

    return (
        <g className="recharts-range-preview-guide" pointerEvents="none">
            {lines.map((x, index) => (
                <line key={`${index}-${x}`} x1={x} x2={x} y1={top} y2={top + height} stroke="#00BFFF" strokeWidth={1.5} strokeDasharray="4 4" />
            ))}
        </g>
    );
}

function HoverCrosshair({ verticalRef, horizontalRef, width, height }: { verticalRef: RefObject<SVGLineElement | null>; horizontalRef: RefObject<SVGLineElement | null>; width: number; height: number }) {
    return (
        <g className="recharts-hover-crosshair-guide" pointerEvents="none">
            <line ref={verticalRef} x1={0} x2={0} y1={0} y2={height} stroke={CROSSHAIR_STROKE} strokeWidth={CROSSHAIR_STROKE_WIDTH} strokeDasharray={CROSSHAIR_DASH} display="none" />
            <line ref={horizontalRef} x1={0} x2={width} y1={0} y2={0} stroke={CROSSHAIR_STROKE} strokeWidth={CROSSHAIR_STROKE_WIDTH} strokeDasharray={CROSSHAIR_DASH} display="none" />
        </g>
    );
}

function ChartCrosshair({ crosshair, width, height, onUnlock, isControlPressed }: { crosshair: ChartCrosshairState | null; width: number; height: number; onUnlock: () => void; isControlPressed: boolean }) {
    const [isHovered, setIsHovered] = useState(false);
    if (!crosshair) return null;
    const stroke = crosshair.locked ? (isHovered ? '#FFFFFF' : '#FFD700AA') : CROSSHAIR_STROKE;
    const strokeWidth = crosshair.locked && isHovered ? 1.5 : CROSSHAIR_STROKE_WIDTH;
    const handleClick = (event: MouseEvent<SVGLineElement>) => {
        event.stopPropagation();
        onUnlock();
    };
    const interactionProps = crosshair.locked ? {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onClick: handleClick,
        style: { cursor: 'pointer' },
    } : {};

    return (
        <g className="recharts-crosshair-guide">
            <line x1={crosshair.x} x2={crosshair.x} y1={0} y2={height} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={CROSSHAIR_DASH} pointerEvents="none" />
            <line x1={0} x2={width} y1={crosshair.y} y2={crosshair.y} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={CROSSHAIR_DASH} pointerEvents="none" />
            {crosshair.locked && !isControlPressed ? <line x1={crosshair.x} x2={crosshair.x} y1={0} y2={height} stroke="rgba(255,255,255,0.01)" strokeWidth={14} pointerEvents="stroke" {...interactionProps} /> : null}
            {crosshair.locked && !isControlPressed ? <line x1={0} x2={width} y1={crosshair.y} y2={crosshair.y} stroke="rgba(255,255,255,0.01)" strokeWidth={14} pointerEvents="stroke" {...interactionProps} /> : null}
        </g>
    );
}

type AxisRangeInput = Pick<ChartRenderProps, 'visibleData' | 'areas' | 'highlightedAreas' | 'referenceLines' | 'leftAxisDomain' | 'secondaryYAxis'>;

function axisTickRange(props: AxisRangeInput, axisId: 'left' | 'right', includeZero: boolean): { min: number; max: number; allNonNegative: boolean } {
    const values = collectAxisExtentValues(props.visibleData, props.areas, {
        yAxisId: axisId,
        highlightedAreas: props.highlightedAreas,
    });
    if (axisId === 'left') values.push(...props.referenceLines.map(reference => reference.value));

    if (values.length === 0) return { min: 0, max: 1, allNonNegative: true };

    const allNonNegative = values.every((value) => value >= 0);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin;
    const padding = range === 0 ? 1 : range * 0.05;
    let min = allNonNegative ? Math.max(0, dataMin - padding) : dataMin - padding;
    let max = dataMax + padding;

    const domain = axisId === 'left' ? props.leftAxisDomain : props.secondaryYAxis?.domain;
    if (Array.isArray(domain) && typeof domain[0] === 'number' && typeof domain[1] === 'number') {
        min = domain[0];
        max = domain[1];
    } else if (includeZero) {
        min = Math.min(0, min);
        max = Math.max(0, max);
    }

    return { min, max, allNonNegative };
}

function ticksForRange({ min, max, allNonNegative }: ReturnType<typeof axisTickRange>, valueFormat: ValueFormat, fixedDivisions?: number): number[] {
    if (fixedDivisions) return createRoundTicks(min, max, fixedDivisions);

    const targetDivisions = valueFormat === 'millions' ? 12 : 8;
    const step = niceStep((max - min) / targetDivisions);
    const start = allNonNegative ? Math.max(0, Math.floor(min / step) * step) : Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= end + step / 2; value += step) {
        ticks.push(Number(value.toPrecision(12)));
    }

    if (ticks.length < 2) return [min, max];
    return ticks;
}

function niceStep(rawStep: number): number {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const residual = rawStep / magnitude;
    if (residual <= 1) return magnitude;
    if (residual <= 2) return 2 * magnitude;
    if (residual <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

function CrosshairTooltip({ crosshair, areas, valueFormat, sortedData, chartWidth, chartHeight, showTotal, compact, isCapturing }: { crosshair: ChartCrosshairState; areas: AreaConfig[]; valueFormat: ValueFormat; sortedData: ChartDataRow[]; chartWidth: number; chartHeight: number; showTotal: boolean; compact: boolean; isCapturing: boolean }) {
    const label = crosshair.label;
    const rowData = label ? sortedData.find(row => row.fecha === label || row.iso_fecha === label) : null;
    if (!rowData) return null;
    const tooltipWidth = compact ? 176 : 260;
    const tooltipHeight = compact ? 24 + areas.length * 15 : 40 + areas.length * 24;
    const fallbackX = crosshair.x + 10 + tooltipWidth > chartWidth ? Math.max(0, crosshair.x - tooltipWidth - 10) : crosshair.x + 10;
    const fallbackY = crosshair.y + 10 + tooltipHeight > chartHeight ? Math.max(0, crosshair.y - tooltipHeight - 10) : crosshair.y + 10;

    return (
        <div className="absolute z-10 pointer-events-none" style={{ left: crosshair.tooltipPosition?.x ?? fallbackX, top: crosshair.tooltipPosition?.y ?? fallbackY }}>
            <ChartTooltip chartData={sortedData} areaConfigs={areas} valueFormat={valueFormat} tooltipProps={{ active: true, label }} compact={compact} showTotal={showTotal} isCapturing={isCapturing} />
        </div>
    );
}

function ChartSeries({ areaConfig, props, animate }: { areaConfig: AreaConfig; props: ChartRenderProps; animate: boolean }) {
    const { onToggleHighlight } = props;
    const onCtrlClick = useCallback(() => onToggleHighlight(areaConfig.legendKey || areaConfig.key), [onToggleHighlight, areaConfig.legendKey, areaConfig.key]);
    const allSeriesKeys = useMemo(() => props.areas.filter(a => a.type === 'line').map(a => a.key), [props.areas]);
    if (areaConfig.type === 'line') return <ChartLine areaConfig={areaConfig} isDimmed={false} data={props.visibleData} chartData={props.visibleData} allSeriesKeys={allSeriesKeys} isCapturing={props.isCapturing} animate={animate} isMobile={props.isMobile} onCtrlClick={onCtrlClick} />;
    if (areaConfig.type === 'bar') return <ChartBar areaConfig={areaConfig} isDimmed={false} selectedMonth={props.selectedMonth} onSelectMonth={props.onSelectMonth} selectByMonth={props.selectByMonth} isCapturing={props.isCapturing} animate={animate} onCtrlClick={onCtrlClick} />;
    return <ChartArea areaConfig={areaConfig} isDimmed={false} onCtrlClick={onCtrlClick} />;
}

function MandatePoint({ x, y, yAxisId, primaryColor, secondaryColor }: { x: string | number; y: number; yAxisId: 'left' | 'right'; primaryColor: string; secondaryColor?: string }) {
    return (
        <>
            <ReferenceDot x={x} y={y} yAxisId={yAxisId} r={7} fill={secondaryColor ?? primaryColor} stroke="#000000" strokeWidth={1} pointerEvents="none" />
            <ReferenceDot x={x} y={y} yAxisId={yAxisId} r={4} fill={primaryColor} stroke="#000000" strokeWidth={1} pointerEvents="none" />
        </>
    );
}

function activeAreas(areas: AreaConfig[], highlightedAreas: Set<string>): AreaConfig[] {
    if (highlightedAreas.size === 0) return areas;
    return areas.filter(area => highlightedAreas.has(area.legendKey || area.key));
}
