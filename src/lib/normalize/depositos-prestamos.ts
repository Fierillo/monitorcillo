import type { DepositosPrestamosNormalizedRow, DepositosPrestamosRawRow } from '@/types';
import { isoToMonthLabel } from './dates';
import { baseIpcValue, toBasePrices, toNullableNumber } from './numbers';

export function normalizeDepositosPrestamos(rawData: DepositosPrestamosRawRow[]): DepositosPrestamosNormalizedRow[] {
    const pbiBaseIpc = baseIpcValue(rawData);
    const constantValueBaseIpc = toNullableNumber(rawData.find(row => row.fecha === '2026-01-01')?.ipc_nucleo);

    return rawData.flatMap((row) => {
        const tc = toNullableNumber(row.tc);
        const ipc = toNullableNumber(row.ipc_nucleo);
        const pbi = toNullableNumber(row.pbi_trimestral);
        const depositosUsdRaw = toNullableNumber(row.depositos_usd);
        const prestamosUsdRaw = toNullableNumber(row.prestamos_usd);
        const depositosPublicosUsdRaw = toNullableNumber(row.depositos_publicos_usd);
        const prestamosPublicosUsdRaw = toNullableNumber(row.prestamos_publicos_usd);
        const depositosPesosNominales = toNullableNumber(row.depositos_pesos);
        const depositosUsdNominales = tc == null || depositosUsdRaw == null ? null : depositosUsdRaw * tc;
        const prestamosPesosNominales = toNullableNumber(row.prestamos_pesos);
        const prestamosUsdNominales = tc == null || prestamosUsdRaw == null ? null : prestamosUsdRaw * tc;
        const depositosPublicosPesosNominales = toNullableNumber(row.depositos_publicos_pesos);
        const depositosPublicosUsdNominales = tc == null || depositosPublicosUsdRaw == null ? null : depositosPublicosUsdRaw * tc;
        const prestamosPublicosPesosNominales = toNullableNumber(row.prestamos_publicos_pesos);
        const prestamosPublicosUsdNominales = tc == null || prestamosPublicosUsdRaw == null ? null : prestamosPublicosUsdRaw * tc;
        const toPbiBase = (value: number | null) => toBasePrices(value, ipc, pbiBaseIpc);
        const toConstantValues = (value: number | null) => toBasePrices(value, ipc, constantValueBaseIpc);
        const depositosPesos = toPbiBase(depositosPesosNominales);
        const depositosUsd = toPbiBase(depositosUsdNominales);
        const prestamosPesos = toPbiBase(prestamosPesosNominales);
        const prestamosUsd = toPbiBase(prestamosUsdNominales);
        const depositosPublicosPesos = toPbiBase(depositosPublicosPesosNominales);
        const depositosPublicosUsd = toPbiBase(depositosPublicosUsdNominales);
        const prestamosPublicosPesos = toPbiBase(prestamosPublicosPesosNominales);
        const prestamosPublicosUsd = toPbiBase(prestamosPublicosUsdNominales);
        const pctPbi = (value: number | null) => value == null || !pbi ? null : value / pbi * 100;
        const sum = (pesos: number | null, usd: number | null) => pesos == null || usd == null ? null : pesos + usd;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return [];
        return [{
            fecha: isoToMonthLabel(row.fecha),
            iso_fecha: row.fecha,
            depositosPesosPbi: pctPbi(depositosPesos),
            depositosUsdPbi: pctPbi(depositosUsd),
            depositosTotalPbi: pctPbi(sum(depositosPesos, depositosUsd)),
            prestamosPesosPbi: pctPbi(prestamosPesos),
            prestamosUsdPbi: pctPbi(prestamosUsd),
            prestamosTotalPbi: pctPbi(sum(prestamosPesos, prestamosUsd)),
            depositosPesosConstantes: toConstantValues(depositosPesosNominales),
            depositosUsdConstantes: toConstantValues(depositosUsdNominales),
            prestamosPesosConstantes: toConstantValues(prestamosPesosNominales),
            prestamosUsdConstantes: toConstantValues(prestamosUsdNominales),
            depositosPublicosPesosPbi: pctPbi(depositosPublicosPesos),
            depositosPublicosUsdPbi: pctPbi(depositosPublicosUsd),
            prestamosPublicosPesosPbi: pctPbi(prestamosPublicosPesos),
            prestamosPublicosUsdPbi: pctPbi(prestamosPublicosUsd),
            depositosPublicosPesosConstantes: toConstantValues(depositosPublicosPesosNominales),
            depositosPublicosUsdConstantes: toConstantValues(depositosPublicosUsdNominales),
            prestamosPublicosPesosConstantes: toConstantValues(prestamosPublicosPesosNominales),
            prestamosPublicosUsdConstantes: toConstantValues(prestamosPublicosUsdNominales),
        }];
    }).sort((a, b) => a.iso_fecha.localeCompare(b.iso_fecha));
}
