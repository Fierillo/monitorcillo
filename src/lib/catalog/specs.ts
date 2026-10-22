import type { CatalogIndicatorSpec, CatalogNextExpectedEvent, DataRow } from '@/types';
import { joinLabels, rowDate, toFiniteNumber } from './rows';

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

function nextBusinessDay(date: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
    if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
}

function addMonthsFromDate(date: string, months: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().split('T')[0];
}

function addDaysFromDate(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function latestDateWithValue(rows: DataRow[], fields: string[]): string | null {
    let latest: string | null = null;
    for (const row of rows) {
        const date = rowDate(row);
        if (!date) continue;
        const hasValue = fields.some(field => {
            const value = toFiniteNumber(row[field]);
            return value !== null && value !== 0;
        });
        if (hasValue && (!latest || date > latest)) latest = date;
    }
    return latest;
}

function futureMonthly(baseDate: string | null, today: string, label: string, priority = 0, months = 1): CatalogNextExpectedEvent[] {
    if (!baseDate) return [];
    let date = addMonthsFromDate(baseDate, months);
    while (date <= today) date = addMonthsFromDate(date, months);
    return [{ date, label, priority }];
}

function futureDays(baseDate: string | null, today: string, days: number, label: string, priority = 0): CatalogNextExpectedEvent[] {
    if (!baseDate) return [];
    let date = addDaysFromDate(baseDate, days);
    while (date <= today) date = addDaysFromDate(date, days);
    return [{ date, label, priority }];
}

/** Data type behind each raw date field: the single source for the Fecha and Próxima labels. */
const BMA_FIELDS = { base_monetaria: 'Base monetaria', pases: 'Pases', leliq: 'LELIQ', lefi: 'LEFI', otros: 'Otros pasivos', depositos_tesoro: 'Depósitos del Tesoro' };
const DEPOSITOS_FIELDS = { depositos_pesos: 'Depósitos', depositos_usd: 'Depósitos', prestamos_pesos: 'Préstamos', prestamos_usd: 'Préstamos', depositos_publicos_pesos: 'Depósitos', depositos_publicos_usd: 'Depósitos', prestamos_publicos_pesos: 'Préstamos', prestamos_publicos_usd: 'Préstamos' };
const EMISION_FIELDS = { compra_dolares: 'Operaciones BCRA', tc: 'Operaciones BCRA', bcra: 'Operaciones BCRA', vencimientos: 'Licitación del Tesoro', licitado: 'Licitación del Tesoro', resultado_fiscal: 'Resultado fiscal' };
const RECAUDACION_FIELDS = { recaudacion_total: 'Recaudación tributaria' };
const PODER_FIELDS = { salario_registrado: 'Índice de salarios', salario_no_registrado: 'Índice de salarios', salario_privado: 'Índice de salarios', salario_publico: 'Índice de salarios', ripte: 'RIPTE', jubilacion_minima: 'Jubilación mínima' };
const EMAE_FIELDS = { emae: 'EMAE', emae_desestacionalizado: 'EMAE', emae_tendencia: 'EMAE' };
const DEUDA_FIELDS = { stock_deuda_usd: 'Stock de deuda' };
const INFLACION_FIELDS = { ipc_indec_general: 'IPC INDEC', ipc_indec_nucleo: 'IPC INDEC', ipc_equilibra: 'IPC Equilibra', rem: 'REM' };
const ICG_FIELDS = { icg: 'ICG' };
const SIPA_FIELDS = { total: 'Trabajo registrado', privado: 'Trabajo registrado', publico: 'Trabajo registrado', casas_particulares: 'Trabajo registrado', autonomos: 'Trabajo registrado', monotributo: 'Trabajo registrado', monotributo_social: 'Trabajo registrado' };
const BALANZA_FIELDS = { exportaciones: 'Intercambio comercial', importaciones: 'Intercambio comercial', saldo: 'Intercambio comercial' };

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
        rawDateFields: BMA_FIELDS,
        formatValue: formatPbiPercentage,
        getNextExpectedDate: nextBusinessDay,
        getNextExpectedEvents: ({ rawRows, today }) => futureDays(latestDateWithValue(rawRows, ['depositos_tesoro']), today, 7, BMA_FIELDS.depositos_tesoro),
    },
    'depositos-prestamos': {
        type: 'depositos-prestamos',
        referenceLabel: 'Mes anterior',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.prestamosTotalPbi,
        datePrecision: 'month',
        normalizedValueColumn: 'prestamos_total_pbi',
        selectValue: row => row.prestamosTotalPbi,
        rawDateFields: DEPOSITOS_FIELDS,
        formatValue: value => `Préstamos: ${formatPbiPercentage(value)}`,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, today }) => futureMonthly(latestDateWithValue(rawRows, Object.keys(DEPOSITOS_FIELDS)) ?? rawDate, today, joinLabels(Object.values(DEPOSITOS_FIELDS))),
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
        rawDateFields: EMISION_FIELDS,
        formatValue: value => `$${integerFormatter.format(Math.round(value))}M`,
        getNextExpectedDate: nextBusinessDay,
        getNextExpectedEvents: ({ rawRows, today }) => [
            ...futureDays(latestDateWithValue(rawRows, ['licitado', 'vencimientos']), today, 14, EMISION_FIELDS.licitado, 10),
            ...futureMonthly(latestDateWithValue(rawRows, ['resultado_fiscal']), today, EMISION_FIELDS.resultado_fiscal, 5),
        ],
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
        rawDateFields: RECAUDACION_FIELDS,
        formatValue: formatPbiPercentage,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, today }) => futureMonthly(publicationDate ?? latestDateWithValue(rawRows, ['recaudacion_total']) ?? rawDate, today, RECAUDACION_FIELDS.recaudacion_total),
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
        rawDateFields: PODER_FIELDS,
        formatValue: formatPaBlanco,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, today }) => [
            ...futureMonthly(publicationDate ?? latestDateWithValue(rawRows, ['salario_registrado', 'salario_no_registrado', 'salario_privado', 'salario_publico', 'ipc_nucleo']) ?? rawDate, today, PODER_FIELDS.salario_registrado, 10),
            ...futureMonthly(latestDateWithValue(rawRows, ['ripte']), today, PODER_FIELDS.ripte, 8),
            ...futureMonthly(latestDateWithValue(rawRows, ['jubilacion_minima']), today, PODER_FIELDS.jubilacion_minima, 6),
        ],
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
        rawDateFields: EMAE_FIELDS,
        formatValue: formatDecimal,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, today }) => futureMonthly(publicationDate ?? latestDateWithValue(rawRows, Object.keys(EMAE_FIELDS)) ?? rawDate, today, EMAE_FIELDS.emae),
    },
    deuda: {
        type: 'deuda',
        referenceLabel: 'Mismo mes año anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.stock_usd,
        datePrecision: 'month',
        normalizedValueColumn: 'stock_usd',
        selectValue: row => row.stock_usd,
        // Only observed stock drives Fecha: projected maturities run years ahead of the data.
        rawDateFields: DEUDA_FIELDS,
        formatValue: value => `USD ${Math.round(value).toLocaleString('es-AR')} M`,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ sourcePublicationDates, today }) => futureMonthly(sourcePublicationDates?.['deuda-boletin'] ?? null, today, `${DEUDA_FIELDS.stock_deuda_usd} (estimada)`),
    },
    pobreza: {
        type: 'pobreza',
        referenceLabel: 'Mismo semestre año anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addYears(date, -1),
        selectReferenceValue: row => row.pobreza_utdt ?? row.pobreza_indec,
        datePrecision: 'day',
        normalizedValueColumn: 'pobreza_utdt',
        fallbackValueColumns: ['pobreza_indec'],
        selectValue: row => row.pobreza_utdt ?? row.pobreza_indec,
        rawDateFields: {},
        formatValue: formatPercentage,
        getNextExpectedDate: date => addMonthsFromDate(date, 6),
        getNextExpectedEvents: ({ rawRows, rawDate, sourcePublicationDates, today }) => [
            ...futureMonthly(sourcePublicationDates?.['pobreza-utdt'] ?? latestDateWithValue(rawRows, ['pobreza_utdt']) ?? rawDate, today, 'Nowcast UTDT', 10),
            ...futureMonthly(latestDateWithValue(rawRows, ['pobreza_indec']), today, 'Pobreza INDEC', 8, 6),
            ...futureMonthly(sourcePublicationDates?.['pobreza-uca'] ?? latestDateWithValue(rawRows, ['pobreza_uca']), today, 'Pobreza UCA', 6, 12),
        ],
    },
    inflacion: {
        type: 'inflacion',
        referenceLabel: 'Mes anterior',
        betterWhen: 'lower',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.ipc,
        datePrecision: 'day',
        normalizedValueColumn: 'ipc',
        fallbackValueColumns: ['ipc_equilibra', 'rem', 'ipc_indec', 'ipc_nucleo_indec'],
        selectValue: row => row.ipc ?? row.ipc_equilibra ?? row.rem ?? row.ipc_indec,
        rawDateFields: INFLACION_FIELDS,
        formatValue: formatPercentage,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, sourcePublicationDates, today }) => [
            ...futureMonthly(sourcePublicationDates?.['inflacion-indec'] ?? publicationDate ?? latestDateWithValue(rawRows, ['ipc_indec_general', 'ipc_indec_nucleo']) ?? rawDate, today, INFLACION_FIELDS.ipc_indec_general, 10),
            ...futureMonthly(sourcePublicationDates?.['inflacion-equilibra'] ?? latestDateWithValue(rawRows, ['ipc_equilibra']), today, INFLACION_FIELDS.ipc_equilibra, 8),
            ...futureMonthly(sourcePublicationDates?.['inflacion-rem'] ?? latestDateWithValue(rawRows, ['rem']), today, INFLACION_FIELDS.rem, 15),
        ],
    },
    icg: {
        type: 'icg',
        referenceLabel: 'Mes anterior',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.icg,
        datePrecision: 'month',
        normalizedValueColumn: 'icg',
        selectValue: row => row.icg,
        rawDateFields: ICG_FIELDS,
        formatValue: value => `${formatDecimal(value)} puntos`,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ sourcePublicationDates }) => {
            const date = sourcePublicationDates?.['icg-next'];
            return date ? [{ date, label: ICG_FIELDS.icg }] : [];
        },
    },
    sipa: {
        type: 'sipa',
        referenceLabel: 'Mes anterior desest.',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.total,
        datePrecision: 'month',
        normalizedValueColumn: 'total',
        selectValue: row => row.total,
        rawDateFields: SIPA_FIELDS,
        formatValue: value => `${formatDecimal(value / 1000)} millones`,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, today }) => futureMonthly(publicationDate ?? latestDateWithValue(rawRows, ['total']) ?? rawDate, today, SIPA_FIELDS.total),
    },
    'balanza-comercial': {
        type: 'balanza',
        referenceLabel: 'Mes anterior',
        betterWhen: 'higher',
        getReferenceDate: date => addMonths(date, -1),
        selectReferenceValue: row => row.saldo,
        datePrecision: 'month',
        normalizedValueColumn: 'saldo',
        selectValue: row => row.saldo,
        rawDateFields: BALANZA_FIELDS,
        formatValue: value => `USD ${integerFormatter.format(Math.round(value))} M`,
        getNextExpectedDate: date => addMonthsFromDate(date, 1),
        getNextExpectedEvents: ({ rawRows, rawDate, publicationDate, today }) => futureMonthly(publicationDate ?? latestDateWithValue(rawRows, Object.keys(BALANZA_FIELDS)) ?? rawDate, today, BALANZA_FIELDS.exportaciones),
    },
};
