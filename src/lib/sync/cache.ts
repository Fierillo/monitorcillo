import type { EmaeRawRow, PbiAnchorRow } from '@/types';
import { parseEmaeSectorWorkbook, parseEmaeWorkbook } from '../emae-source';
import { parseLatestPbiWorkbookUrl, parsePbiWorkbook } from '../pbi-source';
import { EMAE_SECTOR_WORKBOOK_URL, EMAE_WORKBOOK_URL, PBI_PAGE_URL } from './constants';
import { fetchBufferFromUrl, fetchTextFromUrl } from './http-client';

let emaeWorkbookRowsPromise: Promise<EmaeRawRow[]> | null = null;
let emaeSectorWorkbookRowsPromise: Promise<EmaeRawRow[]> | null = null;
let pbiAnchorRowsPromise: Promise<PbiAnchorRow[]> | null = null;

function clearOnFailure<T>(promise: Promise<T>, clear: () => void): Promise<T> {
    return promise.catch((error) => {
        clear();
        throw error;
    });
}

export async function fetchEmaeWorkbookRows(): Promise<EmaeRawRow[]> {
    emaeWorkbookRowsPromise ??= clearOnFailure(fetchBufferFromUrl(EMAE_WORKBOOK_URL).then((buffer) => {
        const rows = parseEmaeWorkbook(buffer);
        if (rows.length === 0) {
            throw new Error('Failed to parse EMAE workbook. No data rows found. Verify INDEC workbook structure.');
        }

        return rows;
    }), () => { emaeWorkbookRowsPromise = null; });

    return emaeWorkbookRowsPromise;
}

export async function fetchEmaeSectorWorkbookRows(): Promise<EmaeRawRow[]> {
    emaeSectorWorkbookRowsPromise ??= clearOnFailure(fetchBufferFromUrl(EMAE_SECTOR_WORKBOOK_URL).then((buffer) => {
        const rows = parseEmaeSectorWorkbook(buffer);
        if (rows.length === 0) {
            throw new Error('Failed to parse EMAE sector workbook. No data rows found. Verify INDEC workbook structure.');
        }

        return rows;
    }), () => { emaeSectorWorkbookRowsPromise = null; });

    return emaeSectorWorkbookRowsPromise;
}

export async function fetchPbiAnchorRows(): Promise<PbiAnchorRow[]> {
    pbiAnchorRowsPromise ??= clearOnFailure(fetchTextFromUrl(PBI_PAGE_URL).then(async (html) => {
        const workbookUrl = parseLatestPbiWorkbookUrl(html);
        if (!workbookUrl) {
            throw new Error('Failed to find latest PBI workbook URL. Verify INDEC PBI page structure.');
        }

        const rows = parsePbiWorkbook(await fetchBufferFromUrl(workbookUrl));
        if (rows.length === 0) {
            throw new Error(`Failed to parse PBI workbook ${workbookUrl}. Verify INDEC workbook structure.`);
        }

        return rows;
    }), () => { pbiAnchorRowsPromise = null; });

    return pbiAnchorRowsPromise;
}
