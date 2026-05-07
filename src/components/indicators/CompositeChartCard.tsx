import { ImageDown } from 'lucide-react';
import { CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { AreaConfig, ChartAxisDomain, ChartClickState, ChartDataRow, MethodologyItem, ValueFormat, YAxisConfig } from '@/types/chart';
import ChartArea from '../chart/ChartArea';
import ChartBar from '../chart/ChartBar';
import ChartLine from '../chart/ChartLine';
import ChartTooltip from '../chart/ChartTooltip';
import CustomLegend from '../chart/CustomLegend';
import MethodologySection from '../chart/MethodologySection';
import { formatValueByType } from '../chart/utils';

type Props = {
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
    onDownloadChart: () => void;
    onSelectMonth: (month: string | null) => void;
    onToggleDim: (key: string) => void;
};

type ChartRenderProps = Omit<Props, 'captureRef' | 'chartContainerRef'>;

export default function CompositeChartCard({ captureRef, chartContainerRef, ...chartProps }: Props) {
    return (
        <main className="w-full sm:w-[96%] max-w-[1800px]">
            <div className="w-full min-h-[600px] sm:min-h-[850px] bg-imperial-blue border-2 border-imperial-gold p-2 sm:p-4 shadow-lg shadow-imperial-blue/50 flex flex-col overflow-hidden" style={{ outline: 'none' }} tabIndex={-1}>
                <div ref={captureRef} className="flex-1 flex flex-col bg-imperial-blue overflow-hidden" style={{ outline: 'none' }} tabIndex={-1}>
                    <ChartHeader chartTitle={chartProps.chartTitle} onDownloadChart={chartProps.onDownloadChart} />
                    <ChartCanvas {...chartProps} chartContainerRef={chartContainerRef} />
                    <CustomLegend areas={chartProps.areas} dimmedAreas={chartProps.dimmedAreas} onToggleDim={chartProps.onToggleDim} />
                    <MethodologySection methodology={chartProps.methodology} forceOpen={chartProps.isCapturing} />
                </div>
            </div>
        </main>
    );
}

function ChartHeader({ chartTitle, onDownloadChart }: { chartTitle: string; onDownloadChart: () => void }) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mb-2 shrink-0 gap-2" style={{ outline: 'none' }}>
            <div className="hidden sm:flex flex-1" />
            <h2 className="text-imperial-gold text-base sm:text-xl font-bold uppercase tracking-widest text-center flex-1">{chartTitle}</h2>
            <div className="flex-1 flex justify-end gap-2 w-full sm:w-auto">
                <button onClick={onDownloadChart} className="no-capture border-2 border-imperial-gold text-imperial-gold px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer hover:bg-imperial-gold hover:text-imperial-blue transition-colors flex items-center gap-2 w-full sm:w-auto justify-center" title="Descargar gráfico">
                    <ImageDown size={16} /> Guardar
                </button>
            </div>
        </div>
    );
}

function ChartCanvas({ chartContainerRef, ...props }: ChartRenderProps & { chartContainerRef: React.RefObject<HTMLDivElement | null> }) {
    return (
        <div className="flex-1 flex flex-row relative min-h-[300px] sm:min-h-[500px] overflow-hidden" style={{ outline: 'none' }}>
            {!props.isMobile && props.yAxisLabel && <AxisLabel label={props.yAxisLabel} />}
            <div ref={chartContainerRef} className="relative flex-1 overflow-hidden" style={{ outline: 'none' }} tabIndex={-1}>
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
    const leftDomain = Array.isArray(props.leftAxisDomain) ? props.leftAxisDomain : ['auto', 'auto'];

    return (
        <ComposedChart width={props.chartSize.width} height={props.chartSize.height} data={props.visibleData} margin={{ top: 5, right: props.isMobile ? 5 : 20, bottom: 5, left: props.isMobile ? 5 : 20 }} barCategoryGap="0%" stackOffset="sign" style={{ outline: 'none' }} onClick={(e: ChartClickState | null) => { if (!e?.activePayload?.length || !e.activeTooltipIndex) props.onSelectMonth(null); }}>
            <CartesianGrid stroke="#ffffff20" strokeDasharray="3 3" />
            <XAxis dataKey={props.xAxisKey} stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(value: string | number) => props.labelByXAxisValue.get(String(value)) ?? String(value)} hide={props.isMobile} />
            <YAxis stroke="#FFD700" tick={{ fill: '#FFD700', fontSize: 10 }} tickFormatter={(val) => formatValueByType(val, props.valueFormat, props.yAxisDecimals)} tickCount={10} domain={leftDomain as [number | string, number | string]} allowDataOverflow={false} yAxisId="left" width={props.isMobile ? 0 : 60} hide={props.isMobile} />
            {props.secondaryYAxis && <YAxis orientation="right" stroke={props.secondaryYAxis.color || '#00BFFF'} tick={{ fill: props.secondaryYAxis.color || '#00BFFF', fontSize: 10 }} tickFormatter={(val) => formatValueByType(val, props.secondaryYAxis?.format)} tickCount={10} domain={props.secondaryYAxis?.domain && props.secondaryYAxis.domain !== 'auto' ? props.secondaryYAxis.domain : ['auto', 'auto']} allowDataOverflow={false} yAxisId="right" width={props.isMobile ? 0 : 60} hide={props.isMobile} />}
            {!props.isCapturing && <Tooltip cursor={{ stroke: '#ffffff50', strokeWidth: 1 }} content={(tooltipProps) => <ChartTooltip chartData={props.sortedData} areaConfigs={props.areas} valueFormat={props.valueFormat} tooltipProps={tooltipProps} />} />}
            {props.areas.map(areaConfig => <ChartSeries key={areaConfig.key} areaConfig={areaConfig} props={props} />)}
        </ComposedChart>
    );
}

function ChartSeries({ areaConfig, props }: { areaConfig: AreaConfig; props: ChartRenderProps }) {
    if (props.dimmedAreas.has(areaConfig.legendKey || areaConfig.key)) return null;
    if (areaConfig.type === 'line') return <ChartLine areaConfig={areaConfig} isDimmed={false} />;
    if (areaConfig.type === 'bar') return <ChartBar areaConfig={areaConfig} isDimmed={false} selectedMonth={props.selectedMonth} onSelectMonth={props.onSelectMonth} selectByMonth={props.selectByMonth} />;
    return <ChartArea areaConfig={areaConfig} isDimmed={false} />;
}
