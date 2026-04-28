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
            { title: 'Base Monetaria', description: 'Promedio mensual de saldos diarios (BCRA Var. 15).' },
            { title: 'Pasivos Remunerados', description: 'Promedio mensual agregado de Pases (152), LELIQ/NOTALQ (155), LEFI (196) y Otros (198).' },
            { title: 'Depósitos del Gobierno', description: 'Promedio de observaciones semanales (BCRA Serieanual.xls).' },
            { title: 'Base Monetaria Amplia', description: 'Suma de Base Monetaria + Pasivos Remunerados + Depósitos del Gobierno.' },
            { title: 'Normalización a % PBI', description: 'Proporción calculada sobre el PBI anualizado estimado. El PBI del mes se infiere ajustando el último PBI trimestral (INDEC 166.2_PPIB_0_0_3) por la variación del EMAE desestacionalizado (143.3_NO_PR_2004_A_31).' },
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={`Fuente: ${indicator.fuente} | Dato: ${indicator.dato}`}
                chartTitle="Descomposición de Base Monetaria"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="percent"
                yAxisLabel="% de PBI"
            />
        );
    }

    if (indicator.id === 'poder-adquisitivo') {
        chartData = await safeGetIndicatorData('poder-adquisitivo');

        const areas: AreaConfig[] = [
            { key: 'blanco', name: 'PA [IS blanco/IPCC]', color: '#FFFFFF', type: 'line' },
            { key: 'negro', name: 'PA [IS negro/IPCC]', color: '#2E2D2C', type: 'line' },
            { key: 'privado', name: 'PA [IS privado/IPCC]', color: '#2E64FE', type: 'line' },
            { key: 'publico', name: 'PA [IS publico/IPCC]', color: '#81BEF7', type: 'line' },
            { key: 'ripte', name: 'PA [RIPTE/IPCC]', color: '#31B404', type: 'line' },
            { key: 'jubilacion', name: 'PA [Jubilacion minima/IPCC]', color: '#FF0000', type: 'line' },
        ];

        const methodology: MethodologyItem[] = [
            { title: 'IPC Núcleo', description: 'Índice de Precios al Consumidor (INDEC 148.3_INUCLEONAL_DICI_M_19).' },
            { title: 'Salarios Registrados', description: 'Sector privado (149.1_SOR_PRIADO_OCTU_0_25) y público (149.1_SOR_PUBICO_OCTU_0_14).' },
            { title: 'Salarios No Registrados', description: 'Estimación de salarios informales (INDEC 149.1_SOR_PRIADO_OCTU_0_28).' },
            { title: 'RIPTE', description: 'Remuneración imponible promedio de trabajadores estables (Secretaría de Trabajo 158.1_REPTE_0_0_5).' },
            { title: 'Jubilaciones', description: 'Haber mínimo mensual (ANSES 58.1_MP_0_M_24).' },
            { title: 'Cálculo', description: '(Valor Nominal / IPC Núcleo) normalizado a Base 100 = Enero 2017.' },
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
                leftYAxisDomain={['dataMin - 5', 'dataMax + 5']}
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
            { title: 'EMAE Original', description: 'Evolución de la actividad real sin ajustes (INDEC 143.3_NO_PR_2004_A_21).' },
            { title: 'EMAE Desestacionalizado', description: 'Serie corregida por estacionalidad y calendario (INDEC 143.3_NO_PR_2004_A_31).' },
            { title: 'EMAE Tendencia-Ciclo', description: 'Evolución de largo plazo suavizada (INDEC 143.3_NO_PR_2004_A_28).' },
            { title: 'Normalización', description: 'Índice Base Enero 2017 = 100 para comparabilidad histórica.' },
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
                leftYAxisDomain={['dataMin - 5', 'dataMax + 5']}
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
            { key: 'BCRA_POS', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra' },
            { key: 'Licitaciones_POS', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones' },
            { key: 'ResultadoFiscal_POS', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal' },
            { key: 'BCRA_NEG', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra', hideInLegend: true },
            { key: 'Licitaciones_NEG', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones', hideInLegend: true },
            { key: 'ResultadoFiscal_NEG', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal', hideInLegend: true }
        ];

        const methodology: MethodologyItem[] = [
            { title: 'BCRA (Divisas)', description: 'Compra/venta de USD (Var. 78) al Tipo de Cambio de Referencia (Var. 4).' },
            { title: 'Licitaciones', description: 'Impacto neto de Vencimientos vs. montos Licitados/Adjudicados del Tesoro. Valores efectivos.' },
            { title: 'Resultado Fiscal', description: 'Impacto monetario por superávit o déficit primario del Tesoro Nacional.' },
            { title: 'Acumulado', description: 'Stock acumulado de pesos emitidos o absorbidos durante el período visualizado.' },
        ];

        return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Emisión / Absorción de Pesos"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="millions"
                yAxisLabel="millones de pesos"
            />
        );
    }

    if (indicator.id === 'recaudacion') {
        chartData = await safeGetIndicatorData('recaudacion');

        const areas: AreaConfig[] = [
            { key: 'pctPbi', name: '% PIB Anual', color: '#FFD700', type: 'bar', yAxisId: 'left' }
        ];

        const methodology: MethodologyItem[] = [
            { title: 'Recaudación Total', description: 'Recursos tributarios mensuales consolidado (Secretaría de Hacienda 172.3_TL_RECAION_M_0_0_17).' },
            { title: 'Normalización a % PBI', description: 'Peso de la recaudación del mes sobre el PBI anualizado proyectado.' },
            { title: 'Estimación PBI', description: 'El PBI se infiere ajustando el dato trimestral (INDEC 166.2_PPIB_0_0_3) por la variación del EMAE desestacionalizado (143.3_NO_PR_2004_A_31).' },
        ];

return (
            <IndicatorCompositeView
                title={indicator.indicador}
                subtitle={indicator.fuente}
                chartTitle="Recaudación Tributaria (% PIB Anualizado)"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="percent"
                yAxisLabel="% PIB"
                leftYAxisDomain="auto-pad"
                indicatorId={indicator.id}
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
