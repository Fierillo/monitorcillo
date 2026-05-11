import { ImageDown } from 'lucide-react';
import { CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { AreaConfig, ChartAxisDomain, ChartClickState, ChartDataRow, MethodologyItem, ValueFormat, YAxisConfig } from '@/types/chart';
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
    dimmedAreas: Set<string>;
    selectedMonth: string | null;
    selectByMonth: boolean;
    isMobile: boolean;
    isCapturing: boolean;
    forceDesktopLayout?: boolean;
    onDownloadChart: () => void;
    onSelectMonth: (month: string | null) => void;
    onToggleDim: (key: string) => void;
};

type ChartRenderProps = Omit<Props, 'captureRef' | 'chartContainerRef'>;

export default function CompositeChartCard({ captureRef, chartContainerRef, ...chartProps }: Props) {
    const renderProps = chartProps.forceDesktopLayout
        ? { ...chartProps, isMobile: false, chartSize: { width: 1260, height: 780 } }
        : chartProps;
    const captureStyle = chartProps.forceDesktopLayout ? { outline: 'none', width: 1400 } : { outline: 'none' };

    return (
        <main className={chartProps.forceDesktopLayout ? 'w-[1400px] max-w-none' : 'w-full sm:w-[96%] max-w-[1800px]'}>
            <div className={`${chartProps.forceDesktopLayout ? 'w-[1400px] min-h-[850px] p-4' : 'w-full min-h-[600px] sm:min-h-[850px] p-2 sm:p-4'} bg-imperial-blue border-2 border-imperial-gold shadow-lg shadow-imperial-blue/50 flex flex-col overflow-hidden`} style={{ outline: 'none' }} tabIndex={-1}>
                <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue overflow-hidden" style={captureStyle} tabIndex={-1}>
                    {renderProps.isCapturing ? <ExportHeader title={renderProps.title} subtitle={renderProps.subtitle} /> : null}
                    <ChartHeader onDownloadChart={renderProps.onDownloadChart} isCapturing={renderProps.isCapturing} />
                    <ChartCanvas {...renderProps} chartContainerRef={chartContainerRef} />
                    <CustomLegend areas={renderProps.areas} dimmedAreas={renderProps.dimmedAreas} onToggleDim={renderProps.onToggleDim} />
                    <MethodologySection methodology={renderProps.methodology} forceOpen={renderProps.isCapturing} />
                </div>
            </div>
        </main>
    );
}

function ExportHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return <div className="mb-3 border-b border-imperial-gold/40 pb-3 text-center"><h1 className="imperial-title text-2xl font-bold uppercase tracking-widest text-imperial-gold">{title}</h1>{subtitle ? <p className="mt-1 text-sm font-bold uppercase tracking-wide text-imperial-cyan">{subtitle}</p> : null}</div>;
}

