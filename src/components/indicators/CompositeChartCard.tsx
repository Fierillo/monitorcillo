import { ImageDown } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { ReactNode, RefObject } from 'react';
import { CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { AreaConfig, ChartAxisDomain, ChartClickState, ChartCrosshairState, ChartDataRow, MethodologyItem, TooltipPayload, ValueFormat, YAxisConfig } from '@/types/chart';
import ChartArea from '../chart/ChartArea';
import ChartBar from '../chart/ChartBar';
import ChartLine from '../chart/ChartLine';
import ChartTooltip from '../chart/ChartTooltip';
import CustomLegend from '../chart/CustomLegend';
import MethodologySection from '../chart/MethodologySection';
import { formatAxisValueByType, formatValueByType } from '../chart/utils';

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
    crosshair: ChartCrosshairState | null;
    isMobile: boolean;
    isCapturing: boolean;
    forceDesktopLayout?: boolean;
    viewSelector?: ReactNode;
    timeRangeSlider?: ReactNode;
    onDownloadChart: () => void;
    onSelectMonth: (month: string | null) => void;
    onToggleHighlight: (key: string) => void;
    onCrosshairClick: (state: ChartClickState | null) => void;
    onCrosshairUnlock: () => void;
};

type ChartRenderProps = Omit<Props, 'captureRef' | 'chartContainerRef'>;

export default function CompositeChartCard({ captureRef, chartContainerRef, ...chartProps }: Props) {
    const renderProps = chartProps.forceDesktopLayout
        ? { ...chartProps, isMobile: false, chartSize: { width: 1240, height: 780 } }
        : chartProps;
    const captureStyle = chartProps.forceDesktopLayout ? { outline: 'none', width: '100%', padding: 16, boxSizing: 'border-box' as const } : { outline: 'none', padding: 0, flex: chartProps.isCapturing ? '0 0 auto' : undefined };

    return (
        <main className={chartProps.forceDesktopLayout ? 'w-[1400px] max-w-none' : 'w-full sm:w-[96%] max-w-[1800px]'}>
            <div className={`${chartProps.forceDesktopLayout ? 'w-[1400px] min-h-[850px] p-4' : 'w-full min-h-[600px] sm:min-h-[850px] p-2 sm:p-4'} bg-imperial-blue border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 flex flex-col overflow-hidden`} style={{ outline: 'none' }} tabIndex={-1}>
                <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue overflow-hidden" style={captureStyle} tabIndex={-1}>
                    {renderProps.isCapturing ? <ExportHeader title={renderProps.title} subtitle={renderProps.subtitle} /> : null}
                    <ChartHeader onDownloadChart={renderProps.onDownloadChart} isCapturing={renderProps.isCapturing} viewSelector={renderProps.viewSelector} />
                    <ChartCanvas {...renderProps} chartContainerRef={chartContainerRef} />
                    <CustomLegend areas={renderProps.areas} highlightedAreas={renderProps.highlightedAreas} onToggleHighlight={renderProps.onToggleHighlight} compact={renderProps.isCapturing} />
                    {renderProps.timeRangeSlider ? <div className="no-capture my-2">{renderProps.timeRangeSlider}</div> : null}
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

function ChartHeader({ onDownloadChart, isCapturing, viewSelector }: { onDownloadChart: () => void; isCapturing: boolean; viewSelector?: ReactNode }) {
    if (isCapturing) return null;

    return (
        <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ outline: 'none' }}>
            <div>{viewSelector}</div>
            <div className="flex justify-end gap-2 w-full sm:w-auto">
                <button onClick={onDownloadChart} className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2 w-full sm:w-auto justify-center" title="Descargar gráfico">
                    <ImageDown size={16} /> Guardar
                </button>
            </div>
        </div>
    );
}

