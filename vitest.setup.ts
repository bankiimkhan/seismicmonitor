import '@testing-library/jest-dom/vitest';

// Node >= 22 defines its own `localStorage` global that stays `undefined`
// unless the process was started with --localstorage-file, and it shadows the
// jsdom window's implementation once vitest copies jsdom's globals over
// (`sessionStorage` is unaffected -- Node doesn't define that one). Without
// this, every component that reads localStorage takes the
// storage-is-blocked path in lib/safeStorage.ts instead of the ordinary
// browser path the tests mean to exercise.
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    const memoryStorage: Storage = {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        key: (index: number) => [...store.keys()][index] ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: memoryStorage,
        configurable: true,
        writable: true,
    });
}
