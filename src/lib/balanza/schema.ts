export const BALANZA_EXPORT_RUBROS = [
    { key: 'expo_pp', label: 'Productos primarios', color: '#84CC16', seriesId: '74.3_IEPP_0_M_35' },
    { key: 'expo_moa', label: 'MOA', color: '#22C55E', seriesId: '74.3_IEMOA_0_M_48' },
    { key: 'expo_moi', label: 'MOI', color: '#F97316', seriesId: '74.3_IEMOI_0_M_46' },
    { key: 'expo_combustibles', label: 'Combustibles y energía', color: '#FACC15', seriesId: '74.3_IECE_0_M_35' },
] as const;

export const BALANZA_IMPORT_USOS = [
    { key: 'impo_bienes_capital', label: 'Bienes de capital', color: '#00BFFF', seriesId: '74.3_IIBCA_0_M_32' },
    { key: 'impo_bienes_intermedios', label: 'Bienes intermedios', color: '#818CF8', seriesId: '74.3_IIBI_0_M_36' },
    { key: 'impo_combustibles', label: 'Combustibles y lubricantes', color: '#EAB308', seriesId: '74.3_IICL_0_M_42' },
    { key: 'impo_piezas', label: 'Piezas y accesorios', color: '#A855F7', seriesId: '74.3_IIPABC_0_M_50' },
    { key: 'impo_bienes_consumo', label: 'Bienes de consumo', color: '#FB7185', seriesId: '74.3_IIBCO_0_M_32' },
    { key: 'impo_vehiculos', label: 'Vehículos', color: '#38BDF8', seriesId: '74.3_IIVAP_0_M_49' },
    { key: 'impo_resto', label: 'Resto', color: '#9CA3AF', seriesId: '74.3_IIR_0_M_23' },
] as const;

export const BALANZA_AGGREGATE_SERIES = [
    { key: 'exportaciones', label: 'Exportaciones', color: '#22C55E', seriesId: '74.3_IET_0_M_16' },
    { key: 'importaciones', label: 'Importaciones', color: '#EF4444', seriesId: '74.3_IIT_0_M_25' },
    { key: 'saldo', label: 'Saldo', color: '#FFD700', seriesId: '74.3_ISC_0_M_19' },
] as const;

export const BALANZA_BREAKDOWN_SERIES = [...BALANZA_EXPORT_RUBROS, ...BALANZA_IMPORT_USOS] as const;
export const BALANZA_ALL_SERIES = [...BALANZA_AGGREGATE_SERIES, ...BALANZA_BREAKDOWN_SERIES] as const;

export type BalanzaSeriesKey = typeof BALANZA_ALL_SERIES[number]['key'];
export type BalanzaExportKey = typeof BALANZA_EXPORT_RUBROS[number]['key'];
export type BalanzaImportKey = typeof BALANZA_IMPORT_USOS[number]['key'];

export const BALANZA_SERIES_KEYS = BALANZA_ALL_SERIES.map(series => series.key) as BalanzaSeriesKey[];
export const BALANZA_IMPORT_KEYS = ['importaciones', ...BALANZA_IMPORT_USOS.map(item => item.key)] as const;
export const BALANZA_SERIES_IDS = BALANZA_ALL_SERIES.map(series => series.seriesId);
export const PBI_USD_QUARTERLY_SERIES_ID = '9.2_PDPC_2004_T_30';
export const PBI_USD_ANNUAL_SERIES_ID = '9.1_PDPC_2004_A_30';
export const BALANZA_MACRO_KEYS = ['pbi', 'tc', 'ipc_nucleo', 'pbi_usd'] as const;
export const BALANZA_RAW_COLUMNS = [...BALANZA_SERIES_KEYS, 'pbi_trimestral', 'tc', 'ipc_nucleo', 'pbi_usd'] as const;
export const BALANZA_NORMALIZED_COLUMNS = ['fecha', ...BALANZA_SERIES_KEYS, ...BALANZA_MACRO_KEYS] as const;

export function toNegativeImport(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? -Math.abs(numeric) : null;
}

export function withNegativeImports<T extends Record<string, unknown>>(row: T): T {
    return {
        ...row,
        ...Object.fromEntries(BALANZA_IMPORT_KEYS.map(key => [key, toNegativeImport(row[key])])),
    };
}

export function usdMillionsToPctPbi(usd: unknown, pbiUsd: unknown): number | null {
    const value = Number(usd);
    const pbiValue = Number(pbiUsd);
    if (!Number.isFinite(value) || !Number.isFinite(pbiValue) || pbiValue === 0) return null;
    return (value / pbiValue) * 100;
}

export function buildAperturaComercial(rows: Array<Record<string, unknown>>): Array<{ fecha: string; iso_fecha: string; exportaciones: number; importaciones: number; apertura: number; preliminary: boolean }> {
    const byYear = new Map<string, { expo: number; impo: number; months: number; pbi: number | null }>();

    for (const row of rows) {
        const iso = typeof row.iso_fecha === 'string' ? row.iso_fecha : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
        const expo = Number(row.exportaciones);
        const impo = Number(row.importaciones);
        if (!Number.isFinite(expo) || !Number.isFinite(impo)) continue;

        const year = iso.slice(0, 4);
        const bucket = byYear.get(year) ?? { expo: 0, impo: 0, months: 0, pbi: null };
        bucket.expo += expo;
        bucket.impo += Math.abs(impo);
        bucket.months += 1;
        const pbi = Number(row.pbi_usd);
        if (Number.isFinite(pbi) && pbi > 0) bucket.pbi = pbi;
        byYear.set(year, bucket);
    }

    const years = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const lastYear = years.at(-1)?.[0];

    return years
        .filter(([year, bucket]) => bucket.pbi && (bucket.months === 12 || year === lastYear))
        .map(([year, bucket]) => {
            const preliminary = bucket.months < 12;
            const factor = preliminary ? 12 / bucket.months : 1;
            const exportaciones = (bucket.expo * factor / bucket.pbi!) * 100;
            const importaciones = (bucket.impo * factor / bucket.pbi!) * 100;
            return {
                fecha: year,
                iso_fecha: `${year}-01-01`,
                exportaciones,
                importaciones,
                apertura: exportaciones + importaciones,
                preliminary,
            };
        });
}
