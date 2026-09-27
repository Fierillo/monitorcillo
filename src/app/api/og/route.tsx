import { ImageResponse } from 'next/og';
import { SITE_TAGLINE, SITE_TITLE } from '@/lib/site';

export const revalidate = 86400;

export async function GET() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 24,
                    backgroundColor: '#00143F',
                    color: '#FFD700',
                    border: '8px solid #FFD700',
                    padding: 48,
                }}
            >
                <div style={{ display: 'flex', fontSize: 132, fontWeight: 700, letterSpacing: 12, textTransform: 'uppercase', lineHeight: 1 }}>{SITE_TITLE}</div>
                <div style={{ display: 'flex', fontSize: 40, color: '#00BFFF', textAlign: 'center', lineHeight: 1.3 }}>{SITE_TAGLINE}</div>
            </div>
        ),
        { width: 1200, height: 630 },
    );
}
