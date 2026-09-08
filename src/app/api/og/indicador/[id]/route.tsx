import { renderIndicatorOgImage } from '@/lib/chart-og-image';

export const revalidate = 21600;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const url = new URL(request.url);
    return renderIndicatorOgImage(id, {
        viewId: url.searchParams.get('view') ?? undefined,
        modeId: url.searchParams.get('mode') ?? undefined,
    });
}
