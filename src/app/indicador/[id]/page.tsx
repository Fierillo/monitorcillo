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

            // Base Jan 2017
            const baseRow = rawData.find((row: any) => row[0] === '2017-01-01');
            if (baseRow) {
                const getBaseVal = (idx: number) => baseRow[idx] / baseRow[1]; // Value / IPC

                chartData = rawData
                    .filter((row: any) => {
                        return row[0] && row[0] >= '2017-01-01' &&
                            row[1] && row[2] && row[3] &&
                            row[4] && row[5] && row[6] && row[7];
                    })
                    .map((row: any) => {
                        const ipc = row[1];
                        const calc = (idx: number) => {
                            if (!row[idx]) return 0;
                            const currentAdj = row[idx] / ipc;
                            const baseAdj = getBaseVal(idx);
                            return (currentAdj / baseAdj) * 100;
                        };

                        return {
                            fecha: row[0].slice(0, 7),
                            blanco: calc(2),
                            negro: calc(3),
                            privado: calc(4),
                            publico: calc(5),
                            ripte: calc(6),
                            jubilacion: calc(7)
                        };
                    });
                await saveIndicatorToCache('poder-adquisitivo', chartData);
            }
        }

        const areas: AreaConfig[] = [
            { key: 'blanco', name: 'PA [IS blanco/IPCC]', color: '#FFFFFF', type: 'line' },
            { key: 'negro', name: 'PA [IS negro/IPCC]', color: '#444444', type: 'line' },
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
                chartTitle="Evolución del Poder Adquisitivo (Base 100 = Ene-17)"
                data={chartData}
                areas={areas}
                methodology={methodology}
                valueFormat="index"
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
