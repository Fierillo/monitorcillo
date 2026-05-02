import type { CatalogIndicatorRow, DataRow, IndicatorType } from '@/types';
import { buildIndicatorCatalogItem, buildIndicatorsCatalog, CATALOG_INDICATOR_SPECS, DEFAULT_CATALOG } from './catalog';

export type CatalogDataSources = {
    getCatalogRows: () => Promise<CatalogIndicatorRow[]>;
    getNormalizedRows: (type: IndicatorType) => Promise<DataRow[] | null>;
    getRawRows: (type: IndicatorType) => Promise<DataRow[] | null>;
    getLatestNormalizedRow?: (type: IndicatorType, valueColumn: string) => Promise<DataRow | null>;
    getLatestRawDate?: (type: IndicatorType, fields: string[]) => Promise<string | null>;
};

async function defaultCatalogDataSources(): Promise<CatalogDataSources> {
    const db = await import('./db');

    return {
        getCatalogRows: db.getIndicatorsCatalog,
        getNormalizedRows: async (type) => db.getNormalizedData(type) as Promise<DataRow[] | null>,
        getRawRows: async (type) => db.getRawData(type) as Promise<DataRow[]>,
        getLatestNormalizedRow: async (type, valueColumn) => db.getLatestNormalizedData(type, valueColumn) as Promise<DataRow | null>,
        getLatestRawDate: db.getLatestRawDate,
    };
}

function catalogBaseFromRows(rows: CatalogIndicatorRow[]): CatalogIndicatorRow[] {
    if (rows.length === 0) return DEFAULT_CATALOG.map(row => ({ ...row }));

    const knownIds = new Set(rows.map(row => row.id));
    const missingDefaults = DEFAULT_CATALOG
        .filter(row => !knownIds.has(row.id))
        .map(row => ({ ...row }));

    return [...rows.map(row => ({ ...row })), ...missingDefaults];
}

export async function buildCurrentIndicatorsCatalog(sources?: CatalogDataSources): Promise<CatalogIndicatorRow[]> {
    const dataSources = sources ?? await defaultCatalogDataSources();
    const baseCatalog = catalogBaseFromRows(await dataSources.getCatalogRows());

    if (dataSources.getLatestNormalizedRow && dataSources.getLatestRawDate) {
        return Promise.all(baseCatalog.map(async item => {
            const spec = CATALOG_INDICATOR_SPECS[item.id];
            if (!spec) return { ...item };

            const [valueRow, rawDate] = await Promise.all([
                dataSources.getLatestNormalizedRow!(spec.type, spec.normalizedValueColumn),
                dataSources.getLatestRawDate!(spec.type, spec.rawDateFields),
            ]);

            return buildIndicatorCatalogItem(item, spec, valueRow, rawDate);
        }));
    }

    const types = Array.from(new Set(Object.values(CATALOG_INDICATOR_SPECS).map(spec => spec.type)));
    const normalizedData: Partial<Record<IndicatorType, DataRow[] | null>> = {};
    const rawData: Partial<Record<IndicatorType, DataRow[] | null>> = {};

    await Promise.all(types.map(async type => {
        const [normalizedRows, rawRows] = await Promise.all([
            dataSources.getNormalizedRows(type),
            dataSources.getRawRows(type),
        ]);

        normalizedData[type] = normalizedRows;
        rawData[type] = rawRows;
    }));

    return buildIndicatorsCatalog(baseCatalog, normalizedData, rawData);
}
