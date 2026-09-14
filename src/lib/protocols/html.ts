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
