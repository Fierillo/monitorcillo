import { useSyncExternalStore } from 'react';

type Entry = { raw: string | null; value: unknown };

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

export function readStoredConfig<T>(key: string, parse: (raw: string | null) => T | null): T | null {
    const raw = window.localStorage.getItem(key);
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T | null;
    const value = parse(raw);
    cache.set(key, { raw, value });
    return value;
}

function subscribeStoredConfig(key: string, onStoreChange: () => void): () => void {
    let set = listeners.get(key);
    if (!set) {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(onStoreChange);
    return () => {
        set.delete(onStoreChange);
        if (set.size === 0) listeners.delete(key);
    };
}

export function writeStoredConfig<T>(key: string, config: T): void {
    const raw = JSON.stringify(config);
    window.localStorage.setItem(key, raw);
    cache.set(key, { raw, value: config });
    listeners.get(key)?.forEach(listener => listener());
}

const noopSubscribe = () => () => {};

/** Persisted config under `key`; `null` on the server and during hydration. */
export function useStoredConfig<T>(key: string, parse: (raw: string | null) => T | null): T | null {
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const persisted = useSyncExternalStore(
        onStoreChange => subscribeStoredConfig(key, onStoreChange),
        () => readStoredConfig(key, parse),
        () => null,
    );
    return isClient ? persisted : null;
}
