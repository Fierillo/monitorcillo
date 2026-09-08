import type { Metadata } from 'next';
import { getIndicators } from '@/lib/indicators';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IndicatorPageProps } from '@/types';
import IndicatorCompositeView from '@/components/IndicatorCompositeView';
import { getIndicatorDetailConfig } from '@/lib/indicator-detail-configs';

export const dynamic = 'force-dynamic';

function chartOgImage(id: string, view?: string, mode?: string) {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (mode) params.set('mode', mode);
    const query = params.toString();
    return {
        url: `/api/og/indicador/${id}${query ? `?${query}` : ''}`,
        width: 1200,
        height: 630,
    };
}

export async function generateMetadata({ params, searchParams }: IndicatorPageProps): Promise<Metadata> {
    const { id } = await params;
    const query = searchParams ? await searchParams : {};
    const indicator = (await getIndicators()).find(item => item.id === id);
    const image = chartOgImage(id, query.view, query.mode);
    if (!indicator) return { title: 'Indicador', openGraph: { images: [image] }, twitter: { card: 'summary_large_image', images: [image.url] } };

    return {
        title: indicator.indicador,
        description: `${indicator.dato} · ${indicator.fuente}`,
        openGraph: { images: [image] },
        twitter: { card: 'summary_large_image', images: [image.url] },
    };
}

export default async function IndicatorDetailPage({ params, searchParams }: IndicatorPageProps) {
    const resolvedParams = await params;
    const query = searchParams ? await searchParams : {};
    const data = await getIndicators();
    const indicator = data.find(i => i.id === resolvedParams.id);

    if (!indicator) return notFound();

    if (!indicator.hasDetails) {
        return <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center"><h1 className="text-2xl text-imperial-gold mb-4">No hay detalles disponibles para este indicador.</h1><Link href="/" className="text-imperial-cyan font-bold hover:underline">Volver atrás</Link></div>;
    }

    const config = await getIndicatorDetailConfig(indicator);
    if (!config) return <IndicatorCompositeView title={indicator.indicador} subtitle={`Fuente: ${indicator.fuente} | Dato: ${indicator.dato}`} chartTitle={`Evolución de ${indicator.indicador}`} data={[{ fecha: '2024-01', valor: 0 }]} areas={[{ key: 'valor', name: indicator.indicador, color: '#FFD700', type: 'line' }]} methodology={[{ title: indicator.indicador, description: 'Datos históricos pendientes de integración.' }]} indicatorId={indicator.id} initialViewId={query.view} initialModeId={query.mode} />;

    return <IndicatorCompositeView title={indicator.indicador} subtitle={config.subtitle} chartTitle={config.chartTitle} data={config.data} areas={config.areas} methodology={config.methodology} valueFormat={config.valueFormat} yAxisDecimals={config.yAxisDecimals} yAxisLabel={config.yAxisLabel} secondaryYAxis={config.secondaryYAxis} leftYAxisDomain={config.leftYAxisDomain} showTooltipTotal={config.showTooltipTotal} indicatorId={indicator.id} views={config.views} initialViewId={query.view} initialModeId={query.mode} />;
}
