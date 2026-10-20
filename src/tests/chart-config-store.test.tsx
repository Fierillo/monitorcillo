import { renderHook, act } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { readStoredConfig, useStoredConfig, writeStoredConfig } from '@/lib/chart-config-store';

const parse = (raw: string | null) => (raw ? JSON.parse(raw) as { n: number } : null);

beforeEach(() => window.localStorage.clear());

it('returns the same parsed object while the stored raw value does not change', () => {
    window.localStorage.setItem('k', '{"n":1}');
    expect(readStoredConfig('k', parse)).toBe(readStoredConfig('k', parse));
});

it('writes to localStorage and notifies subscribed hooks', () => {
    const { result } = renderHook(() => useStoredConfig('k2', parse));
    expect(result.current).toBeNull();
    act(() => writeStoredConfig('k2', { n: 2 }));
    expect(result.current).toEqual({ n: 2 });
    expect(window.localStorage.getItem('k2')).toBe('{"n":2}');
});
