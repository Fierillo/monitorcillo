import type { EmaeRawRow } from '@/types';
import { parseEmaePublicationDate } from '../emae-source';
import { EMAE_PUBLICATION_PAGE_URL } from './constants';
import { fetchEmaeWorkbookRows } from './cache';
import { fetchTextFromUrl } from './http-client';

export async function fetchEmaeRaw(): Promise<{ rows: EmaeRawRow[]; publishedAt: string | null }> {
    const [rows, publicationHtml] = await Promise.all([
        fetchEmaeWorkbookRows(),
        fetchTextFromUrl(EMAE_PUBLICATION_PAGE_URL),
    ]);

    const publishedAt = parseEmaePublicationDate(publicationHtml);
    if (!publishedAt) {
        throw new Error('Failed to parse EMAE publication date. Verify INDEC publication page structure.');
    }

    return { rows, publishedAt };
}
