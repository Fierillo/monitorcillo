import type { AreaConfig, ChartDataRow, Indicator, IndicatorCompositeViewProps, MethodologyItem } from '@/types';
import { safeGetIndicatorData } from './storage';

type DetailConfig = Omit<IndicatorCompositeViewProps, 'title' | 'subtitle'> & { subtitle?: string };

export async function getIndicatorDetailConfig(indicator: Indicator): Promise<DetailConfig | null> {
    if (indicator.id === 'bma') return bmaConfig(indicator);
    if (indicator.id === 'poder-adquisitivo') return poderConfig(indicator);
    if (indicator.id === 'emae') return emaeConfig(indicator);
    if (indicator.id === 'emision') return emisionConfig(indicator);
    if (indicator.id === 'recaudacion') return recaudacionConfig(indicator);
    if (indicator.id === 'deuda') return deudaConfig(indicator);
    return null;
}

async function bmaConfig(indicator: Indicator): Promise<DetailConfig> {
    const areas: AreaConfig[] = [
        { key: 'BMAmplia', name: 'Base Monetaria AMPLIA', color: '#FFD700', stackId: '2', type: 'monotone' },
        { key: 'BaseMonetaria', name: 'Base Monetaria', color: '#8888cc' },
        { key: 'PasivosRemunerados', name: 'Pasivos Remunerados', color: '#cc4444' },
        { key: 'DepositosTesoro', name: 'Depósitos del Gobierno Nac. y Otros', color: '#44aa66' },
    ];
    const methodology: MethodologyItem[] = [
        { title: 'Base Monetaria', description: 'Promedio mensual de saldos diarios nominales del BCRA (Var. 15), expresado a precios de enero de 2017 con IPC núcleo.' },
        { title: 'Pasivos Remunerados', description: 'Promedio mensual agregado nominal de Pases (152), LELIQ/NOTALQ (155), LEFI (196) y Otros (198), expresado a precios de enero de 2017 con IPC núcleo.' },
        { title: 'Depósitos del Gobierno', description: 'Promedio de observaciones semanales nominales (BCRA Serieanual.xls), expresado a precios de enero de 2017 con IPC núcleo.' },
        { title: 'Base Monetaria Amplia', description: 'Suma real de Base Monetaria + Pasivos Remunerados + Depósitos del Gobierno, todo a precios de enero de 2017.' },
        { title: 'Normalización a % PBI real', description: 'Cada agregado monetario real se divide por el PBI real desestacionalizado de INDEC, convertido a pesos de enero de 2017 con el mismo factor IPC.' },
    ];
    return { subtitle: `Fuente: BCRA e INDEC | Dato: ${indicator.dato}`, chartTitle: 'Descomposición de Base Monetaria', data: await safeGetIndicatorData('bma'), areas, methodology, valueFormat: 'percent', yAxisLabel: '% de PBI real' };
}

async function poderConfig(indicator: Indicator): Promise<DetailConfig> {
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
    return { subtitle: indicator.fuente, chartTitle: 'Evolución del Poder Adquisitivo', data: await safeGetIndicatorData('poder-adquisitivo'), areas, methodology, valueFormat: 'index', yAxisLabel: 'Base 100 = Ene-17', leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'] };
}

async function emaeConfig(indicator: Indicator): Promise<DetailConfig> {
    const areas: AreaConfig[] = [
        { key: 'emae', name: 'EMAE Original', color: '#FFD700', type: 'line' },
        { key: 'emae_desestacionalizado', name: 'EMAE Desestacionalizado', color: '#00BFFF', type: 'line' },
        { key: 'emae_tendencia', name: 'EMAE Tendencia-Ciclo', color: '#FF6B6B', type: 'line' },
    ];
    const methodology = [
        { title: 'EMAE Original', description: 'Evolución de la actividad real sin ajustes (INDEC 143.3_NO_PR_2004_A_21).' },
        { title: 'EMAE Desestacionalizado', description: 'Serie corregida por estacionalidad y calendario (INDEC 143.3_NO_PR_2004_A_31).' },
        { title: 'EMAE Tendencia-Ciclo', description: 'Evolución de largo plazo suavizada (INDEC 143.3_NO_PR_2004_A_28).' },
        { title: 'Normalización', description: 'Índice Base Enero 2017 = 100 para comparabilidad histórica.' },
    ];
    return { subtitle: indicator.fuente, chartTitle: 'Evolución del EMAE', data: await safeGetIndicatorData('emae'), areas, methodology, valueFormat: 'index', yAxisLabel: 'Base 100 = Ene-17', leftYAxisDomain: ['dataMin - 5', 'dataMax + 5'] };
}

async function emisionConfig(indicator: Indicator): Promise<DetailConfig> {
    const cached = await safeGetIndicatorData('emision');
    const data = cached ? [...cached].sort((a, b) => String(a.iso_fecha ?? '').localeCompare(String(b.iso_fecha ?? ''))) : [];
    const areas: AreaConfig[] = [
        { key: 'ACUMULADO', name: 'TOTAL', color: '#ff0000', type: 'line' },
        { key: 'BCRA_POS', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra' },
        { key: 'Licitaciones_POS', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones' },
        { key: 'ResultadoFiscal_POS', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal' },
        { key: 'BCRA_NEG', name: 'BCRA', color: '#ffcc33', type: 'bar', stackId: 'stack', legendKey: 'bcra', hideInLegend: true },
        { key: 'Licitaciones_NEG', name: 'Licitaciones', color: '#0055aa', type: 'bar', stackId: 'stack', legendKey: 'licitaciones', hideInLegend: true },
        { key: 'ResultadoFiscal_NEG', name: 'Resultado fiscal', color: '#7952b3', type: 'bar', stackId: 'stack', legendKey: 'resultado_fiscal', hideInLegend: true },
    ];
    const methodology = [
        { title: 'BCRA (Divisas)', description: 'Compra/venta de USD (Var. 78) al Tipo de Cambio de Referencia (Var. 4).' },
        { title: 'Licitaciones', description: 'Impacto neto de Vencimientos vs. montos Licitados/Adjudicados del Tesoro. Valores efectivos.' },
        { title: 'Resultado Fiscal', description: 'Impacto monetario por superávit o déficit primario del Tesoro Nacional.' },
        { title: 'Acumulado', description: 'Stock acumulado de pesos emitidos o absorbidos durante el período visualizado.' },
    ];
    return { subtitle: indicator.fuente, chartTitle: 'Emisión / Absorción de Pesos', data, areas, methodology, valueFormat: 'millions', yAxisLabel: 'millones de pesos' };
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
    return { subtitle: indicator.fuente, chartTitle: 'Recaudación Mensual (% PBI real)', data, areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: '% PBI real', leftYAxisDomain: 'auto-pad', indicatorId: indicator.id };
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
    return { subtitle: indicator.fuente, chartTitle: 'Perfil de compromisos de deuda pública', data, areas, methodology, valueFormat: 'percent', yAxisDecimals: 1, yAxisLabel: 'Flujo mensual (% PBI real)', secondaryYAxis: { label: 'Deuda / PBI real', color: '#FF4D4D', format: 'percent' }, leftYAxisDomain: 'auto-pad', indicatorId: indicator.id };
}