function ChartCanvas({ chartContainerRef, ...props }: ChartRenderProps & { chartContainerRef: React.RefObject<HTMLDivElement | null> }) {
    const captureCanvasStyle = props.forceDesktopLayout ? { outline: 'none', height: 780 } : { outline: 'none' };
    const captureChartStyle = props.forceDesktopLayout ? { outline: 'none', width: 1240, height: 780 } : { outline: 'none' };

    return (
        <div className={`flex-1 flex flex-row relative ${props.forceDesktopLayout ? 'min-h-[780px]' : 'min-h-[300px] sm:min-h-[500px]'} overflow-visible`} style={captureCanvasStyle}>
            {!props.isMobile && props.yAxisLabel && <AxisLabel label={props.yAxisLabel} />}
            <div ref={chartContainerRef} className={props.forceDesktopLayout ? 'relative overflow-hidden' : 'relative flex-1 overflow-hidden'} style={captureChartStyle} tabIndex={-1}>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 select-none"><span className="watermark text-imperial-gold/21 text-xl sm:text-4xl font-sans font-bold uppercase tracking-[0.5em]">@fierillo</span></div>
                {props.chartSize.width > 0 && props.chartSize.height > 0 ? <ResponsiveComposedChart {...props} /> : <div className="h-full min-h-[500px] w-full flex items-center justify-center text-imperial-cyan font-bold">Cargando gráfico...</div>}
            </div>
            {!props.isMobile && props.secondaryYAxis && <AxisLabel label={props.secondaryYAxis.label ?? ''} color={props.secondaryYAxis.color || '#00BFFF'} right />}
            {props.isCapturing && props.crosshair?.locked && props.crosshair.activePayload && props.crosshair.label ? <CrosshairTooltip crosshair={props.crosshair} areas={props.areas} valueFormat={props.valueFormat} sortedData={props.sortedData} chartWidth={props.chartSize.width} chartHeight={props.chartSize.height} /> : null}
        </div>
    );
}

function AxisLabel({ label, color, right = false }: { label: string; color?: string; right?: boolean }) {
    return <div className="flex w-5 shrink-0 items-center justify-center"><div className={`${right ? 'rotate-90' : '-rotate-90'} whitespace-nowrap ${color ? '' : 'text-imperial-gold'} font-bold text-xs uppercase tracking-widest`} style={{ color }}>{label}</div></div>;
}

