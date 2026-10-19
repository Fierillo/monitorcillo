import type { DbRow, DbValue, IndicatorTrend, IndicatorType, NormalizedDataByType, NormalizedDataRow } from '@/types';
import { BALANZA_IMPORT_KEYS, BALANZA_NORMALIZED_COLUMNS, BALANZA_SERIES_KEYS, toNegativeImport } from '../balanza/schema';
import { EMAE_NORMALIZED_DB_COLUMNS, EMAE_SECTOR_APORTE_KEYS, EMAE_SECTOR_MM12_KEYS } from '../emae/schema';
import { PNFC_SERIES } from '../morosidad/schema';
import { fechaToISO, isoToFecha, isoToMonthLabel } from '../normalize';
import { RECAUDACION_BREAKDOWN_TYPES, RECAUDACION_TAX_MM12_DB_COLUMNS, RECAUDACION_TAX_PCT_DB_COLUMNS } from '../recaudacion/schema';
import { SIPA_NORMALIZED_COLUMNS, SIPA_VALUE_KEYS } from '../sipa-schema';
import { formatDbDate, toNullableNumber, toNumber } from './tables';

export const NORMALIZED_COLUMNS: Record<IndicatorType, string[]> = {
    emision: ['fecha', 'bcra', 'tc', 'compra_dolares', 'vencimientos', 'licitado', 'licitaciones', 'resultado_fiscal', 'total', 'acumulado'],
    emae: [...EMAE_NORMALIZED_DB_COLUMNS],
    bma: ['fecha', 'base_monetaria', 'pasivos_remunerados', 'depositos_tesoro', 'bma_amplia', 'base_monetaria_millones', 'pasivos_remunerados_millones', 'depositos_tesoro_millones', 'bma_amplia_millones'],
    'depositos-prestamos': ['fecha', 'depositos_pesos_pbi', 'depositos_usd_pbi', 'depositos_total_pbi', 'prestamos_pesos_pbi', 'prestamos_usd_pbi', 'prestamos_total_pbi', 'depositos_pesos_constantes', 'depositos_usd_constantes', 'prestamos_pesos_constantes', 'prestamos_usd_constantes', 'depositos_publicos_pesos_pbi', 'depositos_publicos_usd_pbi', 'prestamos_publicos_pesos_pbi', 'prestamos_publicos_usd_pbi', 'depositos_publicos_pesos_constantes', 'depositos_publicos_usd_constantes', 'prestamos_publicos_pesos_constantes', 'prestamos_publicos_usd_constantes', 'mora_irregular_pct', 'mora_incobrable_pct', 'mora_total_irregular_pct', 'mora_familias_pct', 'mora_empresas_pct', ...PNFC_SERIES.map(series => series.dbKey)],
    reca: ['fecha', 'mes', 'year', 'pct_pbi', 'pct_pbi_mm12', ...RECAUDACION_TAX_PCT_DB_COLUMNS, ...RECAUDACION_TAX_MM12_DB_COLUMNS],
    poder: ['fecha', 'blanco', 'negro', 'privado', 'publico', 'ripte', 'jubilacion'],
    deuda: ['fecha', 'toma_deuda', 'vencimientos', 'vencimientos_proyectados', 'pagos', 'deuda_pbi', 'deuda_proyectada', 'acumulado', 'total'],
    pobreza: ['fecha', 'pobreza_indec', 'pobreza_utdt', 'pobreza_uca'],
    inflacion: ['fecha', 'ipc_indec', 'ipc_nucleo_indec', 'ipc_equilibra', 'ipc_online', 'rem', 'ipim', 'ipc'],
    icg: ['fecha', 'icg'],
    balanza: [...BALANZA_NORMALIZED_COLUMNS],
    sipa: [...SIPA_NORMALIZED_COLUMNS],
};

export function toCatalogTrend(value: unknown): IndicatorTrend {
    if (value === 'up' || value === 'down' || value === 'neutral') return value;
    return 'neutral';
}

