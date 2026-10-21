import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('security headers', () => {
    it('sends hardening headers on every path', async () => {
        const rules = await nextConfig.headers!();
        const rule = rules.find((entry) => entry.source === '/:path*');
        expect(rule).toBeDefined();
        const headers = Object.fromEntries(rule!.headers.map(({ key, value }) => [key, value]));

        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
        expect(headers['Content-Security-Policy']).toContain("base-uri 'self'");
        expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
        expect(headers['Permissions-Policy']).toContain('camera=()');
        expect(headers['Permissions-Policy']).toContain('microphone=()');
        expect(headers['Permissions-Policy']).toContain('geolocation=()');
    });
});
