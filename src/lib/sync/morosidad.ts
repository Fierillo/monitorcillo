import type { DatosGobSeriesRow, DepositosPrestamosRawRow } from '@/types';
import { fetchBankReportMorosidadRaw } from '../bank-report-source';
import { fetchPnfcRaw } from '../pnfc-source';
import { fetchTimeSeries } from './time-series-client';

const HISTORICAL_IDS = ['bcra_1082', 'bcra_1083', 'bcra_1084', 'bcra_1085', 'bcra_1086', 'bcra_1087', 'bcra_1088'];
const CURRENT_IDS = ['332.2_SISTEMA_FIADA__53'];

function finite(value: unknown): number | null {
    const number = Number(value);
    return value == null || !Number.isFinite(number) ? null : number;
}

export function buildMorosidadRawRows(historical: DatosGobSeriesRow[], current: DatosGobSeriesRow[], bankReport: DepositosPrestamosRawRow[] = []): DepositosPrestamosRawRow[] {
    const rows = new Map<string, DepositosPrestamosRawRow>();

    for (const row of historical) {
        const situationValues = row.slice(1).map(finite);
        if (situationValues.some(value => value == null)) continue;
        rows.set(row[0], {
            fecha: row[0],
            mora_irregular_pct: situationValues.slice(0, 5).reduce<number>((sum, value) => sum + Number(value), 0),
            mora_incobrable_pct: situationValues.slice(5).reduce<number>((sum, value) => sum + Number(value), 0),
        });
    }

    for (const row of current) {
        if (row[0] < '2020-10-01') continue;
        const irregularPct = finite(row[1]);
        if (irregularPct == null) continue;
        rows.set(row[0], {
            fecha: row[0],
            mora_irregular_total_pct: irregularPct,
        });
    }
    for (const row of bankReport) {
        const debtorSector: DepositosPrestamosRawRow = { fecha: row.fecha };
        if (row.mora_familias_pct != null) debtorSector.mora_familias_pct = row.mora_familias_pct;
        if (row.mora_empresas_pct != null) debtorSector.mora_empresas_pct = row.mora_empresas_pct;
        if (row.fecha < '2020-10-01') {
            if (row.mora_familias_pct == null && row.mora_empresas_pct == null) continue;
            rows.set(row.fecha, { ...rows.get(row.fecha), ...debtorSector });
            continue;
        }
        rows.set(row.fecha, { ...rows.get(row.fecha), ...debtorSector, mora_irregular_total_pct: row.mora_irregular_total_pct });
    }
    return [...rows.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchMorosidadRaw(): Promise<DepositosPrestamosRawRow[]> {
    const [historical, current, bankReport, pnfc] = await Promise.all([
        fetchTimeSeries({ ids: HISTORICAL_IDS }),
        fetchTimeSeries({ ids: CURRENT_IDS }),
        fetchBankReportMorosidadRaw(),
        fetchPnfcRaw(),
    ]);
    const rows = new Map(buildMorosidadRawRows(historical.data ?? [], current.data ?? [], bankReport).map(row => [row.fecha, row]));
    for (const row of pnfc) rows.set(row.fecha, { ...rows.get(row.fecha), ...row });
    return [...rows.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