export function toNormalizedRow<T extends IndicatorType>(type: T, row: DbRow): NormalizedDataByType[T] {
    const iso_fecha = formatDbDate(row.fecha);
    const common = {
        fecha: type === 'emision' ? isoToFecha(iso_fecha) : isoToMonthLabel(iso_fecha),
        iso_fecha,
    };

    if (type === 'emision') {
        const bcra = toNumber(row.bcra);
        const licitaciones = toNumber(row.licitaciones);
        const resultadoFiscal = toNumber(row.resultado_fiscal);
        return {
            ...common,
            BCRA: bcra,
            BCRA_POS: bcra > 0 ? bcra : null,
            BCRA_NEG: bcra < 0 ? bcra : null,
            TC: toNullableNumber(row.tc),
            CompraDolares: toNumber(row.compra_dolares),
            Vencimientos: toNumber(row.vencimientos),
            Licitado: toNumber(row.licitado),
            Licitaciones: licitaciones,
            Licitaciones_POS: licitaciones > 0 ? licitaciones : null,
            Licitaciones_NEG: licitaciones < 0 ? licitaciones : null,
            'Resultado fiscal': resultadoFiscal,
            ResultadoFiscal_POS: resultadoFiscal > 0 ? resultadoFiscal : null,
            ResultadoFiscal_NEG: resultadoFiscal < 0 ? resultadoFiscal : null,
            TOTAL: toNumber(row.total),
            ACUMULADO: toNumber(row.acumulado),
        } as NormalizedDataByType[T];
    }

    if (type === 'emae') {
        const normalized = {
            ...common,
            emae: toNullableNumber(row.emae),
            emae_desestacionalizado: toNullableNumber(row.emae_desestacionalizado),
            emae_tendencia: toNullableNumber(row.emae_tendencia),
            emae_per_capita: toNullableNumber(row.emae_per_capita),
        } as Record<string, unknown>;
        for (const key of EMAE_SECTOR_MM12_KEYS) normalized[key] = toNullableNumber(row[key]);
        for (const key of EMAE_SECTOR_APORTE_KEYS) normalized[key] = toNullableNumber(row[key]);
        return normalized as NormalizedDataByType[T];
    }

    if (type === 'bma') {
        return {
            ...common,
            BaseMonetaria: toNullableNumber(row.base_monetaria),
            PasivosRemunerados: toNullableNumber(row.pasivos_remunerados),
            DepositosTesoro: toNullableNumber(row.depositos_tesoro),
            BMAmplia: toNullableNumber(row.bma_amplia),
            BaseMonetariaMillones: toNullableNumber(row.base_monetaria_millones),
            PasivosRemuneradosMillones: toNullableNumber(row.pasivos_remunerados_millones),
            DepositosTesoroMillones: toNullableNumber(row.depositos_tesoro_millones),
            BMAmpliaMillones: toNullableNumber(row.bma_amplia_millones),
        } as NormalizedDataByType[T];
    }

    if (type === 'depositos-prestamos') {
        const pnfcValues = Object.fromEntries(PNFC_SERIES.map(series => [series.normalizedKey, toNullableNumber(row[series.dbKey])]));
        return {
            ...common,
            depositosPesosPbi: toNullableNumber(row.depositos_pesos_pbi),
            depositosUsdPbi: toNullableNumber(row.depositos_usd_pbi),
            depositosTotalPbi: toNullableNumber(row.depositos_total_pbi),
            prestamosPesosPbi: toNullableNumber(row.prestamos_pesos_pbi),
            prestamosUsdPbi: toNullableNumber(row.prestamos_usd_pbi),
            prestamosTotalPbi: toNullableNumber(row.prestamos_total_pbi),
            depositosPesosConstantes: toNullableNumber(row.depositos_pesos_constantes),
            depositosUsdConstantes: toNullableNumber(row.depositos_usd_constantes),
            prestamosPesosConstantes: toNullableNumber(row.prestamos_pesos_constantes),
            prestamosUsdConstantes: toNullableNumber(row.prestamos_usd_constantes),
            depositosPublicosPesosPbi: toNullableNumber(row.depositos_publicos_pesos_pbi),
            depositosPublicosUsdPbi: toNullableNumber(row.depositos_publicos_usd_pbi),
            prestamosPublicosPesosPbi: toNullableNumber(row.prestamos_publicos_pesos_pbi),
            prestamosPublicosUsdPbi: toNullableNumber(row.prestamos_publicos_usd_pbi),
            depositosPublicosPesosConstantes: toNullableNumber(row.depositos_publicos_pesos_constantes),
            depositosPublicosUsdConstantes: toNullableNumber(row.depositos_publicos_usd_constantes),
            prestamosPublicosPesosConstantes: toNullableNumber(row.prestamos_publicos_pesos_constantes),
            prestamosPublicosUsdConstantes: toNullableNumber(row.prestamos_publicos_usd_constantes),
            moraIrregularPct: toNullableNumber(row.mora_irregular_pct),
            moraIncobrablePct: toNullableNumber(row.mora_incobrable_pct),
            moraTotalIrregularPct: toNullableNumber(row.mora_total_irregular_pct),
            moraFamiliasPct: toNullableNumber(row.mora_familias_pct),
            moraEmpresasPct: toNullableNumber(row.mora_empresas_pct),
            ...pnfcValues,
        } as NormalizedDataByType[T];
    }

    if (type === 'reca') {
        const taxValues = Object.fromEntries(
            RECAUDACION_BREAKDOWN_TYPES.flatMap(tax => [
                [tax.pctKey, toNullableNumber(row[`${tax.rawKey}_pct_pbi`])],
                [tax.mm12Key, toNullableNumber(row[`${tax.rawKey}_pct_pbi_mm12`])],
            ]),
        );

        return {
            ...common,
            mes: String(row.mes ?? ''),
            year: toNumber(row.year),
            pctPbi: toNullableNumber(row.pct_pbi),
            pctPbiMm12: toNullableNumber(row.pct_pbi_mm12),
            ...taxValues,
        } as NormalizedDataByType[T];
    }

    if (type === 'deuda') {
        return {
            ...common,
            toma_deuda: toNullableNumber(row.toma_deuda),
            vencimientos: toNullableNumber(row.vencimientos),
            vencimientos_proyectados: toNullableNumber(row.vencimientos_proyectados),
            pagos: toNullableNumber(row.pagos),
            deuda_pbi: toNullableNumber(row.deuda_pbi),
            deuda_proyectada: toNullableNumber(row.deuda_proyectada),
            acumulado: toNullableNumber(row.acumulado),
            total: toNullableNumber(row.total),
        } as NormalizedDataByType[T];
    }

    if (type === 'pobreza') {
        return {
            ...common,
            pobreza_indec: toNullableNumber(row.pobreza_indec),
            pobreza_utdt: toNullableNumber(row.pobreza_utdt),
            pobreza_uca: toNullableNumber(row.pobreza_uca),
        } as NormalizedDataByType[T];
    }

    if (type === 'inflacion') {
        return {
            ...common,
            ipc_indec: toNullableNumber(row.ipc_indec),
            ipc_nucleo_indec: toNullableNumber(row.ipc_nucleo_indec),
            ipc_equilibra: toNullableNumber(row.ipc_equilibra),
            ipc_online: toNullableNumber(row.ipc_online),
            rem: toNullableNumber(row.rem),
            ipim: toNullableNumber(row.ipim),
            ipc: toNullableNumber(row.ipc),
        } as NormalizedDataByType[T];
    }

    if (type === 'icg') {
        return { ...common, icg: toNullableNumber(row.icg) } as NormalizedDataByType[T];
    }

    if (type === 'balanza') {
        return {
            ...common,
            ...Object.fromEntries(BALANZA_SERIES_KEYS.map(key => [
                key,
                BALANZA_IMPORT_KEYS.includes(key as typeof BALANZA_IMPORT_KEYS[number])
                    ? toNegativeImport(row[key])
                    : toNullableNumber(row[key]),
            ])),
            pbi: toNullableNumber(row.pbi),
            tc: toNullableNumber(row.tc),
            ipc_nucleo: toNullableNumber(row.ipc_nucleo),
            pbi_usd: toNullableNumber(row.pbi_usd),
        } as NormalizedDataByType[T];
    }

    if (type === 'sipa') {
        return {
            ...common,
            ...Object.fromEntries(SIPA_VALUE_KEYS.map(key => [key, toNullableNumber(row[key])])),
            provisional: Boolean(row.provisional),
        } as NormalizedDataByType[T];
    }

    return {
        ...common,
        blanco: toNullableNumber(row.blanco),
        negro: toNullableNumber(row.negro),
        privado: toNullableNumber(row.privado),
        publico: toNullableNumber(row.publico),
        ripte: toNullableNumber(row.ripte),
        jubilacion: toNullableNumber(row.jubilacion),
    } as NormalizedDataByType[T];
}

