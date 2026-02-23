import { getIndicators } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchBcraVariable } from '@/lib/bcra';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

import overrides from '@/data/bcra_overrides.json';

import IndicatorCompositeView, { AreaConfig, MethodologyItem } from '@/components/IndicatorCompositeView';

export default async function IndicatorDetailPage({ params }: PageProps) {
    const resolvedParams = await params;
    const data = await getIndicators();
    const indicator = data.find(i => i.id === resolvedParams.id);

    if (!indicator) {
        return notFound();
    }

    if (!indicator.hasDetails) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-2xl text-imperial-gold mb-4">No hay detalles disponibles para este indicador.</h1>
                <Link href="/" className="text-imperial-cyan font-bold hover:underline">Volver atrás</Link>
            </div>
        );
    }

    let chartData: any[] = [];

    if (indicator.id === '15') {
        const today = new Date();
        const past = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
        const toDate = today.toISOString().split('T')[0];
        const fromDate = past.toISOString().split('T')[0];

        const [baseMonetaria, pases, leliq, lefi, depositosTesoro] = await Promise.all([
            fetchBcraVariable(15, fromDate, toDate),
            fetchBcraVariable(152, fromDate, toDate),
            fetchBcraVariable(155, fromDate, toDate),
            fetchBcraVariable(196, fromDate, toDate),
            fetchBcraVariable(210, fromDate, toDate),
        ]);

        const lastByMonth = (items: any[]) => {
            const monthMap: Record<string, number> = {};
            items
                .filter((d: any) => d?.fecha)
                .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
                .forEach((d: any) => { monthMap[d.fecha.slice(0, 7)] = d.valor; });
            return monthMap;
        };

        const bmByMonth = lastByMonth(baseMonetaria);
        const pasesByMonth = lastByMonth(pases);
        const leliqByMonth = lastByMonth(leliq);
        const lefiByMonth = lastByMonth(lefi);
        const tesoroByMonth = lastByMonth(depositosTesoro);

        const fromMonth = fromDate.slice(0, 7);
        const toMonth = toDate.slice(0, 7);

        const allMonths = new Set(
            [
                ...Object.keys(bmByMonth),
                ...Object.keys(pasesByMonth),
                ...Object.keys(leliqByMonth),
                ...Object.keys(lefiByMonth),
                ...Object.keys(tesoroByMonth),
                ...Object.keys(overrides.otros),
                ...Object.keys(overrides.tesoro),
            ].filter(m => m >= fromMonth && m <= toMonth)
        );

        chartData = Array.from(allMonths).sort().map(month => {
            const bm = bmByMonth[month] || 0;
            const otrosAvg = (overrides.otros as any)[month] || 0;
            const pasivosRemOriginal = (pasesByMonth[month] || 0) + (leliqByMonth[month] || 0) + (lefiByMonth[month] || 0);
            const pasivosRemTotal = pasivosRemOriginal + otrosAvg;
            const tesoro = (overrides.tesoro as any)[month] || tesoroByMonth[month] || 0;

            return {
                fecha: month,
                BaseMonetaria: bm,
                PasivosRemunerados: pasivosRemTotal,
                DepositosTesoro: tesoro,
                BMAmplia: bm + pasivosRemTotal + tesoro,
            };
        });

        const areas: AreaConfig[] = [
            { key: 'BMAmplia', name: 'Base Monetaria AMPLIA', color: '#FFD700', stackId: '2', type: 'monotone' },
            { key: 'BaseMonetaria', name: 'Base Monetaria', color: '#8888cc' },
            { key: 'PasivosRemunerados', name: 'Pasivos Remunerados', color: '#cc4444' },
            { key: 'DepositosTesoro', name: 'Depósitos del Tesoro', color: '#44aa66' },
        ];

        const methodology: MethodologyItem[] = [
            { title: 'Base Monetaria', description: 'Saldos diarios (Variable 15) consolidados por mes (último valor disponible).' },
            { title: 'Pasivos Remunerados', description: 'Integración histórica de Pases Pasivos (152), LELIQ (155) y LEFI (196). Para instrumentos vigentes se utiliza el promedio mensual de la serie "Otros" del Informe Monetario Diario.' },
            { title: 'Depósitos del Tesoro', description: 'Saldos extraídos del Balance Semanal del BCRA (Estado Resumido de Activos y Pasivos - Depósitos del Gobierno Nacional y Otros).' },
            { title: 'Base Monetaria Amplia', description: 'Sumatoria de Base Monetaria + Pasivos Remunerados + Depósitos del Tesoro Nacional en el Banco Central.' },
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={`Fuente: ${indicator.fuente} | Dato: ${indicator.dato}`}
                chartTitle="Descomposición de Base Monetaria"
                data={chartData}
                areas={areas}
                methodology={methodology}
            />
        );
    }

    // Fallback for other indicators
    return (
        <IndicatorCompositeView
            title={indicator.indicador}
            subtitle={`Fuente: ${indicator.fuente} | Dato: ${indicator.dato}`}
            chartTitle={`Evolución de ${indicator.indicador}`}
            data={[{ fecha: '2024-01', valor: 0 }]} // Placeholder
            areas={[{ key: 'valor', name: indicator.indicador, color: '#FFD700', type: 'line' }]}
            methodology={[{ title: indicator.indicador, description: 'Datos históricos pendientes de integración.' }]}
        />
    );
}
