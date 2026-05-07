export * from './db/raw';
export * from './db/normalized';
export * from './db/catalog';

import { getIndicatorPublicationDate, getIndicatorsCatalog, saveIndicatorPublication, saveIndicatorsCatalog } from './db/catalog';
import { getLastUpdate, getLatestNormalizedData, getNormalizedData, getNormalizedDataByDate, replaceNormalizedData, saveNormalizedData } from './db/normalized';
import { getLatestRawDate, getRawData, getRawDataByDate, replaceRawData, saveRawData } from './db/raw';

const db = {
    getRawData,
    saveRawData,
    replaceRawData,
    getNormalizedData,
    getLatestNormalizedData,
    getNormalizedDataByDate,
    getRawDataByDate,
    getLatestRawDate,
    saveNormalizedData,
    replaceNormalizedData,
    getLastUpdate,
    getIndicatorsCatalog,
    saveIndicatorsCatalog,
    saveIndicatorPublication,
    getIndicatorPublicationDate,
};

export default db;
