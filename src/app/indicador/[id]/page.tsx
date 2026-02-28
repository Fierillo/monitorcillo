import { getIndicators } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchBcraVariable } from '@/lib/bcra';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

import overrides from '@/data/overrides/bcra.json';

import IndicatorCompositeView, { AreaConfig, MethodologyItem } from '@/components/IndicatorCompositeView';

import { getCachedIndicator, saveIndicatorToCache } from '@/lib/cache';
import { fetchSeries } from '@/lib/datos_gob';

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

    if (indicator.id === 'bma') {
        const cached = await getCachedIndicator('bma');
        if (cached) {
            chartData = cached;
        } else {
            // ... (fetching logic remains the same)
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

            await saveIndicatorToCache('bma', chartData);
        } const areas: AreaConfig[] = [
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

    if (indicator.id === 'poder-adquisitivo') {
        const cached = await getCachedIndicator('poder-adquisitivo');
        if (cached) {
            chartData = cached;
        } else {
            const ids = [
                '148.3_INUCLEONAL_DICI_M_19', // IPC Nucleo
                '149.1_TL_REGIADO_OCTU_0_16', // IS Blanco (Total Registrado)
                '149.1_SOR_PRIADO_OCTU_0_28', // IS Negro (No reg)
                '149.1_SOR_PRIADO_OCTU_0_25', // IS Privado (Priv Reg)
                '149.1_SOR_PUBICO_OCTU_0_14', // IS Publico
                '158.1_REPTE_0_0_5',          // RIPTE
                '58.1_MP_0_M_24'              // Jubilacion
            ].join(',');

            const rawData = await fetchSeries(ids);
            const SPANISH_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
            const SPANISH_MONTHS_LOWER = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

            // Base Jan 2017
            const baseRow = rawData.find((row: any) => row[0] === '2017-01-01');
            if (baseRow) {
                const getBaseVal = (idx: number) => baseRow[idx] / baseRow[1];

                // Pre-calculate all values including negro with 5-month lag
                const rawValues = rawData
                    .filter((row: any) => row[0] && row[0] >= '2017-01-01' && row[1])
                    .map((row: any) => {
                        const dateObj = new Date(row[0] + 'T00:00:00Z');
                        const fechaStr = `${SPANISH_MONTHS[dateObj.getUTCMonth()]} ${dateObj.getUTCFullYear().toString().slice(-2)}`;
                        const ipc = row[1];

                        const calc = (idx: number) => {
                            if (!row[idx]) return null;
                            const currentAdj = row[idx] / ipc;
                            const baseAdj = getBaseVal(idx);
                            return (currentAdj / baseAdj) * 100;
                        };

                        return {
                            fecha: fechaStr,
                            blanco: calc(2),
                            negro: calc(3),
                            privado: calc(4),
                            publico: calc(5),
                            ripte: calc(6),
                            jubilacion: calc(7)
                        };
                    });

                // Apply 5-month lag to negro values (data published early by 5 months)
                chartData = rawValues.map((row: any, index: number) => ({
                    ...row,
                    negro: rawValues[index + 5]?.negro ?? null
                }));
                await saveIndicatorToCache('poder-adquisitivo', chartData);
            }
        }

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
        const cached = await getCachedIndicator('emae');
        if (cached) {
            chartData = cached;
        } else {
            const ids = [
                '143.3_NO_PR_2004_A_21', // EMAE original
                '143.3_NO_PR_2004_A_31', // EMAE desestacionalizado
                '143.3_NO_PR_2004_A_28'  // EMAE tendencia ciclo
            ].join(',');
            const rawData = await fetchSeries(ids);
            const SPANISH_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
            const SPANISH_MONTHS_LOWER = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

            // Base Jan 2017
            const baseRow = rawData.find((row: any) => row[0] === '2017-01-01');
            if (baseRow) {
                const baseOriginal = baseRow[1];
                const baseDesest = baseRow[2];
                const baseTend = baseRow[3];

                chartData = rawData
                    .filter((row: any) => row[0] && row[0] >= '2017-01-01' && row[1])
                    .map((row: any) => {
                        const dateObj = new Date(row[0] + 'T00:00:00Z');
                        const fechaStr = `${SPANISH_MONTHS[dateObj.getUTCMonth()]} ${dateObj.getUTCFullYear().toString().slice(-2)}`;
                        return {
                            fecha: fechaStr,
                            emae: (row[1] / baseOriginal) * 100,
                            emae_desestacionalizado: row[2] ? (row[2] / baseDesest) * 100 : null,
                            emae_tendencia: row[3] ? (row[3] / baseTend) * 100 : null
                        };
                    });

                await saveIndicatorToCache('emae', chartData);
            }
        }

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
        const cached = await getCachedIndicator('emision');
        if (cached) {
            chartData = cached;
        }

        const areas: AreaConfig[] = [
            { key: 'ACUMULADO', name: 'TOTAL', color: '#ff0000', type: 'line' },
            { key: 'Resultado fiscal', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: '1' },
            { key: 'Licitaciones', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: '1' },
            { key: 'BCRA', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: '1' }
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
