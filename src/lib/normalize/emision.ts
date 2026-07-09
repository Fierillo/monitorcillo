import type { BcraVariableRow, EmisionNormalizedRow, EmisionRawRow } from '@/types';
import { isoToFecha } from './dates';
import { toNullableNumber, toNumber } from './numbers';

export function normalizeEmision(rawData: EmisionRawRow[], tcData: BcraVariableRow[] = []): EmisionNormalizedRow[] {
    const tcByFecha = new Map(tcData.map((row) => [row.fecha, row.valor]));
    const byFecha = new Map(rawData.map((row) => [row.fecha, row]));
    const merged = Array.from(byFecha.values()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    let runningTotal = 0;

    return merged.map((row) => {
        const tc = toNullableNumber(row.tc ?? tcByFecha.get(row.fecha) ?? null);
        const compraDolares = toNumber(row.compra_dolares ?? row.valor);
        const bcra = toNullableNumber(row.bcra ?? null) ?? (tc == null ? 0 : compraDolares * tc);
        const vencimientos = toNumber(row.vencimientos);
        const licitado = toNumber(row.licitado);
        const licitaciones = vencimientos - licitado;
        const resultadoFiscal = toNumber(row.resultado_fiscal);
        const total = bcra + licitaciones + resultadoFiscal;
        runningTotal += total;

        return {
            fecha: isoToFecha(row.fecha),
            iso_fecha: row.fecha,
            BCRA: bcra,
            BCRA_POS: bcra > 0 ? bcra : null,
            BCRA_NEG: bcra < 0 ? bcra : null,
            TC: tc,
            CompraDolares: compraDolares,
            Vencimientos: vencimientos,
            Licitado: licitado,
            Licitaciones: licitaciones,
            Licitaciones_POS: licitaciones > 0 ? licitaciones : null,
            Licitaciones_NEG: licitaciones < 0 ? licitaciones : null,
            'Resultado fiscal': resultadoFiscal,
            ResultadoFiscal_POS: resultadoFiscal > 0 ? resultadoFiscal : null,
            ResultadoFiscal_NEG: resultadoFiscal < 0 ? resultadoFiscal : null,
            TOTAL: total,
            ACUMULADO: runningTotal,
        };
    });
}