function ChartHeader({ onDownloadChart, isCapturing }: { onDownloadChart: () => void; isCapturing: boolean }) {
    if (isCapturing) return null;

    return (
        <div className="mb-2 flex shrink-0 justify-end" style={{ outline: 'none' }}>
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
    const captureChartStyle = props.forceDesktopLayout ? { outline: 'none', width: 1260, height: 780 } : { outline: 'none' };

    return (
        <div className={`flex-1 flex flex-row relative ${props.forceDesktopLayout ? 'min-h-[780px]' : 'min-h-[300px] sm:min-h-[500px]'} overflow-hidden`} style={captureCanvasStyle}>
            {!props.isMobile && props.yAxisLabel && <AxisLabel label={props.yAxisLabel} />}
            <div ref={chartContainerRef} className={props.forceDesktopLayout ? 'relative overflow-hidden' : 'relative flex-1 overflow-hidden'} style={captureChartStyle} tabIndex={-1}>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 select-none"><span className="watermark text-imperial-gold/21 text-xl sm:text-4xl font-sans font-bold uppercase tracking-[0.5em]">@fierillo</span></div>
                {props.chartSize.width > 0 && props.chartSize.height > 0 ? <ResponsiveComposedChart {...props} /> : <div className="h-full min-h-[500px] w-full flex items-center justify-center text-imperial-cyan font-bold">Cargando gráfico...</div>}
            </div>
            {!props.isMobile && props.secondaryYAxis && <AxisLabel label={props.secondaryYAxis.label ?? ''} color={props.secondaryYAxis.color || '#00BFFF'} right />}
        </div>
    );
}

function AxisLabel({ label, color, right = false }: { label: string; color?: string; right?: boolean }) {
    return <div className="flex items-center justify-center w-12 shrink-0"><div className={`${right ? 'rotate-90' : '-rotate-90'} whitespace-nowrap ${color ? '' : 'text-imperial-gold'} font-bold text-xs uppercase tracking-widest`} style={{ color }}>{label}</div></div>;
}

function ResponsiveComposedChart(props: ChartRenderProps) {
    const leftTicks = axisTicks(props, 'left', !Array.isArray(props.leftAxisDomain));
    const rightTicks = axisTicks(props, 'right', !Array.isArray(props.secondaryYAxis?.domain));

    return (
        <ComposedChart width={props.chartSize.width} height={props.chartSize.height} data={props.visibleData} margin={{ top: 5, right: props.isMobile ? 5 : 20, bottom: 5, left: props.isMobile ? 5 : 20 }} barCategoryGap="0%" stackOffset="sign" style={{ outline: 'none' }} onClick={(e: ChartClickState | null) => { if (!e?.activePayload?.length || !e.activeTooltipIndex) props.onSelectMonth(null); }}>
            <CartesianGrid vertical={false} horizontal stroke="#ffffff66" strokeWidth={0.75} />
            <XAxis dataKey={props.xAxisKey} stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(value: string | number) => props.labelByXAxisValue.get(String(value)) ?? String(value)} hide={props.isMobile} />
            <YAxis orientation="left" stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(val) => formatAxisValueByType(val, props.valueFormat, props.yAxisDecimals)} ticks={leftTicks} domain={[leftTicks[0], leftTicks.at(-1) ?? 0]} allowDecimals={props.valueFormat !== 'millions'} allowDataOverflow yAxisId="left" width={props.isMobile ? 0 : 60} hide={props.isMobile} />
            {props.secondaryYAxis && <YAxis orientation="right" stroke={props.secondaryYAxis.color || '#00BFFF'} tick={{ fill: props.secondaryYAxis.color || '#00BFFF', fontSize: 10 }} tickFormatter={(val) => formatValueByType(val, props.secondaryYAxis?.format)} ticks={rightTicks} domain={[rightTicks[0], rightTicks.at(-1) ?? 0]} allowDataOverflow yAxisId="right" width={props.isMobile ? 0 : 60} hide={props.isMobile} />}
            {!props.isCapturing && <Tooltip cursor={{ stroke: '#ffffff50', strokeWidth: 1 }} content={(tooltipProps) => <ChartTooltip chartData={props.sortedData} areaConfigs={props.areas} valueFormat={props.valueFormat} tooltipProps={tooltipProps} />} />}
            {props.areas.map(areaConfig => <ChartSeries key={areaConfig.key} areaConfig={areaConfig} props={props} />)}
        </ComposedChart>
    );
}

function axisTicks(props: ChartRenderProps, axisId: 'left' | 'right', includeZero: boolean): number[] {
    const values = props.visibleData.flatMap(row => props.areas
        .filter(area => (area.yAxisId ?? 'left') === axisId)
        .filter(area => !props.dimmedAreas.has(area.legendKey || area.key))
        .map(area => row[area.key])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));

    if (values.length === 0) return [0, 1];

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin;
    const padding = includeZero ? 0 : Math.max(range * 0.05, 1);
    const min = includeZero ? Math.min(0, dataMin) : dataMin - padding;
    const max = includeZero ? Math.max(0, dataMax) : dataMax + padding;
    const step = niceStep((max - min) / 12);
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= end + step / 2; value += step) {
        ticks.push(Number(value.toPrecision(12)));
    }

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

function ChartSeries({ areaConfig, props }: { areaConfig: AreaConfig; props: ChartRenderProps }) {
    if (props.dimmedAreas.has(areaConfig.legendKey || areaConfig.key)) return null;
    if (areaConfig.type === 'line') return <ChartLine areaConfig={areaConfig} isDimmed={false} />;
    if (areaConfig.type === 'bar') return <ChartBar areaConfig={areaConfig} isDimmed={false} selectedMonth={props.selectedMonth} onSelectMonth={props.onSelectMonth} selectByMonth={props.selectByMonth} />;
    return <ChartArea areaConfig={areaConfig} isDimmed={false} />;
}
