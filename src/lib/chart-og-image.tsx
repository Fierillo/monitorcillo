import { ImageResponse } from 'next/og';
import { getIndicatorDetailConfig } from '@/lib/indicator-detail-configs';
import { getIndicators } from '@/lib/indicators';
import { buildOgPreview, OG_CHART_HEIGHT, OG_CHART_WIDTH } from '@/lib/chart-og-preview';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

export async function renderIndicatorOgImage(id: string, selection: { viewId?: string; modeId?: string } = {}) {
    const indicator = (await getIndicators()).find(item => item.id === id);
    const config = indicator?.hasDetails ? await getIndicatorDetailConfig(indicator) : null;
    const preview = config ? buildOgPreview(config, selection) : null;
    const title = indicator?.indicador ?? 'Monitorcillo';
    const subtitle = preview
        ? [preview.chartTitle, preview.modeLabel].filter(Boolean).join(' · ')
        : indicator?.fuente ?? 'Monitor macroeconómico de la Argentina';

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#00143F',
                    color: '#FFD700',
                    padding: 36,
                    border: '8px solid #FFD700',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
                        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
                        <div style={{ fontSize: 22, color: '#00BFFF', marginTop: 8 }}>{subtitle}</div>
                    </div>
                    <div style={{ fontSize: 22, color: '#00BFFF', fontWeight: 700 }}>MONITORCILLO</div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#001036',
                        border: '1px solid rgba(255, 215, 0, 0.35)',
                    }}
                >
                    {preview && (preview.bars.length > 0 || preview.lines.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            <svg width={OG_CHART_WIDTH} height={OG_CHART_HEIGHT} viewBox={`0 0 ${OG_CHART_WIDTH} ${OG_CHART_HEIGHT}`}>
                                <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.25} y2={OG_CHART_HEIGHT * 0.25} stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
                                <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.5} y2={OG_CHART_HEIGHT * 0.5} stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
                                <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.75} y2={OG_CHART_HEIGHT * 0.75} stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
                                {preview.baselineY != null ? <line x1="0" x2={OG_CHART_WIDTH} y1={preview.baselineY} y2={preview.baselineY} stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1" /> : null}
                                {preview.bars.map((bar, index) => (
                                    <rect key={`${bar.color}-${index}`} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} />
                                ))}
                                {preview.lines.map((line, index) => (
                                    <path key={`${line.color}-${index}`} d={line.path} fill="none" stroke={line.color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                                ))}
                            </svg>
                            {preview.legend.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 16, maxWidth: OG_CHART_WIDTH }}>
                                    {preview.legend.map(item => (
                                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFD700', fontSize: 16 }}>
                                            <div style={{ width: 16, height: 8, backgroundColor: item.color }} />
                                            {item.name}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div style={{ fontSize: 32, color: '#00BFFF' }}>{indicator?.dato ?? 'Sin gráfico disponible'}</div>
                    )}
                </div>
            </div>
        ),
        { ...OG_IMAGE_SIZE },
    );
}