export function valuesForNormalizedRow(type: IndicatorType, dataRow: NormalizedDataRow): DbValue[] | null {
    const row = dataRow as Record<string, DbValue>;
    const fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(String(row.fecha ?? '')));
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return null;

    if (type === 'emision') return [fecha, toNumber(row.BCRA), toNullableNumber(row.TC), toNumber(row.CompraDolares), toNumber(row.Vencimientos), toNumber(row.Licitado), toNumber(row.Licitaciones), toNumber(row['Resultado fiscal']), toNumber(row.TOTAL), toNumber(row.ACUMULADO)];
    if (type === 'emae') {
        return [
            fecha,
            toNullableNumber(row.emae),
            toNullableNumber(row.emae_desestacionalizado),
            toNullableNumber(row.emae_tendencia),
            toNullableNumber(row.emae_per_capita),
            ...EMAE_SECTOR_MM12_KEYS.map(key => toNullableNumber(row[key])),
            ...EMAE_SECTOR_APORTE_KEYS.map(key => toNullableNumber(row[key])),
        ];
    }
    if (type === 'bma') return [fecha, toNullableNumber(row.BaseMonetaria), toNullableNumber(row.PasivosRemunerados), toNullableNumber(row.DepositosTesoro), toNullableNumber(row.BMAmplia), toNullableNumber(row.BaseMonetariaMillones), toNullableNumber(row.PasivosRemuneradosMillones), toNullableNumber(row.DepositosTesoroMillones), toNullableNumber(row.BMAmpliaMillones)];
    if (type === 'depositos-prestamos') return [fecha, toNullableNumber(row.depositosPesosPbi), toNullableNumber(row.depositosUsdPbi), toNullableNumber(row.depositosTotalPbi), toNullableNumber(row.prestamosPesosPbi), toNullableNumber(row.prestamosUsdPbi), toNullableNumber(row.prestamosTotalPbi), toNullableNumber(row.depositosPesosConstantes), toNullableNumber(row.depositosUsdConstantes), toNullableNumber(row.prestamosPesosConstantes), toNullableNumber(row.prestamosUsdConstantes), toNullableNumber(row.depositosPublicosPesosPbi), toNullableNumber(row.depositosPublicosUsdPbi), toNullableNumber(row.prestamosPublicosPesosPbi), toNullableNumber(row.prestamosPublicosUsdPbi), toNullableNumber(row.depositosPublicosPesosConstantes), toNullableNumber(row.depositosPublicosUsdConstantes), toNullableNumber(row.prestamosPublicosPesosConstantes), toNullableNumber(row.prestamosPublicosUsdConstantes), toNullableNumber(row.moraIrregularPct), toNullableNumber(row.moraIncobrablePct), toNullableNumber(row.moraTotalIrregularPct), toNullableNumber(row.moraFamiliasPct), toNullableNumber(row.moraEmpresasPct), ...PNFC_SERIES.map(series => toNullableNumber(row[series.normalizedKey]))];
    if (type === 'reca') {
        return [
            fecha,
            row.mes,
            toNullableNumber(row.year),
            toNullableNumber(row.pctPbi),
            toNullableNumber(row.pctPbiMm12),
            ...RECAUDACION_BREAKDOWN_TYPES.map(tax => toNullableNumber(row[tax.pctKey])),
            ...RECAUDACION_BREAKDOWN_TYPES.map(tax => toNullableNumber(row[tax.mm12Key])),
        ];
    }
    if (type === 'deuda') return [fecha, toNullableNumber(row.toma_deuda), toNullableNumber(row.vencimientos), toNullableNumber(row.vencimientos_proyectados), toNullableNumber(row.pagos), toNullableNumber(row.deuda_pbi), toNullableNumber(row.deuda_proyectada), toNullableNumber(row.acumulado), toNullableNumber(row.total)];
    if (type === 'pobreza') return [fecha, toNullableNumber(row.pobreza_indec), toNullableNumber(row.pobreza_utdt), toNullableNumber(row.pobreza_uca)];
    if (type === 'inflacion') return [fecha, toNullableNumber(row.ipc_indec), toNullableNumber(row.ipc_nucleo_indec), toNullableNumber(row.ipc_equilibra), toNullableNumber(row.ipc_online), toNullableNumber(row.rem), toNullableNumber(row.ipim), toNullableNumber(row.ipc)];
    if (type === 'icg') return [fecha, toNullableNumber(row.icg)];
    if (type === 'balanza') return [fecha, ...BALANZA_SERIES_KEYS.map(key => toNullableNumber(row[key])), toNullableNumber(row.pbi), toNullableNumber(row.tc), toNullableNumber(row.ipc_nucleo), toNullableNumber(row.pbi_usd)];
    if (type === 'sipa') return [fecha, ...SIPA_VALUE_KEYS.map(key => toNullableNumber(row[key])), Boolean(row.provisional)];
    return [fecha, toNullableNumber(row.blanco), toNullableNumber(row.negro), toNullableNumber(row.privado), toNullableNumber(row.publico), toNullableNumber(row.ripte), toNullableNumber(row.jubilacion)];
}
