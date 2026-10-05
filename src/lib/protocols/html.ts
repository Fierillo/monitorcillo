export type HtmlFileLink = {
    href: string;
    label: string;
};

type ExtractFileLinksOptions = {
    origin?: string;
    extensions?: string[];
};

function stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(href: string, origin?: string): string {
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    if (!origin) return href;
    return `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
}

function fileExtension(href: string): string | undefined {
    const matches = [...href.matchAll(/\.([a-z0-9]+)(?=$|[?#&])/gi)];
    return matches.at(-1)?.[1]?.toLowerCase();
}

export function extractFileLinks(html: string, options: ExtractFileLinksOptions = {}): HtmlFileLink[] {
    const extensions = (options.extensions ?? ['pdf', 'xls', 'xlsx', 'csv']).map(extension => extension.replace(/^\./, '').toLowerCase());
    const links: HtmlFileLink[] = [];

    for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const href = match[1].replace(/&amp;/g, '&');
        const extension = fileExtension(href);
        if (!extension || !extensions.includes(extension)) continue;
        links.push({ href: absoluteUrl(href, options.origin), label: stripTags(match[2]) });
    }

    return links;
}

export function parseUtdtAssetDate(url: string): string | null {
    const match = url.match(/_(\d{10})\d+/);
    if (!match) return null;
    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds)) return null;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    if (year < 2001 || year > 2100) return null;
    return date.toISOString().split('T')[0];
}