function ResponsiveComposedChart(props: ChartRenderProps) {
    const hoverVerticalRef = useRef<SVGLineElement | null>(null);
    const hoverHorizontalRef = useRef<SVGLineElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const leftTicks = axisTicks(props, 'left', !Array.isArray(props.leftAxisDomain));
    const rightTicks = axisTicks(props, 'right', props.secondaryYAxis?.includeZero ?? !Array.isArray(props.secondaryYAxis?.domain));

    const leftDomain = [leftTicks[0], leftTicks.at(-1) ?? 0];
    const rightDomain = [rightTicks[0], rightTicks.at(-1) ?? 0];

    const yAxisWidth = props.isMobile ? 0 : (props.valueFormat === 'millions' ? 76 : 52);
    const leftMargin = props.isMobile ? 5 : yAxisWidth + -50;
    const rightMargin = props.isMobile ? 5 : (props.secondaryYAxis ? 15 : 10);

    const hideHoverCrosshair = useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        hoverVerticalRef.current?.setAttribute('display', 'none');
        hoverHorizontalRef.current?.setAttribute('display', 'none');
    }, []);

    const updateHoverCrosshair = useCallback((state: ChartClickState | null) => {
        if (props.crosshair?.locked || props.isCapturing) {
            hideHoverCrosshair();
            return;
        }

        const x = state?.activeCoordinate?.x;
        const y = state?.activeCoordinate?.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
            hideHoverCrosshair();
            return;
        }

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
    }, [hideHoverCrosshair, props.crosshair?.locked, props.isCapturing]);

    return (
        <ComposedChart
            width={props.chartSize.width}
            height={props.chartSize.height}
            data={props.visibleData}
            margin={{ top: 5, right: rightMargin, bottom: 5, left: leftMargin }}
            barCategoryGap="0%"
            stackOffset="sign"
            style={{ outline: 'none', pointerEvents: props.isCapturing ? 'none' : 'auto' }}
            onMouseMove={(e: ChartClickState | null) => updateHoverCrosshair(e)}
            onMouseLeave={hideHoverCrosshair}
            onClick={(e: ChartClickState | null) => {
                hideHoverCrosshair();
                props.onCrosshairClick(e);
                if (!e?.activePayload?.length || !e.activeTooltipIndex) props.onSelectMonth(null);
            }}
        >
            <CartesianGrid vertical={false} horizontal stroke="#ffffff66" strokeWidth={0.75} />
            <XAxis dataKey={props.xAxisKey} stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(value: string | number) => props.labelByXAxisValue.get(String(value)) ?? String(value)} hide={props.isMobile} />
            <YAxis orientation="left" stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(val) => formatAxisValueByType(val, props.valueFormat, props.yAxisDecimals)} ticks={leftTicks} domain={leftDomain} allowDecimals={props.valueFormat !== 'millions'} allowDataOverflow yAxisId="left" width={props.isMobile ? 0 : (props.valueFormat === 'millions' ? 80 : 60)} hide={props.isMobile} />
            {props.secondaryYAxis && <YAxis orientation="right" stroke={props.secondaryYAxis.color || '#00BFFF'} tick={{ fill: props.secondaryYAxis.color || '#00BFFF', fontSize: 10 }} tickFormatter={(val) => formatValueByType(val, props.secondaryYAxis?.format)} ticks={rightTicks} domain={rightDomain} allowDataOverflow yAxisId="right" width={props.isMobile ? 0 : 60} hide={props.isMobile} />}
            {!props.isCapturing && <Tooltip cursor={false} content={(tooltipProps) => <ChartTooltip chartData={props.sortedData} areaConfigs={props.areas} valueFormat={props.valueFormat} tooltipProps={tooltipProps} />} />}
            {props.areas.map(areaConfig => <ChartSeries key={areaConfig.key} areaConfig={areaConfig} props={props} />)}
            <HoverCrosshair verticalRef={hoverVerticalRef} horizontalRef={hoverHorizontalRef} width={props.chartSize.width} height={props.chartSize.height} />
            <ChartCrosshair crosshair={props.crosshair} width={props.chartSize.width} height={props.chartSize.height} onUnlock={props.onCrosshairUnlock} />
        </ComposedChart>
    );
}

function HoverCrosshair({ verticalRef, horizontalRef, width, height }: { verticalRef: RefObject<SVGLineElement | null>; horizontalRef: RefObject<SVGLineElement | null>; width: number; height: number }) {
    return (
        <g className="recharts-hover-crosshair-guide" pointerEvents="none">
            <line ref={verticalRef} x1={0} x2={0} y1={0} y2={height} stroke="#FFFFFF99" strokeWidth={0.75} strokeDasharray="2 3" display="none" />
            <line ref={horizontalRef} x1={0} x2={width} y1={0} y2={0} stroke="#FFFFFF99" strokeWidth={0.75} strokeDasharray="2 3" display="none" />
        </g>
    );
}

function ChartCrosshair({ crosshair, width, height, onUnlock }: { crosshair: ChartCrosshairState | null; width: number; height: number; onUnlock: () => void }) {
    const [isHovered, setIsHovered] = useState(false);
    if (!crosshair) return null;
    const stroke = crosshair.locked ? (isHovered ? '#FFFFFF' : '#FFD700AA') : '#FFFFFF99';
    const strokeWidth = crosshair.locked && isHovered ? 1.5 : 0.75;
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
            <line x1={crosshair.x} x2={crosshair.x} y1={0} y2={height} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="2 3" pointerEvents="none" />
            <line x1={0} x2={width} y1={crosshair.y} y2={crosshair.y} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="2 3" pointerEvents="none" />
            {crosshair.locked ? <line x1={crosshair.x} x2={crosshair.x} y1={0} y2={height} stroke="rgba(255,255,255,0.01)" strokeWidth={14} pointerEvents="stroke" {...interactionProps} /> : null}
            {crosshair.locked ? <line x1={0} x2={width} y1={crosshair.y} y2={crosshair.y} stroke="rgba(255,255,255,0.01)" strokeWidth={14} pointerEvents="stroke" {...interactionProps} /> : null}
        </g>
    );
}

