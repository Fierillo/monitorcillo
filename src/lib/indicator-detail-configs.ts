import type { AreaConfig, ChartDataRow, ChartModeConfig, Indicator, IndicatorCompositeViewProps, MethodologyItem } from '@/types';
import { BALANZA_EXPORT_RUBROS, BALANZA_IMPORT_USOS, BALANZA_SERIES_KEYS, buildAperturaComercial, usdMillionsToPctPbi, withNegativeImports } from './balanza/schema';
import { EMAE_SECTORS } from './emae/schema';
import { RECAUDACION_BREAKDOWN_TYPES } from './recaudacion/schema';
import { ICG_PRESIDENTIAL_MANDATES, PRESIDENTIAL_MANDATES } from './presidential-mandates';
import { safeGetIndicatorData } from './storage';
import { getRawData } from './db';
import { CABA_RENT_SERIES, calculateRentSalaryBurden } from './purchasing-power-cost';
import { RIGI_INVESTMENT_CHART_DATA, RIGI_INVESTMENTS } from './investments-source';

type DetailConfig = Omit<IndicatorCompositeViewProps, 'title' | 'subtitle'> & { subtitle?: string };

export async function getIndicatorDetailConfig(indicator: Indicator): Promise<DetailConfig | null> {
    if (indicator.id === 'bma') return bmaConfig(indicator);
    if (indicator.id === 'depositos-prestamos') return depositosPrestamosConfig(indicator);
    if (indicator.id === 'poder-adquisitivo') return poderConfig(indicator);
    if (indicator.id === 'emae') return emaeConfig(indicator);
    if (indicator.id === 'emision') return emisionConfig(indicator);
    if (indicator.id === 'recaudacion') return recaudacionConfig(indicator);
    if (indicator.id === 'inversiones') return investmentsConfig(indicator);
    if (indicator.id === 'deuda') return deudaConfig(indicator);
    if (indicator.id === 'pobreza') return pobrezaConfig(indicator);
    if (indicator.id === 'inflacion') return inflacionConfig(indicator);
    if (indicator.id === 'icg') return icgConfig(indicator);
    if (indicator.id === 'balanza-comercial') return balanzaConfig(indicator);
    return null;
}

function investmentsConfig(indicator: Indicator): DetailConfig {
    const areas: AreaConfig[] = [
        { key: 'aprobadas', name: 'Aprobadas acumuladas', color: '#FFD700', type: 'bar', stackId: 'inversiones', maxBarSize: 54 },
        { key: 'en_evaluacion', name: 'En evaluación', color: '#00BFFF', type: 'bar', stackId: 'inversiones', maxBarSize: 54 },
        { key: 'anunciadas', name: 'Otras anunciadas', color: '#A855F7', type: 'bar', stackId: 'inversiones', maxBarSize: 54 },
        { key: 'confirmadas', name: 'Otras confirmadas', color: '#22C55E', type: 'bar', stackId: 'inversiones', maxBarSize: 54 },
    ];
    const methodology = [
        { title: 'Lectura', description: 'Cada barra mensual apila la inversión aprobada acumulada y la inversión en evaluación. Si durante un mes no se publica ninguna novedad, se repite el valor del mes anterior.' },
        { title: 'Aprobadas', description: `El tramo amarillo acumula los proyectos en el mes de sanción de cada resolución. Al 31 de julio de 2026 comprende ${RIGI_INVESTMENTS.approved.projects} proyectos por USD 46.708 millones.` },
        { title: 'En evaluación', description: `El tramo celeste se actualiza cuando existe una nueva cifra publicada y se mantiene sin cambios hasta la siguiente. El último dato registra ${RIGI_INVESTMENTS.underEvaluation.projects} proyectos por USD 101.241 millones.` },
        { title: 'Fechas sin resolución enlazada', description: 'PSJ Cobre Mendocino y Sal de Oro II se asignan a junio y julio de 2026, respectivamente, por ser su primera aparición comprobable en los totales oficiales.' },
        { title: 'Variación', description: 'La diferencia entre barras muestra el cambio neto conocido: puede incluir nuevas presentaciones, aprobaciones, rechazos, retiros y revisiones de montos.' },
        { title: 'Otras anunciadas', description: 'Proyectos fuera del RIGI con empresa, ubicación, monto y anuncio formal publicados. Se excluyen rumores, memorandos de entendimiento, planes generales y proyectos sin monto atribuible.' },
        { title: 'Otras confirmadas', description: 'Proyectos fuera del RIGI que alcanzaron financiamiento cerrado, contrato vinculante, adjudicación formal o inicio documentado de construcción. Al confirmarse, el monto pasa desde anunciadas sin duplicarse.' },
        { title: 'Cobertura no RIGI', description: 'Cobertura conservadora desde enero de 2017 de energía, minería, industria, agroindustria, logística e infraestructura. Los montos con la expresión “más de” se registran por su mínimo publicado.' },
        { title: 'Comparabilidad', description: 'Las observaciones anteriores a junio de 2026 provienen de Bloomberg Línea e Infobae sobre datos oficiales e inventarios de proyectos. Los montos pueden incorporar revisiones de alcance mientras los expedientes estaban en evaluación.' },
        { title: 'Proyectos compartidos', description: 'Los proyectos informados en más de una provincia se contabilizan una sola vez en el total aprobado.' },
        { title: 'Cobertura', description: 'Montos publicados por el Ministerio de Economía para el Régimen de Incentivo para Grandes Inversiones (RIGI), actualizados al 31 de julio de 2026.' },
    ];

    return {
        subtitle: `Fuente: ${indicator.fuente} | Inversión en millones de USD`,
        chartTitle: 'Evolución mensual de inversiones RIGI por estado',
        data: RIGI_INVESTMENT_CHART_DATA,
        areas,
        methodology,
        valueFormat: 'millions',
        yAxisLabel: 'millones de USD',
        leftYAxisDomain: 'auto',
        showTooltipTotal: true,
        indicatorId: indicator.id,
    };
}

