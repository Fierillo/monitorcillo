import { EventEmitter } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn() }));

vi.mock('https', () => ({ default: { request: mocks.request } }));
vi.mock('dns', () => ({ lookup: mocks.lookup }));

type RequestOutcome = Error | { statusCode: number; body?: string | Buffer; contentType?: string; location?: string; lastModified?: string };

function mockRequests(...outcomes: RequestOutcome[]) {
    mocks.request.mockImplementation((
        _url: string,
        _options: unknown,
        callback: (response: EventEmitter & { statusCode: number; resume: () => void }) => void,
    ) => {
        const request = Object.assign(new EventEmitter(), {
            setTimeout: vi.fn(),
            destroy: vi.fn(),
            end: vi.fn(),
        });
        const outcome = outcomes.shift();

        queueMicrotask(() => {
            if (outcome instanceof Error) {
                request.emit('error', outcome);
                return;
            }

            const response = Object.assign(new EventEmitter(), {
                statusCode: outcome?.statusCode ?? 200,
                headers: { 'content-type': outcome?.contentType, location: outcome?.location, 'last-modified': outcome?.lastModified },
                resume: vi.fn(),
                destroy: vi.fn(),
            });
            callback(response);
            if (outcome?.body) response.emit('data', Buffer.from(outcome.body));
            response.emit('end');
        });

        return request;
    });
}

