import type { DeudaNormalizedRow, DeudaRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { baseIpcValue, notNull, toBasePrices, toNullableNumber } from './numbers';

function usdToPctPbi(value: number | null, row: DeudaRawRow, baseIpc: number | null): number | null {
    const tc = toNullableNumber(row.tc ?? null);
    const currentPesos = value == null || tc == null ? null : value * tc;
    return pesosToPctPbi(currentPesos, row, baseIpc);
}

function pesosToPctPbi(currentPesos: number | null, row: DeudaRawRow, baseIpc: number | null): number | null {
    const realValue = toBasePrices(currentPesos, toNullableNumber(row.ipc_nucleo ?? null), baseIpc);
    const pbi = toNullableNumber(row.pbi_trimestral ?? null);
    return realValue == null || !pbi ? null : (realValue / pbi) * 100;
}

export function normalizeDeuda(rawData: DeudaRawRow[]): DeudaNormalizedRow[] {
    const baseIpc = baseIpcValue(rawData);
    if (!Array.isArray(rawData) || rawData.length === 0 || !baseIpc) return [];

    let acumulado = 0;
    let projectedDebt: number | null = null;
    const sortedRows = rawData.filter(row => row.fecha && row.fecha >= '2017-01-01').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const lastObservedDebtDate = sortedRows.filter(row => row.stock_deuda_usd != null || row.stock_inicial_usd != null).at(-1)?.fecha ?? null;
    
    const stockPoints = sortedRows
        .filter(row => row.stock_deuda_usd != null || row.stock_inicial_usd != null)
        .map(row => ({ fecha: row.fecha, stock: toNullableNumber(row.stock_deuda_usd ?? row.stock_inicial_usd) }))
        .filter(p => p.stock != null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)) as { fecha: string; stock: number }[];
    
    let currentStockIndex = 0;

    return sortedRows
        .map(row => {
            const month = Number(row.fecha.slice(5, 7));
            const year = Number(row.fecha.slice(2, 4));
            const explicitStock = toNullableNumber(row.stock_deuda_usd ?? row.stock_inicial_usd ?? null);
            
            let interpolatedStock: number | null = null;
            
            if (explicitStock == null && stockPoints.length >= 2) {
                while (currentStockIndex < stockPoints.length - 1 && stockPoints[currentStockIndex + 1].fecha <= row.fecha) {
                    currentStockIndex++;
                }
                const before = stockPoints[currentStockIndex];
                const after = stockPoints[currentStockIndex + 1];
                if (before && after) {
                    const beforeDate = new Date(before.fecha).getTime();
                    const afterDate = new Date(after.fecha).getTime();
                    const currentDate = new Date(row.fecha).getTime();
                    if (afterDate > beforeDate && currentDate >= beforeDate && currentDate <= afterDate) {
                        const ratio = (currentDate - beforeDate) / (afterDate - beforeDate);
                        interpolatedStock = before.stock + (after.stock - before.stock) * ratio;
                    }
                }
            }
            
            const deudaPbi = usdToPctPbi(explicitStock ?? interpolatedStock, row, baseIpc);
            const tomaDeudaPesos = pesosToPctPbi(toNullableNumber(row.toma_deuda ?? null), row, baseIpc);
            const tomaDeudaUsd = usdToPctPbi(toNullableNumber(row.toma_deuda_usd ?? null), row, baseIpc);
            const tomaDeuda = [tomaDeudaPesos, tomaDeudaUsd].filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0) || null;
            const vencimientosRaw = toNullableNumber(row.vencimientos ?? null);
            const vencimientosProyectadosRaw = toNullableNumber(row.vencimientos_proyectados ?? null);
            const vencimientosUnified = (vencimientosRaw != null || vencimientosProyectadosRaw != null)
                ? -(vencimientosRaw ?? 0) - (vencimientosProyectadosRaw ?? 0)
                : null;
            const vencimientos = vencimientosUnified != null 
                ? usdToPctPbi(vencimientosUnified, row, baseIpc) 
                : null;
            const vencimientosProyectados = vencimientosProyectadosRaw != null
                ? usdToPctPbi(-vencimientosProyectadosRaw, row, baseIpc)
                : null;
            const paidDebt = usdToPctPbi(toNullableNumber(row.pagos ?? null), row, baseIpc);
            const pagos = paidDebt == null ? null : -paidDebt;
            const vencimiento = vencimientosProyectados ?? vencimientos;
            const debtReduction = pagos ?? vencimiento;
            const netValues = [tomaDeuda, debtReduction].filter((value): value is number => value != null);
            const total = netValues.length === 0 ? null : netValues.reduce((sum, value) => sum + value, 0);

            if (deudaPbi != null) projectedDebt = deudaPbi;
            const deudaProyectada = deudaPbi == null && lastObservedDebtDate != null && row.fecha > lastObservedDebtDate && projectedDebt != null ? projectedDebt + (total ?? 0) : null;
            if (deudaProyectada != null) projectedDebt = deudaProyectada;
            const chartValues = [deudaPbi, deudaProyectada, tomaDeuda, vencimientos, vencimientosProyectados, pagos].filter((value): value is number => value != null);

            if (chartValues.length === 0) return null;
            acumulado += total ?? 0;

            return {
                fecha: `${MONTHS_ES[month - 1]} ${year}`,
                iso_fecha: row.fecha,
                toma_deuda: tomaDeuda,
                vencimientos,
                vencimientos_proyectados: vencimientosProyectados,
                pagos,
                deuda_pbi: deudaPbi,
                deuda_proyectada: deudaProyectada,
                acumulado,
                total,
            };
        })
        .filter(notNull);
}