async function bmaConfig(indicator: Indicator): Promise<DetailConfig> {
    const areas: AreaConfig[] = [
        { key: 'BMAmplia', name: 'Base Monetaria AMPLIA', color: '#FFD700', stackId: '2', type: 'monotone' },
        { key: 'BaseMonetaria', name: 'Base Monetaria', color: '#8888cc' },
        { key: 'PasivosRemunerados', name: 'Pasivos Remunerados', color: '#cc4444' },
        { key: 'DepositosTesoro', name: 'Depósitos del Gobierno Nac. y Otros', color: '#44aa66' },
    ];
    const methodology: MethodologyItem[] = [
        { title: 'Base Monetaria', description: 'Promedio mensual de los saldos diarios nominales informados por el BCRA (variable 15).' },
        { title: 'Pasivos Remunerados', description: 'Promedio mensual de la suma de los saldos nominales de Pases (152), LELIQ/NOTALQ (155), LEFI (196) y Otros (198).' },
        { title: 'Depósitos del Gobierno', description: 'Promedio de los saldos nominales de la variable 1264 del BCRA en cuatro cortes mensuales: 7, 15, 23 y fin de mes.' },
        { title: 'Base Monetaria Amplia', description: 'Suma de Base Monetaria, Pasivos Remunerados y Depósitos del Gobierno.' },
        { title: 'Millones de pesos nominales', description: 'Muestra los promedios mensuales en millones de pesos corrientes, sin ajuste por inflación.' },
        { title: 'Porcentaje del PBI real', description: 'Deflacta cada agregado monetario con el IPC núcleo, lo expresa a precios de enero de 2017 y lo divide por el PBI real desestacionalizado de INDEC expresado en la misma base.' },
    ];
    const percentageData = await safeGetIndicatorData('bma');
    const millionsData = percentageData.map(row => ({
        ...row,
        BaseMonetaria: row.BaseMonetariaMillones,
        PasivosRemunerados: row.PasivosRemuneradosMillones,
        DepositosTesoro: row.DepositosTesoroMillones,
        BMAmplia: row.BMAmpliaMillones,
    }));
    const modes: ChartModeConfig[] = [
        { id: 'pbi', label: '% PBI', chartTitle: 'Descomposición de Base Monetaria', data: percentageData, yAxisLabel: '% de PBI real', valueFormat: 'percent', leftYAxisDomain: [0, 'auto'] },
        { id: 'millones', label: '$ millones', chartTitle: 'Descomposición de Base Monetaria', data: millionsData, yAxisLabel: '$ millones nominales', valueFormat: 'millions', leftYAxisDomain: [0, 'auto'] },
    ];
    return { subtitle: `Fuente: BCRA e INDEC | Dato: ${indicator.dato}`, chartTitle: 'Descomposición de Base Monetaria', data: percentageData, areas, methodology, valueFormat: 'percent', yAxisLabel: '% de PBI real', leftYAxisDomain: [0, 'auto'], views: [{ id: 'unidad', label: 'Unidad', chartTitle: 'Descomposición de Base Monetaria', areas, methodology, modes }] };
}

async function depositosPrestamosConfig(indicator: Indicator): Promise<DetailConfig> {
    const data = await safeGetIndicatorData('depositos-prestamos');
    const methodology: MethodologyItem[] = [
        { title: 'Sector privado', description: 'Stocks informados diariamente por el BCRA: depósitos en pesos (100), depósitos en moneda extranjera (108), préstamos en pesos (117) y préstamos en moneda extranjera (125).' },
        { title: 'Sector público', description: 'Stocks informados diariamente por el BCRA: depósitos en pesos (1455), depósitos en moneda extranjera (1493), préstamos en pesos (1313) y préstamos en moneda extranjera (1327).' },
        { title: 'Cierre mensual', description: 'Para cada serie se toma la última observación disponible de cada mes desde enero de 2017.' },
        { title: 'Moneda extranjera', description: 'Los stocks publicados en millones de USD se convierten a pesos con el tipo de cambio de referencia BCRA (variable 4) vigente al cierre mensual.' },
        { title: 'Valores constantes', description: 'Los saldos en pesos se deflactan con el IPC núcleo de INDEC y se expresan en millones de pesos de enero de 2026.' },
        { title: 'Porcentaje del PBI real', description: 'Los saldos constantes se dividen por el PBI real desestacionalizado mensual, estimado con los anclajes trimestrales de PBI y el EMAE de INDEC.' },
    ];
    const areas: AreaConfig[] = [
        { key: 'depositosPrivadosPesos', name: 'Depósitos privados en pesos', color: '#438FC7', type: 'bar', stackId: 'depositos', preliminaryKey: 'preliminary', preliminaryColor: '#9CCBEA', preliminaryLabel: 'Preliminar: mes en curso' },
        { key: 'depositosPublicosPesos', name: 'Depósitos públicos en pesos', color: '#A7C8E3', type: 'bar', stackId: 'depositos', preliminaryKey: 'preliminary', preliminaryColor: '#D6E7F3' },
        { key: 'depositosPrivadosUsd', name: 'Depósitos privados en dólares', color: '#2F7D16', type: 'bar', stackId: 'depositos', preliminaryKey: 'preliminary', preliminaryColor: '#90BD80' },
        { key: 'depositosPublicosUsd', name: 'Depósitos públicos en dólares', color: '#A3BE57', type: 'bar', stackId: 'depositos', preliminaryKey: 'preliminary', preliminaryColor: '#D2DFA9' },
        { key: 'depositosTotales', name: 'Depósitos totales', color: '#C99F00', type: 'line', strokeWidth: 3, showDots: false, tooltipFallbackKey: 'depositosTotalesPreliminary' },
        { key: 'depositosTotalesPreliminary', name: 'Depósitos totales', color: '#FFE66D', type: 'line', strokeWidth: 4, showDots: false, legendKey: 'depositosTotales', hideInLegend: true, hideInTooltip: true, revealStrokeAfterPercent: 50 },
        { key: 'prestamosTotales', name: 'Préstamos totales', color: '#B91C1C', type: 'line', strokeWidth: 3, showDots: false, tooltipFallbackKey: 'prestamosTotalesPreliminary' },
        { key: 'prestamosTotalesPreliminary', name: 'Préstamos totales', color: '#FF8A80', type: 'line', strokeWidth: 4, showDots: false, legendKey: 'prestamosTotales', hideInLegend: true, hideInTooltip: true, revealStrokeAfterPercent: 50 },
        { key: 'prestamosUsd', name: 'Préstamos en dólares', color: '#4D7C0F', type: 'line', strokeWidth: 3, showDots: false, tooltipFallbackKey: 'prestamosUsdPreliminary' },
        { key: 'prestamosUsdPreliminary', name: 'Préstamos en dólares', color: '#D9F99D', type: 'line', strokeWidth: 4, showDots: false, legendKey: 'prestamosUsd', hideInLegend: true, hideInTooltip: true, revealStrokeAfterPercent: 50 },
    ];
    const add = (privateValue: unknown, publicValue: unknown) => {
        if (privateValue == null || publicValue == null) return null;
        return Number(privateValue) + Number(publicValue);
    };
    const currentMonth = new Date().toISOString().slice(0, 7);
    const withPreliminaryLines = (rows: ChartDataRow[]) => rows.map((row, index) => {
        const isPreliminary = row.iso_fecha?.slice(0, 7) === currentMonth;
        const precedesPreliminary = rows[index + 1]?.iso_fecha?.slice(0, 7) === currentMonth;
        const twoMonthsBeforePreliminary = rows[index + 2]?.iso_fecha?.slice(0, 7) === currentMonth;
        const preliminarySegment = isPreliminary || precedesPreliminary || twoMonthsBeforePreliminary;
        return {
            ...row,
            preliminary: isPreliminary,
            depositosTotalesPreliminary: preliminarySegment ? row.depositosTotales : null,
            prestamosTotalesPreliminary: preliminarySegment ? row.prestamosTotales : null,
            prestamosUsdPreliminary: preliminarySegment ? row.prestamosUsd : null,
        };
    });
    const modes: ChartModeConfig[] = [
        {
            id: 'pbi',
            label: '% PBI',
            chartTitle: 'Stock de depósitos y préstamos del sector privado',
            data: withPreliminaryLines(data.map(row => ({
                ...row,
                depositosPrivadosPesos: row.depositosPesosPbi,
                depositosPrivadosUsd: row.depositosUsdPbi,
                depositosPublicosPesos: row.depositosPublicosPesosPbi,
                depositosPublicosUsd: row.depositosPublicosUsdPbi,
                depositosTotales: add(row.depositosTotalPbi, add(row.depositosPublicosPesosPbi, row.depositosPublicosUsdPbi)),
                prestamosTotales: add(
                    add(row.prestamosPesosPbi, row.prestamosPublicosPesosPbi),
                    add(row.prestamosUsdPbi, row.prestamosPublicosUsdPbi),
                ),
                prestamosUsd: add(row.prestamosUsdPbi, row.prestamosPublicosUsdPbi),
            }))),
            yAxisLabel: '% de PBI real',
            valueFormat: 'percent',
            leftYAxisDomain: [0, 'auto'],
        },
        {
            id: 'constantes',
            label: '$ constantes',
            chartTitle: 'Stock de depósitos y préstamos del sector privado',
            data: withPreliminaryLines(data.map(row => ({
                ...row,
                depositosPrivadosPesos: row.depositosPesosConstantes,
                depositosPrivadosUsd: row.depositosUsdConstantes,
                depositosPublicosPesos: row.depositosPublicosPesosConstantes,
                depositosPublicosUsd: row.depositosPublicosUsdConstantes,
                depositosTotales: add(
                    add(row.depositosPesosConstantes, row.depositosUsdConstantes),
                    add(row.depositosPublicosPesosConstantes, row.depositosPublicosUsdConstantes),
                ),
                prestamosTotales: add(
                    add(row.prestamosPesosConstantes, row.prestamosPublicosPesosConstantes),
                    add(row.prestamosUsdConstantes, row.prestamosPublicosUsdConstantes),
                ),
                prestamosUsd: add(row.prestamosUsdConstantes, row.prestamosPublicosUsdConstantes),
            }))),
            yAxisLabel: '$ millones de enero de 2026',
            valueFormat: 'millions',
            leftYAxisDomain: [0, 'auto'],
        },
    ];

    return {
        subtitle: `Fuente: BCRA e INDEC | Dato: ${indicator.dato}`,
        chartTitle: 'Stock de depósitos y préstamos del sector privado',
        data: modes[0].data,
        areas,
        methodology,
        valueFormat: 'percent',
        yAxisLabel: '% de PBI real',
        leftYAxisDomain: [0, 'auto'],
        indicatorId: indicator.id,
        views: [{ id: 'unidad', label: 'Unidad', chartTitle: 'Stock de depósitos y préstamos del sector privado', areas, methodology, modes }],
    };
}

