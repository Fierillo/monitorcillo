import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('https', () => ({ default: { get: mocks.get } }));

type RequestOutcome = Error | { statusCode: number; body?: string };

function mockRequests(...outcomes: RequestOutcome[]) {
    mocks.get.mockImplementation((
        _url: string,
        _options: unknown,
        callback: (response: EventEmitter & { statusCode: number; resume: () => void }) => void,
    ) => {
        const request = Object.assign(new EventEmitter(), {
            setTimeout: vi.fn(),
            destroy: vi.fn(),
        });
        const outcome = outcomes.shift();

        queueMicrotask(() => {
            if (outcome instanceof Error) {
                request.emit('error', outcome);
                return;
            }

            const response = Object.assign(new EventEmitter(), {
                statusCode: outcome?.statusCode ?? 200,
                resume: vi.fn(),
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
        mocks.get.mockReset();
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
        expect(mocks.get).toHaveBeenCalledTimes(3);
    });

    it('does not retry non-transient HTTP errors', async () => {
        mockRequests({ statusCode: 404 });
        const { fetchTextFromUrl } = await import('@/lib/sync/http-client');

        await expect(fetchTextFromUrl('https://www.indec.gob.ar/missing')).rejects.toThrow('Status 404');
        expect(mocks.get).toHaveBeenCalledOnce();
    });
});