function axisTicks(props: ChartRenderProps, axisId: 'left' | 'right', includeZero: boolean): number[] {
    const values = props.visibleData.flatMap(row => props.areas
        .filter(area => (area.yAxisId ?? 'left') === axisId)
        .filter(area => props.highlightedAreas.size === 0 || props.highlightedAreas.has(area.legendKey || area.key))
        .map(area => row[area.key])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));

    if (values.length === 0) return [0, 1];

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

    const targetDivisions = props.valueFormat === 'millions' ? 12 : 8;
    const step = niceStep((max - min) / targetDivisions);
    const start = allNonNegative ? Math.max(0, Math.floor(min / step) * step) : Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= end + step / 2; value += step) {
        ticks.push(Number(value.toPrecision(12)));
    }

    if (ticks.length < 2) return [min, max];
    return includeZero && !ticks.includes(0) ? [...ticks, 0].sort((a, b) => a - b) : ticks;
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

function CrosshairTooltip({ crosshair, areas, valueFormat, sortedData, chartWidth, chartHeight }: { crosshair: ChartCrosshairState; areas: AreaConfig[]; valueFormat: ValueFormat; sortedData: ChartDataRow[]; chartWidth: number; chartHeight: number }) {
    const label = crosshair.label;
    const rowData = label ? sortedData.find(row => row.fecha === label || row.iso_fecha === label) : null;
    if (!rowData) return null;

    const visibleAreas = areas.filter(area => !area.hideInLegend && !area.borderColor);
    const valueRows = visibleAreas
        .map(area => {
            const value = rowData[area.key];
            if (value === null || value === undefined) return null;
            return { key: area.key, name: area.name, color: area.color, formatted: formatValueByType(Number(value), area.valueFormat ?? valueFormat, 1) };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    if (valueRows.length === 0) return null;

    const TOOLTIP_WIDTH = 180;
    const TOOLTIP_HEIGHT估算 = 40 + valueRows.length * 20;
    const flipX = crosshair.x + 16 + TOOLTIP_WIDTH > chartWidth;
    const flipY = crosshair.y - TOOLTIP_HEIGHT估算 < 0;

    return (
        <div
            className="absolute z-10 bg-imperial-blue/90 border border-imperial-gold/40 px-3 py-2 text-xs pointer-events-none backdrop-blur-sm"
            style={{
                left: flipX ? crosshair.x - TOOLTIP_WIDTH - 8 : crosshair.x + 16,
                top: flipY ? crosshair.y + 8 : undefined,
                bottom: flipY ? undefined : chartHeight - crosshair.y + 8,
                minWidth: TOOLTIP_WIDTH,
            }}
        >
            <div className="mb-1 font-bold text-imperial-gold">{rowData.fecha}</div>
            {valueRows.map(row => (
                <div key={row.key} className="flex justify-between gap-4" style={{ color: row.color }}>
                    <span className="font-bold">{row.name}</span>
                    <span>{row.formatted}</span>
                </div>
            ))}
        </div>
    );
}

function ChartSeries({ areaConfig, props }: { areaConfig: AreaConfig; props: ChartRenderProps }) {
    const isDimmed = props.highlightedAreas.size > 0 && !props.highlightedAreas.has(areaConfig.legendKey || areaConfig.key);
    if (areaConfig.type === 'line') return <ChartLine areaConfig={areaConfig} isDimmed={isDimmed} data={props.visibleData} />;
    if (areaConfig.type === 'bar') return <ChartBar areaConfig={areaConfig} isDimmed={isDimmed} selectedMonth={props.selectedMonth} onSelectMonth={props.onSelectMonth} selectByMonth={props.selectByMonth} />;
    return <ChartArea areaConfig={areaConfig} isDimmed={isDimmed} />;
}