async function poderConfig(indicator: Indicator): Promise<DetailConfig> {
    const [data, rawData] = await Promise.all([
        safeGetIndicatorData('poder-adquisitivo'),
        getRawData('poder'),
    ]);
    const areas: AreaConfig[] = [
        { key: 'blanco', name: 'PA [IS blanco/IPCC]', color: '#FFFFFF', type: 'line', transparentTooltip: true },
        { key: 'negro', name: 'PA [IS negro/IPCC]', color: '#2E2D2C', type: 'line', borderColor: '#FFFFFF', borderWidth: 5, transparentTooltip: true },
        { key: 'privado', name: 'PA [IS privado/IPCC]', color: '#2E64FE', type: 'line', transparentTooltip: true },
        { key: 'publico', name: 'PA [IS publico/IPCC]', color: '#81BEF7', type: 'line', transparentTooltip: true },
        { key: 'ripte', name: 'PA [RIPTE/IPCC]', color: '#31B404', type: 'line', transparentTooltip: true },
        { key: 'jubilacion', name: 'PA [Jubilacion minima/IPCC]', color: '#FF0000', type: 'line', transparentTooltip: true },
    ];
    const methodology: MethodologyItem[] = [
        { title: 'IPC Núcleo', description: 'Índice de Precios al Consumidor (INDEC 148.3_INUCLEONAL_DICI_M_19).' },
        { title: 'Salarios Registrados', description: 'Sector privado (149.1_SOR_PRIADO_OCTU_0_25) y público (149.1_SOR_PUBICO_OCTU_0_14).' },
        { title: 'Salarios No Registrados', description: 'Estimación de salarios informales (INDEC 149.1_SOR_PRIADO_OCTU_0_28), desplazada cinco meses hacia atrás.' },
        { title: 'RIPTE', description: 'Remuneración imponible promedio de trabajadores estables (Secretaría de Trabajo 158.1_REPTE_0_0_5).' },
        { title: 'Jubilaciones', description: 'Haber mínimo mensual (ANSES 58.1_MP_0_M_24).' },
        { title: 'Cálculo', description: '(Valor Nominal / IPC Núcleo) normalizado a Base 100 = Enero 2017.' },
    ];
    const rentData = calculateRentSalaryBurden(rawData);
    const currentRent = CABA_RENT_SERIES.at(-1)!;
    const costAreas: AreaConfig[] = [
        { key: 'alquiler_registrado', name: 'Ajustado por salario registrado', color: '#2E64FE', type: 'line', strokeWidth: 3, connectNulls: true, showValueLabels: true, labelOffsetY: 20, valueFormat: 'currency', transparentTooltip: true },
        { key: 'alquiler_informal', name: 'Ajustado por salario informal', color: '#FF3B30', type: 'line', strokeWidth: 3, connectNulls: true, showValueLabels: true, labelOffsetY: -12, valueFormat: 'currency', transparentTooltip: true },
    ];
    const costMethodology: MethodologyItem[] = [
        { title: 'Lectura', description: 'Cada punto indica cuánto debería valer hoy el alquiler para conservar la carga salarial que representaba en junio de ese año.' },
        { title: 'Alquiler de referencia', description: 'Precio medio mensual de oferta de un departamento de 2 ambientes y 50 m² en CABA. Serie Zonaprop de junio de 2020 a junio de 2026. El valor actual de referencia es $860.106.' },
        { title: 'Cálculo', description: 'Alquiler observado de cada junio × índice salarial actual / índice salarial del mismo mes. Se calcula por separado con los índices de salarios registrados e informales de INDEC.' },
        { title: 'Período actual', description: 'El último índice común de salarios registrados e informales disponible es mayo de 2026. Para el alquiler de junio de 2026 se utiliza ese salario como referencia actual.' },
        { title: 'Alcance', description: 'Zonaprop releva precios publicados para nuevos contratos, no alquileres efectivamente pactados. El informe 2026 explicita 50 m² cubiertos y balcón de 5 m².' },
    ];
    return {
        subtitle: indicator.fuente,
        chartTitle: 'Evolución del Poder Adquisitivo',
        data,
        areas,
        methodology,
        valueFormat: 'index',
        yAxisLabel: 'Base 100 = Ene-17',
        leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'],
        indicatorId: indicator.id,
        views: [
            { id: 'salarios', label: 'SALARIOS', chartTitle: 'Evolución del Poder Adquisitivo', areas, methodology, valueFormat: 'index', yAxisLabel: 'Base 100 = Ene-17', leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'], rebaseable: true, defaultBaseDate: '2017-01-01' },
            {
                id: 'costo-de-vida',
                label: 'COSTO DE VIDA',
                chartTitle: '¿Cuánto debería valer hoy el alquiler para mantener la misma carga salarial?',
                data: rentData,
                areas: costAreas,
                methodology: costMethodology,
                valueFormat: 'currency',
                yAxisLabel: 'Pesos por mes a valores de hoy',
                leftYAxisDomain: 'auto-pad',
                referenceLines: [{ value: currentRent.value, label: 'Alquiler publicado JUN 26', color: '#FFD700', dash: [8, 6] }],
            },
        ],
    };
}

async function emaeConfig(indicator: Indicator): Promise<DetailConfig> {
    const data = await safeGetIndicatorData('emae');
    const sectorData = data.filter(row => typeof row.iso_fecha === 'string' && row.iso_fecha >= '2017-01-01');
    const populationAdjustmentFor = (row: ChartDataRow): number | null => {
        const seasonallyAdjusted = row.emae_desestacionalizado;
        const seasonallyAdjustedPerCapita = row.emae_per_capita;
        return typeof seasonallyAdjusted === 'number'
            && seasonallyAdjusted !== 0
            && typeof seasonallyAdjustedPerCapita === 'number'
            ? seasonallyAdjustedPerCapita / seasonallyAdjusted
            : null;
    };
    const areas: AreaConfig[] = [
        { key: 'emae', name: 'EMAE Original', color: '#FFD700', type: 'line' },
        { key: 'emae_desestacionalizado', name: 'EMAE Desestacionalizado', color: '#00BFFF', type: 'line' },
        { key: 'emae_tendencia', name: 'EMAE Tendencia-Ciclo', color: '#FF6B6B', type: 'line' },
    ];
    const aggregatePerCapitaData: ChartDataRow[] = data.map(row => {
        const seasonallyAdjustedPerCapita = row.emae_per_capita;
        const populationAdjustment = populationAdjustmentFor(row);

        return {
            ...row,
            emae: populationAdjustment != null && typeof row.emae === 'number' ? row.emae * populationAdjustment : null,
            emae_desestacionalizado: seasonallyAdjustedPerCapita,
            emae_tendencia: populationAdjustment != null && typeof row.emae_tendencia === 'number' ? row.emae_tendencia * populationAdjustment : null,
        };
    });
    const methodology = [
        { title: 'EMAE Original', description: 'Evolución de la actividad real sin ajustes (INDEC 143.3_NO_PR_2004_A_21).' },
        { title: 'EMAE Desestacionalizado', description: 'Serie corregida por estacionalidad y calendario (INDEC 143.3_NO_PR_2004_A_31).' },
        { title: 'EMAE Tendencia-Ciclo', description: 'Evolución de largo plazo suavizada (INDEC 143.3_NO_PR_2004_A_28).' },
        { title: 'Normalización', description: 'Índice Base Enero 2017 = 100 para comparabilidad histórica.' },
        { title: 'Per cápita', description: 'En el modo Per cápita, cada serie se divide por la población argentina mensual estimada a partir de los datos anuales del Banco Mundial.' },
    ];
    const sectorAreas: AreaConfig[] = EMAE_SECTORS.map(sector => ({ key: `${sector.key}_mm12`, name: sector.label, color: sector.color, type: 'line', strokeWidth: 2 }));
    const sectorPerCapitaData: ChartDataRow[] = sectorData.map(row => {
        const populationAdjustment = populationAdjustmentFor(row);
        return {
            ...row,
            ...Object.fromEntries(EMAE_SECTORS.map(sector => {
                const key = `${sector.key}_mm12`;
                const value = row[key];
                return [key, populationAdjustment != null && typeof value === 'number' ? value * populationAdjustment : null];
            })),
        };
    });
    const sectorMethodology = [
        { title: 'Series sectoriales', description: 'Índices originales por actividad publicados por INDEC en base 2004=100.' },
        { title: 'Normalización', description: 'Cada sector se expresa como índice Base Enero 2017 = 100.' },
        { title: 'Suavizado MM12 logarítmico', description: 'Se aplica una media móvil geométrica trailing de 12 meses sobre cada índice sectorial original y luego se normaliza cada serie a Base Enero 2017 = 100. Este cálculo reduce la influencia relativa de valores extremos. No son series desestacionalizadas oficiales de INDEC.' },
        { title: 'Per cápita', description: 'En el modo Per cápita, cada MM12 sectorial se ajusta por la población argentina mensual estimada a partir de los datos anuales del Banco Mundial.' },
    ];
    const mandates = PRESIDENTIAL_MANDATES;
    const mandateSeries = mandates.map(mandate => ({
        ...mandate,
        rows: data.filter(row => typeof row.iso_fecha === 'string'
            && row.iso_fecha >= mandate.start
            && (!mandate.end || row.iso_fecha < mandate.end)),
    }));
    const buildMandateData = (metric: 'emae_desestacionalizado' | 'emae_per_capita'): ChartDataRow[] => Array.from(
        { length: Math.max(...mandateSeries.map(mandate => mandate.rows.length)) },
        (_, index) => ({
            fecha: `Mes ${index + 1}`,
            ...Object.fromEntries(mandateSeries.map(mandate => {
                const value = mandate.rows[index]?.[metric];
                const base = mandate.rows.find(row => row.iso_fecha === mandate.start)?.[metric];
                return [mandate.key, typeof value === 'number' && typeof base === 'number' && base !== 0 ? (value / base) * 100 : null];
            })),
        }),
    );
    const mandatePerCapitaData = buildMandateData('emae_per_capita');
    const mandateNormalData = buildMandateData('emae_desestacionalizado');
    const mandateAreas: AreaConfig[] = mandates.map(mandate => ({ key: mandate.key, name: mandate.name, color: mandate.color, secondaryColor: mandate.secondaryColor, type: 'line', strokeWidth: 2, showDots: false }));
    const mandateMethodology = [
        { title: 'Datos desestacionalizados', description: 'Ambos modos utilizan el EMAE desestacionalizado oficial de INDEC. Normal muestra el índice agregado y Per cápita lo divide por la población argentina.' },
        { title: 'Comparación', description: 'Cada mandato se expresa como índice Base 100 en el mes de asunción y se alinea por mes transcurrido desde ese punto.' },
        { title: 'Empalme EMAE', description: 'La serie Base 1993 se enlaza con la Base 2004 en enero de 2004, primer mes común, para preservar la continuidad del índice.' },
        { title: 'Población', description: 'Serie anual SP.POP.TOTL del Banco Mundial. Los meses posteriores al último dato se extrapolan con la última variación disponible.' },
        { title: 'Cobertura', description: 'Sólo se muestran mandatos con cobertura mensual completa. El primer mandato de Carlos Menem se omite porque el EMAE disponible comienza en 1993.' },
    ];
    return {
        subtitle: indicator.fuente,
        chartTitle: 'Evolución del EMAE',
        data,
        areas,
        methodology,
        valueFormat: 'index',
        yAxisLabel: 'Base 100 = Ene-17',
        leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'],
        views: [
            {
                id: 'agregado',
                label: 'Agregado',
                chartTitle: 'Evolución del EMAE',
                areas,
                methodology,
                valueFormat: 'index',
                yAxisLabel: 'EMAE agregado',
                leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'],
                rebaseable: true,
                defaultBaseDate: '2017-01-01',
                modes: [
                    { id: 'normal', label: 'Normal', chartTitle: 'Evolución del EMAE', data, yAxisLabel: 'EMAE agregado' },
                    { id: 'per-capita', label: 'Per cápita', chartTitle: 'Evolución del EMAE per cápita', data: aggregatePerCapitaData, yAxisLabel: 'EMAE agregado' },
                ],
            },
            {
                id: 'sectores',
                label: 'Por sectores',
                chartTitle: 'EMAE por sector (MM12)',
                data: sectorData,
                areas: sectorAreas,
                methodology: sectorMethodology,
                valueFormat: 'index',
                yAxisLabel: 'EMAE por sector',
                leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'],
                rebaseable: true,
                defaultBaseDate: '2017-01-01',
                modes: [
                    { id: 'normal', label: 'Normal', chartTitle: 'EMAE por sector (MM12)', data: sectorData, yAxisLabel: 'EMAE por sector' },
                    { id: 'per-capita', label: 'Per cápita', chartTitle: 'EMAE por sector per cápita (MM12)', data: sectorPerCapitaData, yAxisLabel: 'EMAE por sector' },
                ],
            },
            {
                id: 'mandatos',
                label: 'Por mandatos',
                chartTitle: 'EMAE desestacionalizado por mandato',
                data: mandateNormalData,
                areas: mandateAreas,
                methodology: mandateMethodology,
                valueFormat: 'index',
                yAxisDecimals: 1,
                yAxisLabel: 'EMAE desestacionalizado',
                leftYAxisDomain: 'auto-pad',
                modes: [
                    { id: 'normal', label: 'Normal', chartTitle: 'EMAE desestacionalizado por mandato', data: mandateNormalData, yAxisLabel: 'EMAE desestacionalizado' },
                    { id: 'per-capita', label: 'Per cápita', chartTitle: 'EMAE desestacionalizado per cápita por mandato', data: mandatePerCapitaData, yAxisLabel: 'EMAE desestacionalizado' },
                ],
            },
        ],
    };
}

async function emisionConfig(indicator: Indicator): Promise<DetailConfig> {
    const cached = await safeGetIndicatorData('emision');
    const data = cached
        ? [...cached]
            .sort((a, b) => String(a.iso_fecha ?? '').localeCompare(String(b.iso_fecha ?? '')))
            .map((row) => {
                const hasNoActivity = row.BCRA === 0 && row.CompraDolares === 0 && row.Licitaciones === 0 && row['Resultado fiscal'] === 0 && row.TOTAL === 0;
                return { ...row, TC: row.TC === 0 || hasNoActivity ? null : row.TC, hasNoActivity };
            })
            .filter((row) => !row.hasNoActivity)
        : [];
    const areas: AreaConfig[] = [
        { key: 'ACUMULADO', name: 'TOTAL', color: '#ff0000', type: 'line', transparentTooltip: true },
        { key: 'TC', name: 'TC oficial', color: '#22c55e', type: 'line', yAxisId: 'right', strokeWidth: 2, valueFormat: 'index', transparentTooltip: true },
        { key: 'BCRA_POS', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra', transparentTooltip: true },
        { key: 'Licitaciones_POS', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones', transparentTooltip: true },
        { key: 'ResultadoFiscal_POS', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal', transparentTooltip: true },
        { key: 'BCRA_NEG', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra', hideInLegend: true, transparentTooltip: true },
        { key: 'Licitaciones_NEG', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones', hideInLegend: true, transparentTooltip: true },
        { key: 'ResultadoFiscal_NEG', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal', hideInLegend: true, transparentTooltip: true },
    ];
    const methodology = [
        { title: 'BCRA (Divisas)', description: 'Compra/venta de USD (Var. 78) al Tipo de Cambio de Referencia (Var. 4).' },
        { title: 'Licitaciones', description: 'Impacto neto de Vencimientos vs. montos Licitados/Adjudicados del Tesoro. Valores efectivos.' },
        { title: 'Resultado Fiscal', description: 'Impacto monetario por superávit o déficit primario del Tesoro Nacional.' },
        { title: 'Acumulado', description: 'Stock acumulado de pesos emitidos o absorbidos durante el período visualizado.' },
        { title: 'TC oficial', description: 'Línea verde en eje derecho con el Tipo de Cambio de Referencia del BCRA (Var. 4).' },
    ];
    return {
        subtitle: indicator.fuente,
        chartTitle: 'Emisión / Absorción de Pesos',
        data,
        areas,
        methodology,
        valueFormat: 'millions',
        yAxisLabel: 'millones de pesos',
        secondaryYAxis: { label: 'TC oficial', color: '#22c55e', includeZero: false },
    };
}

async function recaudacionConfig(indicator: Indicator): Promise<DetailConfig> {
    const [recaudacionData, emaeData] = await Promise.all([safeGetIndicatorData('recaudacion'), safeGetIndicatorData('emae')]);
    const emaeDates = new Set(emaeData.map(row => row.iso_fecha));
    const data: ChartDataRow[] = recaudacionData.map(row => ({ ...row, preliminary: typeof row.iso_fecha === 'string' && !emaeDates.has(row.iso_fecha) }));
    const areas: AreaConfig[] = [
        { key: 'pctPbi', name: '% PBI mensual real', color: '#FFD700', type: 'bar', yAxisId: 'left', preliminaryKey: 'preliminary', preliminaryLabel: 'Preliminar: sin EMAE del mes' },
        { key: 'pctPbiMm12', name: '% PBI real MM12', color: '#00BFFF', type: 'line', yAxisId: 'left' },
    ];
    const methodology = [
        { title: 'Recaudación Total', description: 'Recursos tributarios mensuales consolidados. El último dato se toma del informe oficial de Hacienda.' },
        { title: 'Normalización a % PBI real', description: 'La recaudación se expresa a precios de enero de 2017 con IPC núcleo y se divide por el PBI real desestacionalizado de INDEC.' },
        { title: 'Serie MM12', description: 'La línea celeste aplica una media móvil simple de 12 meses al numerador real antes de dividir por el PBI real mensual.' },
        { title: 'Estimación PBI mensual', description: 'El PBI trimestral desestacionalizado se ancla en el mes de publicación y los meses intermedios se estiman con EMAE desestacionalizado.' },
    ];
    const typeAreas: AreaConfig[] = RECAUDACION_BREAKDOWN_TYPES.map(tax => ({
        key: tax.pctKey,
        name: tax.label,
        color: tax.color,
        type: 'bar',
        stackId: 'recaudacion-tipo',
        yAxisId: 'left',
    }));
    const typeMethodology = [
        { title: 'Desagregación', description: 'IVA, Ganancias, aportes personales y contribuciones patronales según la serie de recursos tributarios por tributo de Hacienda (datos.gob.ar). Barras apiladas con el aporte mensual de cada componente al PBI real.' },
        { title: 'Otros', description: 'Residual del total tributario menos IVA, Ganancias, aportes personales y contribuciones patronales (combustibles, derechos de exportación, débitos y créditos, bienes personales, etc.). La suma de las series del desagregado cierra con el total del agregado.' },
        { title: 'Normalización a % PBI real', description: 'Cada componente se expresa a precios de enero de 2017 con IPC núcleo y se divide por el PBI real mensual estimado, igual que la serie agregada.' },
    ];
    return {
        subtitle: indicator.fuente,
        chartTitle: 'Recaudación Mensual (% PBI real)',
        data,
        areas,
        methodology,
        valueFormat: 'percent',
        yAxisDecimals: 1,
        yAxisLabel: '% PBI real',
        leftYAxisDomain: 'auto-pad',
        indicatorId: indicator.id,
        views: [
            { id: 'agregado', label: 'Agregado', chartTitle: 'Recaudación Mensual (% PBI real)', areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: '% PBI real', leftYAxisDomain: 'auto-pad' },
            { id: 'por-tipo', label: 'Por tipo', chartTitle: 'Recaudación por tributo (% PBI real)', areas: typeAreas, methodology: typeMethodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: '% PBI real', leftYAxisDomain: 'auto', showTooltipTotal: true },
        ],
    };
}

async function deudaConfig(indicator: Indicator): Promise<DetailConfig> {
    const data = await safeGetIndicatorData('deuda') ?? null;
const areas: AreaConfig[] = [
        { key: 'toma_deuda', name: 'Toma deuda', color: '#FFD700', type: 'bar', stackId: 'deuda' },
        { key: 'vencimientos', name: 'Vencimientos', color: '#60A5FA', type: 'bar', stackId: 'deuda' },
        { key: 'pagos', name: 'Pagos', color: '#1D4ED8', type: 'bar', stackId: 'deuda' },
        { key: 'deuda_pbi', name: 'Deuda/PBI', color: '#EF4444', type: 'line', yAxisId: 'right', strokeWidth: 2 },
        { key: 'deuda_proyectada', name: 'Deuda/PBI proyectada', color: '#EF4444', type: 'line', yAxisId: 'right', dash: [4, 4], strokeWidth: 1 },
    ];
    const methodology = [
        { title: 'Fuente Nación', description: 'Ministerio de Economía, Secretaría de Finanzas, datos trimestrales de deuda, boletín mensual y colocaciones de deuda.' },
        { title: 'Colocaciones', description: 'Monto mensual tomado por el Tesoro: colocaciones de títulos/letras de MECON más desembolsos de préstamos de organismos internacionales del boletín mensual, incluyendo FMI.' },
        { title: 'Vencimientos', description: 'Calendario de vencimientos de capital e interés (línea punteada = proyectados).' },
        { title: 'Pagos', description: 'Pagos efectivos de capital e interés (barras vacías = sin relleno).' },
        { title: 'Deuda/PBI', description: 'Stock de deuda pública bruta dividido por PBI real.' },
        { title: 'Deuda/PBI proyectada', description: 'Proyección del stock usando flujos (línea punteada).' },
        { title: 'Normalización', description: 'Las colocaciones en pesos y los vencimientos convertidos a pesos se expresan a precios de enero de 2017 con IPC núcleo y se dividen por el PBI real estimado disponible.' },
    ];
    return { subtitle: indicator.fuente, chartTitle: 'Perfil de compromisos de deuda pública', data, areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: 'Flujo mensual (% PBI real)', secondaryYAxis: { label: 'Deuda / PBI real', color: '#FF4D4D', format: 'percent' }, indicatorId: indicator.id };
}

async function pobrezaConfig(indicator: Indicator): Promise<DetailConfig> {
    const areas: AreaConfig[] = [
        { key: 'pobreza_indec', name: 'Pobreza INDEC', color: '#FFD700', type: 'line', strokeWidth: 2.5, connectNulls: true },
        { key: 'pobreza_utdt', name: 'Nowcast UTDT', color: '#FF4D4D', type: 'line', dash: [6, 4], strokeWidth: 2, connectNulls: true, showDots: false },
    ];
    const methodology = [
        { title: 'INDEC', description: 'Serie oficial semestral de población con ingresos debajo de la línea de pobreza, total EPH continua. Línea amarilla sólida; los puntos marcan el mes exacto de publicación.' },
        { title: 'UTDT', description: 'Proyección mensual (nowcast) de pobreza de Martín González-Rozada, Universidad Torcuato Di Tella. Línea roja discontinua obtenida del gráfico interactivo oficial; los reportes PDF y el gráfico estático se usan como respaldo.' },
        { title: 'Frecuencia', description: 'INDEC publica datos semestrales; UTDT publica proyecciones mensuales actualizadas cada mes.' },
    ];
    return { subtitle: indicator.fuente, chartTitle: 'Incidencia de la pobreza', data: await safeGetIndicatorData('pobreza'), areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: '% de población', leftYAxisDomain: 'auto-pad', indicatorId: indicator.id };
}

async function inflacionConfig(indicator: Indicator): Promise<DetailConfig> {
    const areas: AreaConfig[] = [
        { key: 'ipc_indec', name: 'IPC INDEC', color: '#FFD700', type: 'line', strokeWidth: 2, showValueLabels: true, labelOffsetY: -12 },
        { key: 'ipc_nucleo_indec', name: 'IPC Núcleo INDEC', color: '#FFD700', type: 'line', strokeWidth: 2, dash: [6, 3], showValueLabels: true, labelOffsetY: 20, labelLeader: true },
        { key: 'ipc_equilibra', name: 'IPC Equilibra', color: '#FF6B6B', type: 'line', strokeWidth: 2, showValueLabels: true, labelOffsetY: -30, labelLeader: true },
        { key: 'ipc_online', name: 'IPC Online', color: '#22C55E', type: 'line', strokeWidth: 2, showValueLabels: true, labelOffsetY: 34, labelLeader: true },
    ];
    const methodology = [
        { title: 'INDEC', description: 'Índice de Precios al Consumidor Nacional (IPC General y Núcleo) base diciembre 2016=100. La variación mensual se calcula como (índice actual - índice anterior) / índice anterior * 100.' },
        { title: 'Equilibra', description: 'Proyección mensual de inflación de Equilibra.ar basada en relevamientos de precios propios.' },
        { title: 'IPC Online', description: 'Índice de Precios al Consumidor Online de Bahía Blanca (Hyperia Big Data), relevamiento online de precios.' },
        { title: 'Serie principal', description: 'El dato destacado usa INDEC General como principal. Las consultoras se muestran superpuestas para comparabilidad.' },
    ];
    return { subtitle: indicator.fuente, chartTitle: 'Inflación mensual', data: await safeGetIndicatorData('inflacion'), areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: '% mensual', leftYAxisDomain: 'auto-pad', indicatorId: indicator.id };
}

async function icgConfig(indicator: Indicator): Promise<DetailConfig> {
    const mandates = ICG_PRESIDENTIAL_MANDATES;
    const rawData = await safeGetIndicatorData('icg');
    const data: ChartDataRow[] = rawData.map(row => {
        if (typeof row.iso_fecha !== 'string') return row;
        const mandate = mandates.find(item => row.iso_fecha! >= item.start && (!item.end || row.iso_fecha! < item.end));
        if (!mandate) return row;
        const [year, month] = row.iso_fecha.split('-').map(Number);
        const [startYear, startMonth] = mandate.start.split('-').map(Number);
        const comparisonMonth = ((year * 12 + month - (2001 * 12 + 12)) % 48 + 48) % 48 + 1;
        return {
            ...row,
            mandate_key: mandate.key,
            mandate_name: mandate.name,
            mandate_color: mandate.color,
            mandate_secondary_color: mandate.secondaryColor,
            mandate_month: (year - startYear) * 12 + month - startMonth + 1,
            comparison_month: comparisonMonth,
            comparison_term: mandate.key === 'cristina_2' ? 2 : 1,
            comparison_group: `${mandate.key === 'cristina_2' ? 2 : 1}:${comparisonMonth}`,
        };
    });
    const areas: AreaConfig[] = [
        { key: 'icg', name: 'ICG', color: '#FFD700', type: 'line', strokeWidth: 2.5, comparisonMode: 'mandate-month' },
    ];
    const methodology = [
        { title: 'Índice', description: 'El Índice de Confianza en el Gobierno de la Universidad Torcuato Di Tella mide mensualmente la opinión pública sobre la labor del gobierno nacional.' },
        { title: 'Dimensiones', description: 'Combina la evaluación general, la orientación al bien común, la eficiencia del gasto público, la honestidad y la capacidad para resolver problemas.' },
        { title: 'Escala', description: 'El índice varía entre 0 y 5 puntos. Valores más altos indican mayor confianza.' },
        { title: 'Comparación interactiva', description: 'Al señalar un dato se comparan y resaltan las observaciones del mismo mes calendario entre mandatos equivalentes. El segundo mandato consecutivo de Cristina Fernández se considera una continuidad y sólo se compara con otros eventuales segundos mandatos consecutivos.' },
    ];
    const mandateSeries = mandates.map(mandate => ({
        ...mandate,
        rows: data.filter(row => typeof row.iso_fecha === 'string'
            && row.iso_fecha >= mandate.start
            && (!mandate.end || row.iso_fecha < mandate.end)),
    }));
    const mandateData: ChartDataRow[] = Array.from(
        { length: Math.max(...mandateSeries.flatMap(mandate => mandate.rows.map(row => typeof row.mandate_month === 'number' ? row.mandate_month : 0))) },
        (_, index) => ({
            fecha: `Mes ${index + 1}`,
            ...Object.fromEntries(mandateSeries.map(mandate => [mandate.key, mandate.rows.find(row => row.mandate_month === index + 1)?.icg ?? null])),
        }),
    );
    const mandateAreas: AreaConfig[] = mandates.map(mandate => ({
        key: mandate.key,
        name: mandate.name,
        color: mandate.color,
        secondaryColor: mandate.secondaryColor,
        type: 'line',
        strokeWidth: 2,
        showDots: false,
        valueDecimals: 2,
        transparentTooltip: true,
    }));
    const mandateMethodology = [
        ...methodology,
        { title: 'Comparación por mandato', description: 'Cada presidencia conserva el valor original del ICG y se alinea por mes transcurrido desde la asunción. La cobertura comienza en noviembre de 2001, por lo que Fernando de la Rúa sólo cuenta con sus últimos dos meses.' },
    ];

    return {
        subtitle: indicator.fuente,
        chartTitle: 'Índice de Confianza en el Gobierno',
        data,
        areas,
        methodology,
        valueFormat: 'index',
        yAxisDecimals: 2,
        yAxisLabel: 'Puntos (0-5)',
        leftYAxisDomain: 'auto-pad',
        indicatorId: indicator.id,
        views: [
            { id: 'general', label: 'GENERAL', chartTitle: 'Índice de Confianza en el Gobierno', areas, methodology, valueFormat: 'index', yAxisDecimals: 2, yAxisLabel: 'Puntos (0-5)', leftYAxisDomain: 'auto-pad' },
            { id: 'mandatos', label: 'POR MANDATO', chartTitle: 'Confianza en el Gobierno por mandato', data: mandateData, areas: mandateAreas, methodology: mandateMethodology, valueFormat: 'index', yAxisDecimals: 2, yAxisLabel: 'Puntos (0-5)', leftYAxisDomain: 'auto-pad' },
        ],
    };
}

async function balanzaConfig(indicator: Indicator): Promise<DetailConfig> {
    const data = (await safeGetIndicatorData('balanza-comercial')).map(row => withNegativeImports(row));
    const pbiData = data.map(row => ({
        ...row,
        ...Object.fromEntries(BALANZA_SERIES_KEYS.map(key => [key, usdMillionsToPctPbi(row[key], row.pbi_usd)])),
    }));
    const areas: AreaConfig[] = [
        { key: 'exportaciones', name: 'Exportaciones', color: '#22C55E', type: 'bar', stackId: 'balanza' },
        { key: 'importaciones', name: 'Importaciones', color: '#EF4444', type: 'bar', stackId: 'balanza' },
        { key: 'saldo', name: 'Saldo', color: '#FFD700', type: 'line', strokeWidth: 2 },
    ];
    const breakdownAreas: AreaConfig[] = [
        ...BALANZA_EXPORT_RUBROS.map(item => ({ key: item.key, name: item.label, color: item.color, type: 'bar' as const, stackId: 'balanza' })),
        ...BALANZA_IMPORT_USOS.map(item => ({ key: item.key, name: item.label, color: item.color, type: 'bar' as const, stackId: 'balanza' })),
    ];
    const methodology = [
        { title: 'Fuente', description: 'Intercambio Comercial Argentino (ICA) de INDEC, series mensuales en millones de dólares de datos.gob.ar.' },
        { title: 'Exportaciones', description: 'Valor FOB total de las exportaciones de bienes (serie 74.3_IET_0_M_16). Se grafican con signo positivo.' },
        { title: 'Importaciones', description: 'Valor CIF total de las importaciones de bienes (serie 74.3_IIT_0_M_25). Se grafican con signo negativo para apilarlas en la misma columna que las exportaciones.' },
        { title: 'Saldo', description: 'Balanza comercial mensual (serie 74.3_ISC_0_M_19). Si falta el dato oficial se calcula como exportaciones menos importaciones.' },
        { title: 'Porcentaje del PBI', description: 'El dato mensual del ICA se divide por el PBI anual en dólares corrientes. Desde 2004 se usa INDEC (9.2_PDPC_2004_T_30); 1992-2003 se empalma con el PBI en dólares del Banco Mundial.' },
    ];
    const breakdownMethodology = [
        { title: 'Signo', description: 'Los rubros de exportación van hacia arriba y los usos de importación hacia abajo, apilados en la misma columna. La suma de la pila coincide con el saldo comercial.' },
        { title: 'Exportaciones por rubro', description: 'Grandes rubros de INDEC: productos primarios, manufacturas de origen agropecuario (MOA), manufacturas de origen industrial (MOI) y combustibles y energía.' },
        { title: 'Importaciones por uso', description: 'Usos económicos de INDEC: bienes de capital, bienes intermedios, combustibles y lubricantes, piezas y accesorios, bienes de consumo, vehículos automotores de pasajeros y resto.' },
        { title: 'Porcentaje del PBI', description: 'Misma conversión que el agregado: cada rubro mensual sobre el PBI anual en dólares.' },
    ];
    const usdMode = (chartTitle: string): ChartModeConfig => ({ id: 'usd', label: 'USD M', chartTitle, data, yAxisLabel: 'millones de USD', valueFormat: 'millions', leftYAxisDomain: 'auto-pad' });
    const pbiMode = (chartTitle: string): ChartModeConfig => ({ id: 'pbi', label: '% PBI', chartTitle, data: pbiData, yAxisLabel: '% del PBI', valueFormat: 'percent', yAxisDecimals: 1, leftYAxisDomain: 'auto-pad' });
    return {
        subtitle: indicator.fuente,
        chartTitle: 'Balanza comercial',
        data,
        areas,
        methodology,
        valueFormat: 'millions',
        yAxisLabel: 'millones de USD',
        leftYAxisDomain: 'auto-pad',
        indicatorId: indicator.id,
        views: [
            {
                id: 'agregado',
                label: 'Agregado',
                chartTitle: 'Balanza comercial',
                areas,
                methodology,
                valueFormat: 'millions',
                yAxisLabel: 'millones de USD',
                leftYAxisDomain: 'auto-pad',
                referenceLines: [{ value: 0, color: '#64748B', dash: [4, 4] }],
                modes: [usdMode('Balanza comercial'), pbiMode('Balanza comercial')],
            },
            {
                id: 'desagregado',
                label: 'Desagregado',
                chartTitle: 'Balanza comercial por rubro y uso',
                data,
                areas: breakdownAreas,
                methodology: breakdownMethodology,
                valueFormat: 'millions',
                yAxisLabel: 'millones de USD',
                leftYAxisDomain: 'auto-pad',
                showTooltipTotal: true,
                referenceLines: [{ value: 0, color: '#64748B', dash: [4, 4] }],
                modes: [usdMode('Balanza comercial por rubro y uso'), { ...pbiMode('Balanza comercial por rubro y uso'), showTooltipTotal: true }],
            },
            {
                id: 'apertura',
                label: 'Apertura comercial',
                chartTitle: 'Apertura comercial',
                data: buildAperturaComercial(data),
                areas: [
                    { key: 'exportaciones', name: 'Exportaciones', color: '#22C55E', type: 'bar', stackId: 'apertura', preliminaryKey: 'preliminary', preliminaryColor: '#86EFAC', preliminaryLabel: 'Preliminar: año en curso anualizado' },
                    { key: 'importaciones', name: 'Importaciones', color: '#EF4444', type: 'bar', stackId: 'apertura', preliminaryKey: 'preliminary', preliminaryColor: '#FCA5A5' },
                    { key: 'apertura', name: 'Total', color: '#FFD700', type: 'line', strokeWidth: 2, hideInTooltip: true },
                ],
                showTooltipTotal: true,
                methodology: [
                    { title: 'Definición', description: 'Suma anual de exportaciones e importaciones de bienes del ICA, dividida por el PBI anual en dólares corrientes.' },
                    { title: 'Frecuencia', description: 'Serie anual. El último año, si aún no tiene los 12 meses, se anualiza y se marca como preliminar.' },
                ],
                valueFormat: 'percent',
                yAxisDecimals: 1,
                yAxisLabel: '% del PBI',
                leftYAxisDomain: 'auto-pad',
            },
        ],
    };
}
