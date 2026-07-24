import type { DbRow, IndicatorTrend, IndicatorType, NormalizedDataByType } from '@/types';
import { EMAE_SECTOR_APORTE_KEYS, EMAE_SECTOR_MM12_KEYS } from '../emae/schema';
import { isoToFecha, isoToMonthLabel } from '../normalize';
import { RECAUDACION_BREAKDOWN_TYPES } from '../recaudacion/schema';
import { formatDbDate, toNullableNumber, toNumber } from './tables';

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
            emae: toNumber(row.emae),
            emae_desestacionalizado: toNullableNumber(row.emae_desestacionalizado),
            emae_tendencia: toNullableNumber(row.emae_tendencia),
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
        } as NormalizedDataByType[T];
    }

    if (type === 'inflacion') {
        return {
            ...common,
            ipc_indec: toNullableNumber(row.ipc_indec),
            ipc_nucleo_indec: toNullableNumber(row.ipc_nucleo_indec),
            ipc_equilibra: toNullableNumber(row.ipc_equilibra),
            ipc_online: toNullableNumber(row.ipc_online),
            ipc: toNullableNumber(row.ipc),
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
