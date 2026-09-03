export * from './db/raw';
export * from './db/normalized';
export * from './db/catalog';
export * from './db/feedback';

import { getIndicatorPublicationDate, getIndicatorsCatalog, saveIndicatorPublication, saveIndicatorsCatalog } from './db/catalog';
import { getFeedback, saveFeedback } from './db/feedback';
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
    getFeedback,
    saveFeedback,
};

export default db;
