import type { CatalogIndicatorSpec } from '@/types';

const decimalFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const formatDecimal = (value: number) => decimalFormatter.format(value);
const formatPbiPercentage = (value: number) => `${formatDecimal(value)}% del PBI real`;
const formatPaBlanco = (value: number) => `PA blanco: ${formatDecimal(value)}`;
const formatPercentage = (value: number) => `${formatDecimal(value)}%`;

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().split('T')[0];
}

function addMonths(date: string, months: number): string {
    const [year, month] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().split('T')[0];
}

function addYears(date: string, years: number): string {
    const [year, month] = date.split('-').map(Number);
    return `${year + years}-${String(month).padStart(2, '0')}-01`;
}

export const CATALOG_INDICATOR_SPECS: Record<string, CatalogIndicatorSpec> = {
    bma: {
        type: 'bma',
        referenceLabel: 'Mes anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.BMAmplia,
        datePrecision: 'day',
        normalizedValueColumn: 'bma_amplia',
        selectValue: row => row.BMAmplia,
        rawDateFields: ['base_monetaria', 'pases', 'leliq', 'lefi', 'otros', 'depositos_tesoro'],
        formatValue: formatPbiPercentage,
    },
    emision: {
        type: 'emision',
        referenceLabel: 'Día anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addDays(date, -1),
        selectReferenceValue: row => row.ACUMULADO,
        datePrecision: 'day',
        normalizedValueColumn: 'acumulado',
        selectValue: row => row.ACUMULADO,
        rawDateFields: ['compra_dolares', 'tc', 'bcra', 'vencimientos', 'licitado', 'resultado_fiscal'],
        formatValue: value => `$${integerFormatter.format(Math.round(value))}M`,
    },
    recaudacion: {
        type: 'reca',
        referenceLabel: 'Mismo mes año anterior',
        betterWhen: 'higher',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.pctPbi,
        datePrecision: 'month',
        normalizedValueColumn: 'pct_pbi',
        selectValue: row => row.pctPbi,
        rawDateFields: ['recaudacion_total'],
        formatValue: formatPbiPercentage,
    },
    'poder-adquisitivo': {
        type: 'poder',
        referenceLabel: 'Mes anterior',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.blanco,
        formatReferenceValue: formatPaBlanco,
        datePrecision: 'month',
        normalizedValueColumn: 'blanco',
        selectValue: row => row.blanco,
        rawDateFields: ['salario_registrado', 'salario_no_registrado', 'salario_privado', 'salario_publico', 'ripte', 'jubilacion_minima'],
        formatValue: formatPaBlanco,
    },
    emae: {
        type: 'emae',
        referenceLabel: 'Mes anterior desest.',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.emae_desestacionalizado,
        datePrecision: 'month',
        normalizedValueColumn: 'emae_desestacionalizado',
        selectValue: row => row.emae_desestacionalizado,
        rawDateFields: ['emae', 'emae_desestacionalizado', 'emae_tendencia'],
        formatValue: formatDecimal,
    },
    deuda: {
        type: 'deuda',
        referenceLabel: 'Año anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.total,
        datePrecision: 'month',
        normalizedValueColumn: 'total',
        selectValue: row => row.total,
        rawDateFields: ['stock_inicial_usd', 'stock_deuda_usd', 'toma_deuda', 'toma_deuda_usd', 'vencimientos', 'vencimientos_proyectados', 'pagos'],
        formatValue: formatPbiPercentage,
    },
    pobreza: {
        type: 'pobreza',
        referenceLabel: 'Mismo semestre año anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.pobreza,
        datePrecision: 'month',
        normalizedValueColumn: 'pobreza',
        fallbackValueColumns: ['pobreza_utdt_proyectada', 'pobreza_utdt', 'pobreza_indec'],
        selectValue: row => row.pobreza ?? row.pobreza_utdt_proyectada ?? row.pobreza_utdt ?? row.pobreza_indec,
        rawDateFields: [],
        formatValue: formatPercentage,
    },
    inflacion: {
        type: 'inflacion',
        referenceLabel: 'Mes anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.ipc,
        datePrecision: 'month',
        normalizedValueColumn: 'ipc',
        fallbackValueColumns: ['ipc_equilibra', 'ipc_online', 'ipc_indec', 'ipc_nucleo_indec'],
        selectValue: row => row.ipc ?? row.ipc_equilibra ?? row.ipc_online ?? row.ipc_indec,
        rawDateFields: ['ipc_indec_general', 'ipc_indec_nucleo', 'ipc_equilibra', 'ipc_online'],
        formatValue: formatPercentage,
    },
};
