import { getIndicators } from '@/lib/indicators';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IndicatorPageProps } from '@/types';
import IndicatorCompositeView from '@/components/IndicatorCompositeView';
import { getIndicatorDetailConfig } from '@/lib/indicator-detail-configs';

export const dynamic = 'force-dynamic';

export default async function IndicatorDetailPage({ params }: IndicatorPageProps) {
    const resolvedParams = await params;
    const data = await getIndicators();
    const indicator = data.find(i => i.id === resolvedParams.id);

    if (!indicator) return notFound();

    if (!indicator.hasDetails) {
        return <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center"><h1 className="text-2xl text-imperial-gold mb-4">No hay detalles disponibles para este indicador.</h1><Link href="/" className="text-imperial-cyan font-bold hover:underline">Volver atrás</Link></div>;
    }

    const config = await getIndicatorDetailConfig(indicator);
    if (!config) return <IndicatorCompositeView title={indicator.indicador} subtitle={`Fuente: ${indicator.fuente} | Dato: ${indicator.dato}`} chartTitle={`Evolución de ${indicator.indicador}`} data={[{ fecha: '2024-01', valor: 0 }]} areas={[{ key: 'valor', name: indicator.indicador, color: '#FFD700', type: 'line' }]} methodology={[{ title: indicator.indicador, description: 'Datos históricos pendientes de integración.' }]} />;

    return <IndicatorCompositeView title={indicator.indicador} subtitle={config.subtitle} chartTitle={config.chartTitle} data={config.data} areas={config.areas} methodology={config.methodology} valueFormat={config.valueFormat} yAxisDecimals={config.yAxisDecimals} yAxisLabel={config.yAxisLabel} secondaryYAxis={config.secondaryYAxis} leftYAxisDomain={config.leftYAxisDomain} indicatorId={config.indicatorId} views={config.views} />;
}
