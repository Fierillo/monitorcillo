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
    const subtitle = preview?.chartTitle ?? indicator?.fuente ?? 'Monitor macroeconómico de la Argentina';

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
                    padding: 48,
                    border: '8px solid #FFD700',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
                        <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
                        <div style={{ fontSize: 28, color: '#00BFFF', marginTop: 12 }}>{subtitle}</div>
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
                    {preview?.series.length ? (
                        <svg width={OG_CHART_WIDTH} height={OG_CHART_HEIGHT} viewBox={`0 0 ${OG_CHART_WIDTH} ${OG_CHART_HEIGHT}`}>
                            <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.25} y2={OG_CHART_HEIGHT * 0.25} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
                            <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.5} y2={OG_CHART_HEIGHT * 0.5} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
                            <line x1="0" x2={OG_CHART_WIDTH} y1={OG_CHART_HEIGHT * 0.75} y2={OG_CHART_HEIGHT * 0.75} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
                            {preview.series.map(series => (
                                <path key={series.color} d={series.path} fill="none" stroke={series.color} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
                            ))}
                        </svg>
                    ) : (
                        <div style={{ fontSize: 32, color: '#00BFFF' }}>{indicator?.dato ?? 'Sin gráfico disponible'}</div>
                    )}
                </div>
            </div>
        ),
        { ...OG_IMAGE_SIZE },
    );
}
