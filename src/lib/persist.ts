import { writable, type Writable } from 'svelte/store';

const STORAGE_PREFIX = 'if-c-is-red:';

export function persisted<T>(key: string, initialValue: T): Writable<T> {
  const storageKey = STORAGE_PREFIX + key;
  let startValue = initialValue;

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) {
        startValue = JSON.parse(raw) as T;
      }
    } catch (e) {
      console.warn(`persisted(${key}): failed to read localStorage`, e);
    }
  }

  const store = writable<T>(startValue);

  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (e) {
        console.warn(`persisted(${key}): failed to write localStorage`, e);
      }
    });
  }

  return store;
}
