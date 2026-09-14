export * from './db/raw';
export * from './db/normalized';
export * from './db/catalog';
export * from './db/feedback';

import { getIndicatorPublicationDate, getIndicatorsCatalog, saveIndicatorPublication, saveIndicatorsCatalog } from './db/catalog';
import { getFeedback, saveFeedback } from './db/feedback';
import { getLatestNormalizedData, getNormalizedData, getNormalizedDataByDate, replaceNormalizedData } from './db/normalized';
import { getLatestRawDate, getRawData, getRawDataByDate, saveRawData } from './db/raw';

const db = {
    getRawData,
    saveRawData,
    getNormalizedData,
    getLatestNormalizedData,
    getNormalizedDataByDate,
    getRawDataByDate,
    getLatestRawDate,
    replaceNormalizedData,
    getIndicatorsCatalog,
    saveIndicatorsCatalog,
    saveIndicatorPublication,
    getIndicatorPublicationDate,
    getFeedback,
    saveFeedback,
};

export default db;