describe('sync HTTP client', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.request.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('retries transient DNS errors before succeeding', async () => {
        const dnsError = Object.assign(new Error('DNS unavailable'), { code: 'EAI_AGAIN' });
        mockRequests(dnsError, dnsError, { statusCode: 200, body: 'ok' });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        const result = fetchTextFromUrl('https://www.indec.gob.ar/data');
        await vi.runAllTimersAsync();

        await expect(result).resolves.toBe('ok');
        expect(mocks.request).toHaveBeenCalledTimes(3);
    });

    it('follows redirects, resolving relative locations against the requested URL', async () => {
        mockRequests(
            { statusCode: 302, location: 'ver_contenido.php?id_contenido=17876' },
            { statusCode: 301, location: 'https://dgsiaf-repo.mecon.gob.ar/serie.csv' },
            { statusCode: 200, body: 'ok' },
        );
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://www.utdt.edu/listado_contenidos.php?id_item_menu=28756')).resolves.toBe('ok');
        expect(mocks.request.mock.calls.map(([url]) => url)).toEqual([
            'https://www.utdt.edu/listado_contenidos.php?id_item_menu=28756',
            'https://www.utdt.edu/ver_contenido.php?id_contenido=17876',
            'https://dgsiaf-repo.mecon.gob.ar/serie.csv',
        ]);
    });

    it('refuses non-https URLs and loopback, private or link-local hosts without opening a socket', async () => {
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');
        const refused = [
            'http://www.indec.gob.ar/data',
            'https://localhost/data',
            'https://api.localhost/data',
            'https://127.0.0.1/data',
            'https://2130706433/data',
            'https://10.0.0.1/data',
            'https://172.16.5.4/data',
            'https://192.168.1.1/data',
            'https://169.254.169.254/latest',
            'https://[::1]/data',
            'https://[::ffff:127.0.0.1]/data',
            'https://[fd00::1]/data',
            'https://[fe80::1]/data',
        ];

        for (const url of refused) await expect(fetchTextFromUrl(url), url).rejects.toThrow('Refusing to download');
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('applies the same host policy to redirect targets', async () => {
        mockRequests({ statusCode: 302, location: 'https://169.254.169.254/latest/meta-data' });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://www.indec.gob.ar/data')).rejects.toThrow('Refusing to download https://169.254.169.254');
        expect(mocks.request).toHaveBeenCalledOnce();
    });

    it('never puts URL credentials in error messages', async () => {
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');
        mockRequests({ statusCode: 404 });
        const statusError = await fetchTextFromUrl('https://user:secret@www.indec.gob.ar/missing').catch((error: Error) => error.message);
        const policyError = await fetchTextFromUrl('http://user:secret@www.indec.gob.ar/data').catch((error: Error) => error.message);

        expect(statusError).toContain('https://www.indec.gob.ar/missing');
        for (const message of [statusError, policyError]) expect(message).not.toMatch(/user|secret/);
    });

    it('aborts a body larger than 64 MB with a clear error', async () => {
        mockRequests({ statusCode: 200, body: Buffer.alloc(64 * 1024 * 1024 + 1) });
        const { fetchBufferFromUrl } = await import('@/lib/sync/http-client');

        const outcome = await fetchBufferFromUrl('https://user:secret@www.argentina.gob.ar/huge.xlsx').then(() => 'resolved', (error: Error) => error.message);

        expect(outcome).toBe('Failed to download https://www.argentina.gob.ar/huge.xlsx. Body exceeds 64 MB.');
        expect(mocks.request).toHaveBeenCalledOnce();
    });

    it('refuses to connect when a public hostname resolves to a non-public address', async () => {
        mockRequests({ statusCode: 200, body: 'ok' });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');
        await fetchTextFromUrl('https://rebind.example/data');
        const { lookup } = mocks.request.mock.calls[0][1];
        const resolve = (addresses: Array<{ address: string; family: number }>) => new Promise<Error | null>((done) => {
            mocks.lookup.mockImplementationOnce((_host, _options, callback) => callback(null, addresses));
            lookup('rebind.example', { all: true }, (error: Error | null) => done(error));
        });

        expect(await resolve([{ address: '200.51.0.10', family: 4 }])).toBeNull();
        expect((await resolve([{ address: '200.51.0.10', family: 4 }, { address: '10.0.0.5', family: 4 }]))?.message).toContain('Refusing to connect to rebind.example');
        expect(await resolve([{ address: '::1', family: 6 }])).toBeInstanceOf(Error);
    });

    it.each(['https://', 'https://[zzzz]'])('rejects a redirect whose Location %s is not a valid URL', async (location) => {
        mockRequests({ statusCode: 302, location });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://user:secret@www.utdt.edu/a')).rejects
            .toThrow('Failed to download https://www.utdt.edu/a. Invalid redirect location.');
    });

    it('stops following a redirect loop', async () => {
        mockRequests(...Array.from({ length: 10 }, () => ({ statusCode: 302, location: '/loop' })));
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://www.utdt.edu/loop')).rejects.toThrow('Too many redirects');
    });

    it('rejects a response whose content type is not the expected one', async () => {
        mockRequests({ statusCode: 200, body: '<!DOCTYPE html>', contentType: 'text/html; charset=utf-8' });
        const { fetchBufferFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchBufferFromUrl('https://www.indec.gob.ar/a.xls', { expectedContentType: /excel|spreadsheet|octet-stream/i }))
            .rejects.toThrow('Unexpected content type text/html');
        expect(mocks.request).toHaveBeenCalledOnce();
    });

    it('accepts a response with the expected content type', async () => {
        mockRequests({ statusCode: 200, body: 'xls', contentType: 'application/vnd.ms-excel' });
        const { fetchBufferFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchBufferFromUrl('https://www.indec.gob.ar/a.xls', { expectedContentType: /excel/i }))
            .resolves.toEqual(Buffer.from('xls'));
    });

    it('does not retry non-transient HTTP errors', async () => {
        mockRequests({ statusCode: 404 });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://www.indec.gob.ar/missing')).rejects.toThrow('Status 404');
        expect(mocks.request).toHaveBeenCalledOnce();
    });

    it('uses a custom request timeout', async () => {
        mockRequests({ statusCode: 200, body: 'ok' });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://apis.datos.gob.ar/data', { timeoutMs: 60_000 })).resolves.toBe('ok');

        const request = mocks.request.mock.results[0].value;
        expect(request.setTimeout).toHaveBeenCalledWith(60_000, expect.any(Function));
    });
});

describe('shared transport boundary', () => {
    const syncRoot = join(process.cwd(), 'src/lib/sync');
    const handRolledTransport = /https\.(get|request)\(|(?<![\w.$])fetch\(/;

    it('is the only sync module allowed to open sockets itself', () => {
        const entries = readdirSync(syncRoot).filter(entry => entry.endsWith('.ts'));

        expect(entries).toContain('http-client.ts');
        for (const entry of entries) {
            if (entry === 'http-client.ts') continue;
            const source = readFileSync(join(syncRoot, entry), 'utf8');
            expect(handRolledTransport.test(source), `src/lib/sync/${entry} bypasses the shared client`).toBe(false);
        }
    });
});

describe('fetchLastModifiedDate', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('reports the publication date advertised by the server with a HEAD through the shared redirect policy', async () => {
        mockRequests({ statusCode: 302, location: '/files/icg.xls' }, { statusCode: 200, lastModified: 'Tue, 10 Feb 2026 14:03:00 GMT' });
        const { fetchLastModifiedDate } = await import('@/lib/sync/http-client');

        await expect(fetchLastModifiedDate('https://www.utdt.edu/icg.xls')).resolves.toBe('2026-02-10');
        expect(mocks.request.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
            ['https://www.utdt.edu/icg.xls', 'HEAD'],
            ['https://www.utdt.edu/files/icg.xls', 'HEAD'],
        ]);
    });

    it('reports an unknown date rather than failing the sync', async () => {
        const { fetchLastModifiedDate } = await import('@/lib/sync/http-client');

        mockRequests({ statusCode: 200 }, { statusCode: 200, lastModified: 'not a date' }, { statusCode: 404, lastModified: 'Tue, 10 Feb 2026 14:03:00 GMT' }, new Error('network down'));
        for (let call = 0; call < 4; call += 1) await expect(fetchLastModifiedDate('https://www.utdt.edu/icg.xls')).resolves.toBeNull();

        await expect(fetchLastModifiedDate('https://127.0.0.1/icg.xls')).resolves.toBeNull();
        expect(mocks.request).toHaveBeenCalledTimes(4);
    });
});
