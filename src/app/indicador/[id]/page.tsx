import { getIndicators } from '@/lib/indicators';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

import IndicatorCompositeView, { AreaConfig, MethodologyItem } from '@/components/IndicatorCompositeView';

import { getCachedIndicator } from '@/lib/storage';

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

    const safeGetIndicatorData = async (id: string) => {
        try {
            return (await getCachedIndicator(id)) ?? [];
        } catch (error) {
            console.error(`[indicator][${id}] failed to load from Neon`, error);
            return [];
        }
    };

    if (indicator.id === 'bma') {
        chartData = await safeGetIndicatorData('bma');

        const areas: AreaConfig[] = [
            { key: 'BMAmplia', name: 'Base Monetaria AMPLIA', color: '#FFD700', stackId: '2', type: 'monotone' },
            { key: 'BaseMonetaria', name: 'Base Monetaria', color: '#8888cc' },
            { key: 'PasivosRemunerados', name: 'Pasivos Remunerados', color: '#cc4444' },
            { key: 'DepositosTesoro', name: 'Depósitos del Gobierno Nac. y Otros', color: '#44aa66' },
        ];

        const methodology: MethodologyItem[] = [
            { title: 'Base Monetaria', description: 'Saldos diarios (Variable 15) consolidados por mes mediante promedio mensual.' },
            { title: 'Pasivos Remunerados', description: 'Integración histórica de Pases Pasivos (152), LELIQ y NOTALQ (155), LEFI (196) y Otros (198). Las series diarias se mensualizan con promedio mensual.' },
            { title: 'Depósitos del Gobierno Nacional y Otros', description: 'Serie semanal extraída del Estado Resumido de Activos y Pasivos Semanales del BCRA (Serieanual.xls). Se mensualiza mediante promedio simple de las observaciones disponibles del mes.' },
            { title: 'Base Monetaria Amplia', description: 'Sumatoria de Base Monetaria + Pasivos Remunerados + Depósitos del Gobierno Nacional y Otros.' },
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

    if (indicator.id === 'poder-adquisitivo') {
        chartData = await safeGetIndicatorData('poder-adquisitivo');

        const areas: AreaConfig[] = [
            { key: 'blanco', name: 'PA [IS blanco/IPCC]', color: '#FFFFFF', type: 'line' },
            { key: 'negro', name: 'PA [IS negro/IPCC]', color: '#000000', type: 'line' },
            { key: 'privado', name: 'PA [IS privado/IPCC]', color: '#2E64FE', type: 'line' },
            { key: 'publico', name: 'PA [IS publico/IPCC]', color: '#81BEF7', type: 'line' },
            { key: 'ripte', name: 'PA [RIPTE/IPCC]', color: '#31B404', type: 'line' },
            { key: 'jubilacion', name: 'PA [Jubilacion minima/IPCC]', color: '#FF0000', type: 'line' },
        ];

        const methodology: MethodologyItem[] = [
            { title: 'Poder Adquisitivo', description: 'Cálculo propio: (Valor Nominal / IPC Núcleo) normalizado a Enero 2017 = 100.' },
            { title: 'Fuentes', description: 'INDEC (IPC, Índice de Salarios), Secretaría de Trabajo (RIPTE) y ANSES (Jubilaciones).' }
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Evolución del Poder Adquisitivo"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="index"
                yAxisLabel="Base 100 = Ene-17"
            />
        );
    }

    if (indicator.id === 'emae') {
        chartData = await safeGetIndicatorData('emae');

        const areas: AreaConfig[] = [
            { key: 'emae', name: 'EMAE Original', color: '#FFD700', type: 'line' },
            { key: 'emae_desestacionalizado', name: 'EMAE Desestacionalizado', color: '#00BFFF', type: 'line' },
            { key: 'emae_tendencia', name: 'EMAE Tendencia-Ciclo', color: '#FF6B6B', type: 'line' },
        ];

        const methodology: MethodologyItem[] = [
            { title: 'EMAE Original', description: 'Estimador Mensual de Actividad Económica elaborado por el INDEC. Mide la evolución de la actividad económica real de manera anticipada al PIB. Serie sin ajustes.' },
            { title: 'EMAE Desestacionalizado', description: 'Serie ajustada por estacionalidad, eliminando efectos predecibles del calendario (días hábiles, estaciones, etc.).' },
            { title: 'EMAE Tendencia-Ciclo', description: 'Componente de largo plazo de la serie, suavizada para eliminar fluctuaciones irregulares y mostrar la tendencia subyacente.' },
            { title: 'Base', description: 'Índice normalizado a Enero 2017 = 100 para comparabilidad con otros indicadores.' },
            { title: 'Frecuencia', description: 'Publicación mensual con aproximadamente 60 días de rezago respecto al mes de referencia.' },
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Evolución del EMAE"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="index"
                yAxisLabel="Base 100 = Ene-17"
            />
        );
    }

    if (indicator.id === 'emision') {
        const cached = await safeGetIndicatorData('emision');
        if (cached) {
            chartData = [...cached].sort((a: any, b: any) => String(a.iso_fecha ?? '').localeCompare(String(b.iso_fecha ?? '')));
        }

        const areas: AreaConfig[] = [
            { key: 'ACUMULADO', name: 'TOTAL', color: '#ff0000', type: 'line' },
            { key: 'BCRA_POS', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'pos', legendKey: 'bcra' },
            { key: 'Licitaciones_POS', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'pos', legendKey: 'licitaciones' },
            { key: 'ResultadoFiscal_POS', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'pos', legendKey: 'resultado_fiscal' },
            { key: 'BCRA_NEG', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'neg', legendKey: 'bcra', hideInLegend: true },
            { key: 'Licitaciones_NEG', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'neg', legendKey: 'licitaciones', hideInLegend: true },
            { key: 'ResultadoFiscal_NEG', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'neg', legendKey: 'resultado_fiscal', hideInLegend: true }
        ];

        const methodology: MethodologyItem[] = [
            { title: 'BCRA (Divisas)', description: 'Impacto por compra/venta de dólares (Variable 78 en Millones u$s) valorizados al Tipo de Cambio de Referencia (Variable 4 - Com. "A" 3500).' },
            { title: 'Licitaciones', description: 'Impacto neto del Tesoro Nacional: Diferencia entre Vencimientos programados y montos Licitados (adjudicados) en el mercado local.' },
            { title: 'Resultado Fiscal', description: 'Impacto monetario directo derivado del superávit o déficit del Tesoro Nacional.' },
            { title: 'Acumulado', description: 'Línea de tendencia que representa el stock acumulado de pesos emitidos o absorbidos durante el período visualizado.' },
            { title: 'Elaboración', description: 'Cálculo propio realizado por @Fierillo en base a datos abiertos del BCRA y el Ministerio de Economía (MECON).' }
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Emisión / Absorción de Pesos"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="billions"
                yAxisLabel="billones de pesos"
            />
        );
    }

    if (indicator.id === 'recaudacion') {
        chartData = await safeGetIndicatorData('recaudacion');

        const areas: AreaConfig[] = [
            { key: 'pctPbi', name: '% PIB Mensual', color: '#FFD700', type: 'bar', yAxisId: 'left' }
        ];

        const methodology: MethodologyItem[] = [
            { title: '% PIB Mensual', description: 'Recaudación / PIB mensual estimado (PIB trim × var EMAE desest.).' },
            { title: 'Tooltip', description: 'Muestra variación vs. mismo mes de años anteriores.' },
            { title: 'Fuente', description: 'Secretaría de Hacienda, Ministerio de Economía.' }
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Recaudación Tributaria (% PIB Mensual)"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="percent"
                yAxisLabel="% PIB"
                leftYAxisDomain="auto-pad"
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
